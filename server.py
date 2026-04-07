#!/usr/bin/env python3
import base64
from email.parser import BytesParser
from email.policy import default as email_policy_default
import hashlib
import hmac
import json
import mimetypes
import os
import pathlib
import re
import secrets
import sqlite3
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

BASE_DIR = pathlib.Path(__file__).resolve().parent
SITE_DIR = BASE_DIR


def load_env_file():
    for candidate in [BASE_DIR / ".env", SITE_DIR / ".env"]:
        if not candidate.exists():
            continue
        try:
            for raw_line in candidate.read_text(encoding="utf-8").splitlines():
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = value
        except OSError:
            continue


load_env_file()

def ensure_writable_storage_dir():
    requested = os.getenv("BACKEND_STORAGE_DIR", "").strip()
    candidates = []
    if requested:
        candidates.append(pathlib.Path(requested).expanduser())
    candidates.extend(
        [
            BASE_DIR / ".backend-storage",
            pathlib.Path("/tmp/ielts-lexicon-sprint-data"),
        ]
    )

    seen = set()
    errors = []
    for candidate in candidates:
        resolved = candidate.resolve(strict=False)
        key = str(resolved)
        if key in seen:
            continue
        seen.add(key)
        try:
            resolved.mkdir(parents=True, exist_ok=True)
            probe = resolved / ".write-test"
            probe.write_text("ok", encoding="utf-8")
            probe.unlink(missing_ok=True)
            return resolved
        except OSError as error:
            errors.append(f"{resolved}: {error}")
            continue

    raise RuntimeError("无法找到可写的后端存储目录：" + " | ".join(errors))


STORAGE_DIR = ensure_writable_storage_dir()
PROGRESS_STATE_FILE = STORAGE_DIR / "local-progress.json"
CLOUD_SYNC_DB_FILE = STORAGE_DIR / "cloud-sync.sqlite3"

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
DEFAULT_PROVIDER_BASE_URLS = {
    "openai": "https://api.openai.com/v1",
    "openrouter": "https://openrouter.ai/api/v1",
    "gemini": "https://generativelanguage.googleapis.com/v1beta",
}
DEFAULT_PROVIDER_MODELS = {
    "openai": {
        "transcribe": "gpt-4o-mini-transcribe",
        "review": "gpt-5-mini",
        "writing": "gpt-5-mini",
    },
    "openrouter": {
        "transcribe": "openrouter/auto",
        "review": "openrouter/free",
        "writing": "openrouter/free",
    },
    "gemini": {
        "transcribe": "gemini-2.5-flash-lite",
        "review": "gemini-2.5-flash-lite",
        "writing": "gemini-2.5-flash-lite",
    },
}
OPENROUTER_FREE_MODEL_ROUTER = DEFAULT_PROVIDER_MODELS["openrouter"]["writing"]
DEFAULT_OPENROUTER_FREE_WRITING_PRIORITY = (
    "google/gemma-3-27b-it:free",
    "openai/gpt-oss-120b:free",
    "openai/gpt-oss-20b:free",
    OPENROUTER_FREE_MODEL_ROUTER,
)
DEFAULT_GEMINI_MODEL_PRIORITY = {
    "transcribe": ("gemini-2.5-flash-lite", "gemini-2.5-flash"),
    "review": ("gemini-2.5-flash-lite", "gemini-2.5-flash"),
    "writing": ("gemini-2.5-flash-lite", "gemini-2.5-flash"),
}
SUPPORTED_PROVIDERS = tuple(DEFAULT_PROVIDER_BASE_URLS.keys())


def is_gemai_base_url(value):
    return "api.gemai.cc" in str(value or "").strip().lower()


def is_aihubmix_base_url(value):
    return "aihubmix.com" in str(value or "").strip().lower()


def get_aihubmix_gemini_base_url():
    configured = (
        os.getenv("AIHUBMIX_GEMINI_BASE_URL", "").strip()
        or os.getenv("AIHUBMIX_BASE_URL", "").strip()
        or "https://aihubmix.com/gemini"
    ).rstrip("/")
    if configured.endswith("/v1beta"):
        return configured
    if configured.endswith("/gemini"):
        return f"{configured}/v1beta"
    if configured.endswith("/v1"):
        configured = configured[: -len("/v1")]
    return f"{configured}/gemini/v1beta"


def is_aihubmix_native_gemini_model(provider, model):
    provider = normalize_provider_name(provider)
    model_name = str(model or "").strip().lower()
    return (
        provider == "openai"
        and is_aihubmix_base_url(get_provider_base_url(provider))
        and model_name.startswith("gemini")
        and not model_name.endswith(("-nothink", "-search"))
    )


def infer_provider_name():
    configured = os.getenv("AI_PROVIDER", "").strip().lower()
    if configured in DEFAULT_PROVIDER_BASE_URLS:
        return configured

    base_hint = (
        os.getenv("AI_BASE_URL")
        or os.getenv("OPENAI_BASE_URL")
        or os.getenv("GEMINI_BASE_URL")
        or os.getenv("GEMINI_OPENAI_COMPAT_BASE_URL")
        or ""
    ).strip().lower()
    if "generativelanguage.googleapis.com" in base_hint:
        return "gemini"
    if "openrouter.ai" in base_hint:
        return "openrouter"
    if is_gemai_base_url(base_hint) or is_aihubmix_base_url(base_hint):
        return "openai"
    if os.getenv("GEMINI_API_KEY", "").strip():
        return "gemini"
    if os.getenv("GEMAI_API_KEY", "").strip() or os.getenv("AIHUBMIX_API_KEY", "").strip():
        return "openai"
    return "openai"


AI_PROVIDER = infer_provider_name()
AI_BASE_URL = os.getenv("AI_BASE_URL") or os.getenv("OPENAI_BASE_URL") or DEFAULT_PROVIDER_BASE_URLS[AI_PROVIDER]
TRANSCRIBE_MODEL = (
    os.getenv("AI_TRANSCRIBE_MODEL")
    or os.getenv("OPENAI_TRANSCRIBE_MODEL")
    or DEFAULT_PROVIDER_MODELS[AI_PROVIDER]["transcribe"]
)
REVIEW_MODEL = (
    os.getenv("AI_REVIEW_MODEL")
    or os.getenv("OPENAI_REVIEW_MODEL")
    or DEFAULT_PROVIDER_MODELS[AI_PROVIDER]["review"]
)
WRITING_REVIEW_MODEL = (
    os.getenv("AI_WRITING_REVIEW_MODEL")
    or os.getenv("OPENAI_WRITING_REVIEW_MODEL")
    or DEFAULT_PROVIDER_MODELS[AI_PROVIDER]["writing"]
)
OPENROUTER_HTTP_REFERER = os.getenv("OPENROUTER_HTTP_REFERER", f"http://{HOST}:{PORT}")
OPENROUTER_TITLE = os.getenv("OPENROUTER_TITLE", "IELTS Practice Studio")
GEMINI_OPENAI_COMPAT_BASE_URL = os.getenv(
    "GEMINI_OPENAI_COMPAT_BASE_URL",
    "https://generativelanguage.googleapis.com/v1beta/openai",
)
ACCOUNT_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9._@-]{1,46}[a-z0-9])?$")
MIN_PASSWORD_LENGTH = 6
MAX_PASSWORD_LENGTH = 72
CLOUD_SESSION_TTL_MS = int(
    os.getenv("CLOUD_SYNC_SESSION_TTL_MS", str(90 * 24 * 60 * 60 * 1000))
)
GOOGLE_TTS_BASE_URL = os.getenv(
    "GOOGLE_TTS_BASE_URL",
    "https://translate.googleapis.com/translate_tts",
)
MAX_TTS_CHARACTERS = 220
MAX_AUDIO_BYTES = 20 * 1024 * 1024
MAX_WRITING_CHARS = 20000
DB_LOCK = threading.RLock()

SPEAKING_BAND_BREAKDOWN_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "fluency_coherence": {"type": "number"},
        "lexical_resource": {"type": "number"},
        "grammatical_range_accuracy": {"type": "number"},
        "pronunciation": {"type": "number"},
    },
    "required": [
        "fluency_coherence",
        "lexical_resource",
        "grammatical_range_accuracy",
        "pronunciation",
    ],
}

SPEAKING_CRITERION_ANALYSIS_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "fluency_coherence": {"type": "string"},
        "lexical_resource": {"type": "string"},
        "grammatical_range_accuracy": {"type": "string"},
        "pronunciation": {"type": "string"},
    },
    "required": [
        "fluency_coherence",
        "lexical_resource",
        "grammatical_range_accuracy",
        "pronunciation",
    ],
}

TRANSCRIPT_ANALYSIS_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "summary": {"type": "string"},
        "delivery_notes": {"type": "array", "items": {"type": "string"}},
        "language_notes": {"type": "array", "items": {"type": "string"}},
        "highlighted_snippets": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "snippet": {"type": "string"},
                    "comment": {"type": "string"},
                },
                "required": ["snippet", "comment"],
            },
        },
        "next_focus": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "summary",
        "delivery_notes",
        "language_notes",
        "highlighted_snippets",
        "next_focus",
    ],
}

RECOMMENDED_MATERIALS_SCHEMA = {
    "type": "array",
    "items": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "content": {"type": "string"},
            "reason": {"type": "string"},
        },
        "required": ["content", "reason"],
    },
}

GRAMMAR_PATTERNS_SCHEMA = {
    "type": "array",
    "items": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "label": {"type": "string"},
            "symptom": {"type": "string"},
            "advice": {"type": "string"},
            "evidence": {"type": "string"},
        },
        "required": ["label", "symptom", "advice", "evidence"],
    },
}

SPEAKING_REVIEW_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "overall_band": {"type": "number"},
        "band_breakdown": SPEAKING_BAND_BREAKDOWN_SCHEMA,
        "criterion_analysis": SPEAKING_CRITERION_ANALYSIS_SCHEMA,
        "summary": {"type": "string"},
        "strengths": {"type": "array", "items": {"type": "string"}},
        "key_issues": {"type": "array", "items": {"type": "string"}},
        "improvement_actions": {"type": "array", "items": {"type": "string"}},
        "corrections": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "source": {"type": "string"},
                    "better_version": {"type": "string"},
                    "why": {"type": "string"},
                },
                "required": ["source", "better_version", "why"],
            },
        },
        "recommended_materials": RECOMMENDED_MATERIALS_SCHEMA,
        "grammar_patterns": GRAMMAR_PATTERNS_SCHEMA,
        "follow_up_questions": {"type": "array", "items": {"type": "string"}},
        "part_material_pack": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "topic_angles": {"type": "array", "items": {"type": "string"}},
                "reusable_phrases": {"type": "array", "items": {"type": "string"}},
                "content_hooks": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["topic_angles", "reusable_phrases", "content_hooks"],
        },
        "transcript_analysis": TRANSCRIPT_ANALYSIS_SCHEMA,
    },
    "required": [
        "overall_band",
        "band_breakdown",
        "criterion_analysis",
        "summary",
        "strengths",
        "key_issues",
        "improvement_actions",
        "corrections",
        "recommended_materials",
        "grammar_patterns",
        "follow_up_questions",
        "part_material_pack",
        "transcript_analysis",
    ],
}

SPEAKING_MOCK_SUMMARY_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "overall_band": {"type": "number"},
        "band_breakdown": SPEAKING_BAND_BREAKDOWN_SCHEMA,
        "criterion_analysis": SPEAKING_CRITERION_ANALYSIS_SCHEMA,
        "summary": {"type": "string"},
        "strengths": {"type": "array", "items": {"type": "string"}},
        "key_issues": {"type": "array", "items": {"type": "string"}},
        "improvement_actions": {"type": "array", "items": {"type": "string"}},
        "part_reports": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "part": {"type": "string"},
                    "prompt_title": {"type": "string"},
                    "estimated_band": {"type": "number"},
                    "main_issue": {"type": "string"},
                    "next_focus": {"type": "string"},
                },
                "required": ["part", "prompt_title", "estimated_band", "main_issue", "next_focus"],
            },
        },
        "transcript_overview": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "fluency_pattern": {"type": "string"},
                "vocabulary_pattern": {"type": "string"},
                "grammar_pattern": {"type": "string"},
                "pronunciation_pattern": {"type": "string"},
            },
            "required": ["fluency_pattern", "vocabulary_pattern", "grammar_pattern", "pronunciation_pattern"],
        },
        "recommended_materials": RECOMMENDED_MATERIALS_SCHEMA,
        "grammar_patterns": GRAMMAR_PATTERNS_SCHEMA,
    },
    "required": [
        "overall_band",
        "band_breakdown",
        "criterion_analysis",
        "summary",
        "strengths",
        "key_issues",
        "improvement_actions",
        "part_reports",
        "transcript_overview",
        "recommended_materials",
        "grammar_patterns",
    ],
}

WRITING_REVIEW_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "overall_band": {"type": "number"},
        "band_breakdown": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "task_response": {"type": "number"},
                "coherence_cohesion": {"type": "number"},
                "lexical_resource": {"type": "number"},
                "grammatical_range_accuracy": {"type": "number"},
            },
            "required": [
                "task_response",
                "coherence_cohesion",
                "lexical_resource",
                "grammatical_range_accuracy",
            ],
        },
        "summary": {"type": "string"},
        "strengths": {"type": "array", "items": {"type": "string"}},
        "key_issues": {"type": "array", "items": {"type": "string"}},
        "improvement_actions": {"type": "array", "items": {"type": "string"}},
        "focus_areas": {"type": "array", "items": {"type": "string"}},
        "sentence_upgrades": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "source": {"type": "string"},
                    "better_version": {"type": "string"},
                    "why": {"type": "string"},
                },
                "required": ["source", "better_version", "why"],
            },
        },
        "vocabulary_upgrades": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "original": {"type": "string"},
                    "improved": {"type": "string"},
                    "reason": {"type": "string"},
                },
                "required": ["original", "improved", "reason"],
            },
        },
        "grammar_patterns": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "label": {"type": "string"},
                    "symptom": {"type": "string"},
                    "advice": {"type": "string"},
                    "evidence": {"type": "string"},
                },
                "required": ["label", "symptom", "advice", "evidence"],
            },
        },
        "paragraph_plan": {"type": "array", "items": {"type": "string"}},
        "useful_phrases": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "overall_band",
        "band_breakdown",
        "summary",
        "strengths",
        "key_issues",
        "improvement_actions",
        "focus_areas",
        "sentence_upgrades",
        "vocabulary_upgrades",
        "grammar_patterns",
        "paragraph_plan",
        "useful_phrases",
    ],
}

REVIEW_INSTRUCTIONS = """
You are a strict but helpful IELTS Speaking examiner and coach.
You will receive:
1. An IELTS Speaking prompt definition.
2. A transcript produced from the candidate's uploaded audio.
3. Local rhythm metrics derived from the waveform.
4. An optional user-supplied transcript hint.

Return feedback in Simplified Chinese, but keep quoted transcript snippets and improved English phrases in English.
Ground every judgment in the transcript, timing, and rhythm signals.
Estimate IELTS Speaking sub-scores in 0.5 increments from 0 to 9.
Do not pretend you have phoneme-level scoring. For pronunciation, infer conservatively from audio-transcription clarity, rhythm, and hesitations.
Keep feedback concise but actionable.
For corrections, only rewrite phrases that are plausible improvements of what the candidate said.
For recommended materials, prioritize reusable IELTS speaking chunks, topic ideas, or follow-up phrases that fit this exact topic family.
Also extract 1-3 recurring grammar problems if they are visible, and tailor follow-up questions plus a material pack to the current Speaking part.
Also return:
1. criterion_analysis: separate Chinese feedback for Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy, and Pronunciation.
2. transcript_analysis: brief comments on delivery, language use, highlighted transcript snippets, and what to focus on next from the transcript itself.
""".strip()

FULL_MOCK_SUMMARY_INSTRUCTIONS = """
You are a strict but helpful IELTS Speaking examiner summarizing a full three-part mock test.
You will receive:
1. Part-by-part prompt definitions.
2. The transcript for each part.
3. Local rhythm metrics for each part.
4. Structured part-by-part AI review results.

Return feedback in Simplified Chinese, but keep quoted English phrases in English.
Estimate IELTS Speaking sub-scores in 0.5 increments from 0 to 9.
Judge the three parts together as one full mock, not as isolated answers.
criterion_analysis must separately explain:
1. Fluency and Coherence
2. Lexical Resource
3. Grammatical Range and Accuracy
4. Pronunciation

part_reports should summarise each part in one short diagnostic row.
transcript_overview should describe the candidate's recurring transcript-level patterns across all three parts.
recommended_materials should prioritise reusable speaking chunks or topic-development material worth memorising next.
grammar_patterns should highlight 1-3 repeated grammar issues across the whole mock.
Keep the output concise, actionable, and clearly grounded in the supplied part reviews and transcripts.
""".strip()

WRITING_REVIEW_INSTRUCTIONS = """
You are a strict but helpful IELTS Academic Writing examiner and coach.
You will receive:
1. A writing task definition, including whether it is Task 1 or Task 2.
2. The candidate's full essay in English.
3. Local heuristics such as word count, paragraph count, keyword coverage, and simple structure signals.
4. The candidate's target band, if provided.

Return feedback in Simplified Chinese, but keep quoted essay snippets and improved English phrases in English.
Estimate IELTS Writing sub-scores in 0.5 increments from 0 to 9.
For Task 1, treat the first criterion as Task Achievement and be strict about overview, data selection, and avoiding personal opinion.
For Task 2, treat the first criterion as Task Response and be strict about fully answering the question, maintaining a clear position, and supporting ideas.
Do not invent mistakes that are not visible in the essay.
If the essay is clearly under length, state that directly.
Keep feedback concise but actionable.
Sentence upgrades must be plausible rewrites of the candidate's own sentences, not completely new content.
Vocabulary upgrades should focus on replacing repetitive or weak expressions with more natural IELTS-style phrasing.
Paragraph plans should help the candidate rewrite this exact essay more effectively on the next attempt.
""".strip()


class ApiError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


def normalize_provider_name(provider):
    normalized = str(provider or AI_PROVIDER).strip().lower()
    return normalized if normalized in SUPPORTED_PROVIDERS else AI_PROVIDER


def require_provider_name(provider):
    normalized = str(provider or "").strip().lower()
    if not normalized:
        return AI_PROVIDER
    if normalized not in SUPPORTED_PROVIDERS:
        supported = " / ".join(get_provider_label(name) for name in SUPPORTED_PROVIDERS)
        raise ApiError(f"不支持的 AI 后端：{provider}。当前只支持 {supported}。", status=400)
    return normalized


def get_provider_api_key(provider=None):
    provider = normalize_provider_name(provider)
    if provider == "gemini":
        return os.getenv("GEMINI_API_KEY", "").strip() or (
            os.getenv("AI_API_KEY", "").strip() if AI_PROVIDER == "gemini" else ""
        )
    if provider == "openrouter":
        return os.getenv("OPENROUTER_API_KEY", "").strip() or (
            os.getenv("AI_API_KEY", "").strip() if AI_PROVIDER == "openrouter" else ""
        )
    return (
        os.getenv("OPENAI_API_KEY", "").strip()
        or os.getenv("GEMAI_API_KEY", "").strip()
        or os.getenv("AIHUBMIX_API_KEY", "").strip()
        or (
        os.getenv("AI_API_KEY", "").strip() if AI_PROVIDER == "openai" else ""
        )
    )


def get_api_key():
    return get_provider_api_key(AI_PROVIDER)


def get_provider_base_url(provider=None):
    provider = normalize_provider_name(provider)
    if provider == "gemini":
        return (
            os.getenv("GEMINI_BASE_URL", "").strip()
            or (os.getenv("AI_BASE_URL", "").strip() if AI_PROVIDER == "gemini" else "")
            or DEFAULT_PROVIDER_BASE_URLS["gemini"]
        )
    if provider == "openrouter":
        return (
            os.getenv("OPENROUTER_BASE_URL", "").strip()
            or (os.getenv("AI_BASE_URL", "").strip() if AI_PROVIDER == "openrouter" else "")
            or DEFAULT_PROVIDER_BASE_URLS["openrouter"]
        )
    return (
        os.getenv("OPENAI_BASE_URL", "").strip()
        or os.getenv("GEMAI_BASE_URL", "").strip()
        or os.getenv("AIHUBMIX_BASE_URL", "").strip()
        or (os.getenv("AI_BASE_URL", "").strip() if AI_PROVIDER == "openai" else "")
        or DEFAULT_PROVIDER_BASE_URLS["openai"]
    )


def get_provider_model(provider, capability):
    provider = normalize_provider_name(provider)
    capability = str(capability or "").strip().lower()
    env_name_map = {
        "openai": {
            "transcribe": "OPENAI_TRANSCRIBE_MODEL",
            "review": "OPENAI_REVIEW_MODEL",
            "writing": "OPENAI_WRITING_REVIEW_MODEL",
        },
        "openrouter": {
            "transcribe": "OPENROUTER_TRANSCRIBE_MODEL",
            "review": "OPENROUTER_REVIEW_MODEL",
            "writing": "OPENROUTER_WRITING_REVIEW_MODEL",
        },
        "gemini": {
            "transcribe": "GEMINI_TRANSCRIBE_MODEL",
            "review": "GEMINI_REVIEW_MODEL",
            "writing": "GEMINI_WRITING_REVIEW_MODEL",
        },
    }
    legacy_env_name_map = {
        "transcribe": "AI_TRANSCRIBE_MODEL",
        "review": "AI_REVIEW_MODEL",
        "writing": "AI_WRITING_REVIEW_MODEL",
    }

    provider_env = env_name_map.get(provider, {}).get(capability)
    if provider_env:
        configured = os.getenv(provider_env, "").strip()
        if configured:
            return finalize_provider_model(provider, capability, configured)

    legacy_env = legacy_env_name_map.get(capability)
    if legacy_env and AI_PROVIDER == provider:
        configured = os.getenv(legacy_env, "").strip()
        if configured:
            return finalize_provider_model(provider, capability, configured)

    return finalize_provider_model(provider, capability, DEFAULT_PROVIDER_MODELS[provider][capability])


def should_force_openrouter_free_model():
    raw = os.getenv("OPENROUTER_FORCE_FREE_MODEL", "true").strip().lower()
    return raw not in {"0", "false", "no", "off"}


def get_openrouter_writing_model_priority():
    configured = tuple(
        value.strip()
        for value in os.getenv("OPENROUTER_WRITING_MODEL_PRIORITY", "").split(",")
        if value.strip()
    )
    values = configured or DEFAULT_OPENROUTER_FREE_WRITING_PRIORITY
    seen = set()
    ordered = []
    for value in values:
        if value not in seen:
            seen.add(value)
            ordered.append(value)
    return tuple(ordered)


def get_gemini_model_priority(capability):
    capability = str(capability or "").strip().lower()
    configured = tuple(
        value.strip()
        for value in os.getenv(f"GEMINI_{capability.upper()}_MODEL_PRIORITY", "").split(",")
        if value.strip()
    )
    values = configured or DEFAULT_GEMINI_MODEL_PRIORITY.get(capability, ())
    seen = set()
    ordered = []
    for value in values:
        if value not in seen:
            seen.add(value)
            ordered.append(value)
    return tuple(ordered)


def finalize_provider_model(provider, capability, model):
    provider = normalize_provider_name(provider)
    capability = str(capability or "").strip().lower()
    model = str(model or "").strip()
    if not model:
        return model
    if provider == "openrouter" and capability == "writing" and should_force_openrouter_free_model():
        return get_openrouter_writing_model_priority()[0]
    if provider == "gemini":
        priority = get_gemini_model_priority(capability)
        if priority:
            return priority[0] if not model else model
    return model


def get_provider_model_candidates(provider, capability):
    provider = normalize_provider_name(provider)
    capability = str(capability or "").strip().lower()
    if provider == "openrouter" and capability == "writing" and should_force_openrouter_free_model():
        return get_openrouter_writing_model_priority()
    if provider == "gemini":
        configured = get_gemini_model_priority(capability)
        if configured:
            return configured
    return (get_provider_model(provider, capability),)


def get_provider_label(provider=None):
    provider = normalize_provider_name(provider)
    if provider == "openrouter":
        return "OpenRouter"
    if provider == "gemini":
        return "Gemini"
    if is_aihubmix_base_url(get_provider_base_url(provider)) or os.getenv("AIHUBMIX_API_KEY", "").strip():
        return "AiHubMix"
    if is_gemai_base_url(get_provider_base_url(provider)) or os.getenv("GEMAI_API_KEY", "").strip():
        return "GemAI"
    return "OpenAI"


def get_provider_status(provider):
    provider = normalize_provider_name(provider)
    return {
        "available": bool(get_provider_api_key(provider)),
        "provider": provider,
        "provider_label": get_provider_label(provider),
        "base_url": get_provider_base_url(provider),
        "transcribe_model": get_provider_model(provider, "transcribe"),
        "review_model": get_provider_model(provider, "review"),
        "writing_review_model": get_provider_model(provider, "writing"),
    }


def get_missing_key_message(provider):
    provider = normalize_provider_name(provider)
    if provider == "gemini":
        return "缺少 GEMINI_API_KEY，请先在后端环境变量里设置 Gemini Key。"
    if provider == "openrouter":
        return "缺少 OPENROUTER_API_KEY，请先在启动代理前设置 OpenRouter Key。"
    if is_aihubmix_base_url(get_provider_base_url(provider)) or os.getenv("AIHUBMIX_API_KEY", "").strip():
        return "缺少 AIHUBMIX_API_KEY，请先在后端环境变量里设置 AiHubMix Key。"
    if is_gemai_base_url(get_provider_base_url(provider)) or os.getenv("GEMAI_API_KEY", "").strip():
        return "缺少 GEMAI_API_KEY，请先在后端环境变量里设置 GemAI Key。"
    return "缺少 OPENAI_API_KEY，请先在启动代理前设置 OpenAI Key。"


AI_BASE_URL = get_provider_base_url(AI_PROVIDER)
TRANSCRIBE_MODEL = get_provider_model(AI_PROVIDER, "transcribe")
REVIEW_MODEL = get_provider_model(AI_PROVIDER, "review")
WRITING_REVIEW_MODEL = get_provider_model(AI_PROVIDER, "writing")


def sanitize_http_header_value(value, fallback=""):
    text = str(value or "").strip()
    if not text:
        return fallback
    try:
        text.encode("latin-1")
        return text
    except UnicodeEncodeError:
        return fallback


def get_gemini_openai_compat_base_url():
    return (
        os.getenv("GEMINI_OPENAI_COMPAT_BASE_URL", "").strip()
        or GEMINI_OPENAI_COMPAT_BASE_URL
        or "https://generativelanguage.googleapis.com/v1beta/openai"
    ).rstrip("/")


def write_cors_headers(handler):
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type, Accept, X-Cloud-Session, X-Cloud-Account")
    handler.send_header("Access-Control-Max-Age", "86400")


def json_response(handler, payload, status=200):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    write_cors_headers(handler)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def read_json_body(handler):
    try:
        length = int(handler.headers.get("Content-Length", "0"))
    except ValueError:
        raise ApiError("请求体长度无效。", status=400)

    raw = handler.rfile.read(length) if length > 0 else b"{}"
    try:
        return json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError as error:
        raise ApiError("请求中的 JSON 格式不正确。", status=400) from error


def parse_multipart_form_data(handler):
    content_type = str(handler.headers.get("Content-Type", "")).strip()
    if "multipart/form-data" not in content_type.lower():
        raise ApiError("当前请求不是有效的 multipart/form-data 表单。", status=400)

    try:
        content_length = int(handler.headers.get("Content-Length", "0"))
    except ValueError as error:
        raise ApiError("请求体长度无效。", status=400) from error

    if content_length <= 0:
        raise ApiError("上传请求体为空。", status=400)

    raw_body = handler.rfile.read(content_length)
    message = BytesParser(policy=email_policy_default).parsebytes(
        (
            f"Content-Type: {content_type}\r\n"
            "MIME-Version: 1.0\r\n"
            "\r\n"
        ).encode("utf-8")
        + raw_body
    )

    if not message.is_multipart():
        raise ApiError("上传表单解析失败，请重新上传音频。", status=400)

    fields = {}
    files = {}
    for part in message.iter_parts():
        name = part.get_param("name", header="content-disposition")
        if not name:
            continue

        filename = part.get_filename()
        payload = part.get_payload(decode=True) or b""
        if filename:
            files[name] = {
                "filename": filename,
                "content_type": part.get_content_type() or "application/octet-stream",
                "content": payload,
            }
            continue

        charset = part.get_content_charset() or "utf-8"
        try:
            fields[name] = payload.decode(charset)
        except UnicodeDecodeError:
            fields[name] = payload.decode("utf-8", errors="replace")

    return fields, files


def normalize_tts_text(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def resolve_tts_locale(accent):
    return "en-US" if str(accent or "").strip().lower() == "us" else "en-GB"


def proxy_pronunciation(handler):
    parsed = urllib.parse.urlparse(handler.path)
    params = urllib.parse.parse_qs(parsed.query)
    text = normalize_tts_text((params.get("text") or [""])[0])
    if not text:
        raise ApiError("缺少 text 参数。", status=400)
    if len(text) > MAX_TTS_CHARACTERS:
        raise ApiError("单次发音内容太长，请控制在 220 个字符以内。", status=413)

    query = urllib.parse.urlencode(
        {
            "ie": "UTF-8",
            "client": "gtx",
            "tl": resolve_tts_locale((params.get("accent") or [""])[0]),
            "q": text,
        }
    )
    request = urllib.request.Request(
        f"{GOOGLE_TTS_BASE_URL}?{query}",
        headers={
            "User-Agent": "Mozilla/5.0 IELTS Lexicon Sprint Pronunciation Proxy",
        },
        method="GET",
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = response.read()
            content_type = response.headers.get("Content-Type") or "audio/mpeg"
    except urllib.error.HTTPError as error:
        raise ApiError(f"在线发音服务返回错误：{error.code}", status=502) from error
    except urllib.error.URLError as error:
        raise ApiError(f"无法连接在线发音服务：{error.reason}", status=502) from error

    handler.send_response(200)
    write_cors_headers(handler)
    handler.send_header("Content-Type", content_type)
    handler.send_header("Cache-Control", "public, max-age=604800")
    handler.send_header("Content-Length", str(len(payload)))
    handler.end_headers()
    handler.wfile.write(payload)


def read_progress_snapshot():
    if not PROGRESS_STATE_FILE.exists():
        return {"state": None, "updatedAt": 0}

    try:
        payload = json.loads(PROGRESS_STATE_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"state": None, "updatedAt": 0}

    state_payload = payload.get("state")
    if not isinstance(state_payload, dict):
        return {"state": None, "updatedAt": 0}

    try:
        updated_at = int(payload.get("updatedAt") or state_payload.get("meta", {}).get("updatedAt") or 0)
    except (TypeError, ValueError):
        updated_at = 0

    return {"state": state_payload, "updatedAt": max(0, updated_at)}


def write_progress_snapshot(state_payload, updated_at):
    normalized_updated_at = max(0, int(updated_at or 0))
    envelope = {
        "updatedAt": normalized_updated_at,
        "state": state_payload,
    }
    temp_path = PROGRESS_STATE_FILE.with_suffix(".tmp")
    temp_path.write_text(json.dumps(envelope, ensure_ascii=False, indent=2), encoding="utf-8")
    temp_path.replace(PROGRESS_STATE_FILE)


def get_db_connection():
    connection = sqlite3.connect(CLOUD_SYNC_DB_FILE, timeout=30, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("PRAGMA foreign_keys=ON")
    return connection


def initialize_cloud_sync_db():
    with DB_LOCK:
        connection = get_db_connection()
        try:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS cloud_users (
                    normalized_id TEXT PRIMARY KEY,
                    account_id TEXT NOT NULL,
                    salt_hex TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );

                CREATE TABLE IF NOT EXISTS cloud_sessions (
                    token TEXT PRIMARY KEY,
                    normalized_id TEXT NOT NULL,
                    account_id TEXT NOT NULL,
                    issued_at INTEGER NOT NULL,
                    expires_at INTEGER NOT NULL,
                    last_active_at INTEGER NOT NULL,
                    FOREIGN KEY(normalized_id) REFERENCES cloud_users(normalized_id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS cloud_progress (
                    normalized_id TEXT PRIMARY KEY,
                    account_id TEXT NOT NULL,
                    updated_at INTEGER NOT NULL,
                    state_json TEXT,
                    saved_at INTEGER NOT NULL,
                    FOREIGN KEY(normalized_id) REFERENCES cloud_users(normalized_id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_cloud_sessions_normalized_id
                ON cloud_sessions(normalized_id);
                """
            )
            connection.commit()
        finally:
            connection.close()


def normalize_account_id(value):
    return str(value or "").strip().lower()


def normalize_session_token(value):
    return str(value or "").strip()


def hash_password(password, salt_hex):
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        str(password).encode("utf-8"),
        bytes.fromhex(salt_hex),
        200000,
        dklen=32,
    )
    return derived.hex()


def verify_password(password, user_row):
    expected = hash_password(password, user_row["salt_hex"])
    return hmac.compare_digest(expected, user_row["password_hash"])


def validate_account_id(account_id):
    normalized_id = normalize_account_id(account_id)
    if not normalized_id:
        raise ApiError("请先填写同步账号。", status=400)
    if len(normalized_id) < 3 or len(normalized_id) > 48 or not ACCOUNT_PATTERN.match(normalized_id):
        raise ApiError("同步账号请使用 3-48 位英文、数字、点号、下划线、中横线或邮箱格式。", status=400)
    return normalized_id


def validate_password(password):
    normalized_password = str(password or "")
    if len(normalized_password) < MIN_PASSWORD_LENGTH:
        raise ApiError(f"同步口令至少需要 {MIN_PASSWORD_LENGTH} 位。", status=400)
    if len(normalized_password) > MAX_PASSWORD_LENGTH:
        raise ApiError(f"同步口令最长支持 {MAX_PASSWORD_LENGTH} 位。", status=400)
    return normalized_password


def serialize_cloud_session(session_row):
    return {
        "token": session_row["token"],
        "accountId": session_row["account_id"],
        "issuedAt": int(session_row["issued_at"]),
        "expiresAt": int(session_row["expires_at"]),
        "lastActiveAt": int(session_row["last_active_at"]),
    }


def get_cloud_user(connection, normalized_id):
    return connection.execute(
        """
        SELECT normalized_id, account_id, salt_hex, password_hash, created_at, updated_at
        FROM cloud_users
        WHERE normalized_id = ?
        """,
        (normalized_id,),
    ).fetchone()


def create_cloud_session(connection, user_row):
    now = int(time.time() * 1000)
    session = {
        "token": secrets.token_urlsafe(32),
        "normalized_id": user_row["normalized_id"],
        "account_id": user_row["account_id"],
        "issued_at": now,
        "expires_at": now + CLOUD_SESSION_TTL_MS,
        "last_active_at": now,
    }
    connection.execute(
        """
        INSERT INTO cloud_sessions (token, normalized_id, account_id, issued_at, expires_at, last_active_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            session["token"],
            session["normalized_id"],
            session["account_id"],
            session["issued_at"],
            session["expires_at"],
            session["last_active_at"],
        ),
    )
    connection.commit()
    return session


def register_cloud_account(account_id, password):
    normalized_id = validate_account_id(account_id)
    normalized_password = validate_password(password)
    now = int(time.time() * 1000)
    salt_hex = secrets.token_hex(16)
    password_hash = hash_password(normalized_password, salt_hex)

    with DB_LOCK:
        connection = get_db_connection()
        try:
            existing = get_cloud_user(connection, normalized_id)
            if existing:
                raise ApiError("这个云端同步账号已经存在了，直接登录就好。", status=409)

            connection.execute(
                """
                INSERT INTO cloud_users (normalized_id, account_id, salt_hex, password_hash, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (normalized_id, normalized_id, salt_hex, password_hash, now, now),
            )
            user_row = get_cloud_user(connection, normalized_id)
            session = create_cloud_session(connection, user_row)
            return serialize_cloud_session(session)
        finally:
            connection.close()


def login_cloud_account(account_id, password):
    normalized_id = validate_account_id(account_id)
    normalized_password = validate_password(password)

    with DB_LOCK:
        connection = get_db_connection()
        try:
            user_row = get_cloud_user(connection, normalized_id)
            if not user_row or not verify_password(normalized_password, user_row):
                raise ApiError("账号或同步口令不对，请再检查一下。", status=401)
            session = create_cloud_session(connection, user_row)
            return serialize_cloud_session(session)
        finally:
            connection.close()


def logout_cloud_session(token):
    normalized_token = normalize_session_token(token)
    if not normalized_token:
        return

    with DB_LOCK:
        connection = get_db_connection()
        try:
            connection.execute("DELETE FROM cloud_sessions WHERE token = ?", (normalized_token,))
            connection.commit()
        finally:
            connection.close()


def require_cloud_session(token):
    normalized_token = normalize_session_token(token)
    if not normalized_token:
        raise ApiError("请先登录云端同步账号。", status=401)

    now = int(time.time() * 1000)
    with DB_LOCK:
        connection = get_db_connection()
        try:
            session_row = connection.execute(
                """
                SELECT token, normalized_id, account_id, issued_at, expires_at, last_active_at
                FROM cloud_sessions
                WHERE token = ?
                """,
                (normalized_token,),
            ).fetchone()

            if not session_row:
                raise ApiError("登录状态已经失效，请重新登录云端同步账号。", status=401)

            expires_at = int(session_row["expires_at"] or 0)
            if expires_at <= now:
                connection.execute("DELETE FROM cloud_sessions WHERE token = ?", (normalized_token,))
                connection.commit()
                raise ApiError("登录状态已经过期，请重新登录云端同步账号。", status=401)

            refreshed = {
                "token": session_row["token"],
                "normalized_id": session_row["normalized_id"],
                "account_id": session_row["account_id"],
                "issued_at": int(session_row["issued_at"]),
                "expires_at": now + CLOUD_SESSION_TTL_MS,
                "last_active_at": now,
            }
            connection.execute(
                """
                UPDATE cloud_sessions
                SET expires_at = ?, last_active_at = ?
                WHERE token = ?
                """,
                (refreshed["expires_at"], refreshed["last_active_at"], normalized_token),
            )
            connection.commit()
            return refreshed
        finally:
            connection.close()


def get_request_cloud_session(handler, required=False):
    token = handler.headers.get("X-Cloud-Session", "")
    account_hint = normalize_account_id(handler.headers.get("X-Cloud-Account", ""))
    normalized_token = normalize_session_token(token)
    if not normalized_token:
        if account_hint:
            raise ApiError("云端账号校验失败，请重新登录后再试。", status=401)
        return require_cloud_session(token) if required else None

    session = require_cloud_session(normalized_token)
    if account_hint and account_hint != session["account_id"]:
        raise ApiError("当前云端账号和登录会话不一致，请重新登录后再试。", status=403)
    return session


def read_cloud_progress(token):
    session = require_cloud_session(token)
    with DB_LOCK:
        connection = get_db_connection()
        try:
            row = connection.execute(
                """
                SELECT account_id, updated_at, state_json, saved_at
                FROM cloud_progress
                WHERE normalized_id = ?
                """,
                (session["normalized_id"],),
            ).fetchone()
        finally:
            connection.close()

    if not row:
        return {
            "accountId": session["account_id"],
            "updatedAt": 0,
            "state": None,
            "savedAt": 0,
        }

    try:
        state = json.loads(row["state_json"]) if row["state_json"] else None
    except json.JSONDecodeError:
        state = None

    return {
        "accountId": row["account_id"],
        "updatedAt": int(row["updated_at"] or 0),
        "state": state if isinstance(state, dict) else None,
        "savedAt": int(row["saved_at"] or 0),
    }


def write_cloud_progress(token, incoming_state, incoming_updated_at):
    if not isinstance(incoming_state, dict):
        raise ApiError("云端同步请求里缺少有效的 state 对象。", status=400)

    session = require_cloud_session(token)
    fallback_updated_at = int(incoming_state.get("meta", {}).get("updatedAt") or time.time() * 1000)
    try:
        updated_at = int(incoming_updated_at or fallback_updated_at)
    except (TypeError, ValueError):
        updated_at = fallback_updated_at

    now = int(time.time() * 1000)
    with DB_LOCK:
        connection = get_db_connection()
        try:
            current = connection.execute(
                """
                SELECT updated_at, state_json
                FROM cloud_progress
                WHERE normalized_id = ?
                """,
                (session["normalized_id"],),
            ).fetchone()

            current_updated_at = int(current["updated_at"] or 0) if current else 0
            if current and current_updated_at > updated_at:
                try:
                    current_state = json.loads(current["state_json"]) if current["state_json"] else None
                except json.JSONDecodeError:
                    current_state = None
                return {
                    "conflict": True,
                    "accountId": session["account_id"],
                    "updatedAt": current_updated_at,
                    "state": current_state if isinstance(current_state, dict) else None,
                }

            state_json = json.dumps(incoming_state, ensure_ascii=False)
            connection.execute(
                """
                INSERT INTO cloud_progress (normalized_id, account_id, updated_at, state_json, saved_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(normalized_id) DO UPDATE SET
                    account_id = excluded.account_id,
                    updated_at = excluded.updated_at,
                    state_json = excluded.state_json,
                    saved_at = excluded.saved_at
                """,
                (session["normalized_id"], session["account_id"], updated_at, state_json, now),
            )
            connection.commit()
        finally:
            connection.close()

    return {
        "conflict": False,
        "accountId": session["account_id"],
        "updatedAt": updated_at,
        "state": incoming_state,
    }


def build_multipart_body(fields, files):
    boundary = f"----CodexBoundary{uuid.uuid4().hex}"
    chunks = []

    for name, value in fields.items():
        chunks.append(f"--{boundary}\r\n".encode("utf-8"))
        chunks.append(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"))
        chunks.append(str(value).encode("utf-8"))
        chunks.append(b"\r\n")

    for file_info in files:
        chunks.append(f"--{boundary}\r\n".encode("utf-8"))
        disposition = (
            f'Content-Disposition: form-data; name="{file_info["name"]}"; '
            f'filename="{file_info["filename"]}"\r\n'
        )
        chunks.append(disposition.encode("utf-8"))
        chunks.append(f'Content-Type: {file_info["content_type"]}\r\n\r\n'.encode("utf-8"))
        chunks.append(file_info["content"])
        chunks.append(b"\r\n")

    chunks.append(f"--{boundary}--\r\n".encode("utf-8"))
    return boundary, b"".join(chunks)


def api_request(path, data, content_type, method="POST", extra_headers=None, provider=None):
    provider = normalize_provider_name(provider)
    api_key = get_provider_api_key(provider)
    if not api_key:
        raise ApiError(get_missing_key_message(provider), status=503)

    headers = {
        "Content-Type": content_type,
        "Accept": "application/json",
    }
    base_url = get_provider_base_url(provider)

    if provider == "gemini":
        if path.startswith("/chat/completions"):
            headers["Authorization"] = f"Bearer {api_key}"
            base_url = get_gemini_openai_compat_base_url()
        else:
            headers["x-goog-api-key"] = api_key
    else:
        headers["Authorization"] = f"Bearer {api_key}"

    if provider == "openrouter":
        headers["HTTP-Referer"] = sanitize_http_header_value(
            OPENROUTER_HTTP_REFERER,
            f"http://{HOST}:{PORT}",
        )
        headers["X-OpenRouter-Title"] = sanitize_http_header_value(
            OPENROUTER_TITLE,
            "IELTS Lexicon Sprint",
        )
    if extra_headers:
        headers.update(extra_headers)

    request = urllib.request.Request(
        f"{base_url}{path}",
        data=data,
        headers=headers,
        method=method,
    )

    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        try:
            payload = json.loads(detail)
            message = payload.get("error", {}).get("message") or detail
        except json.JSONDecodeError:
            message = detail
        raise ApiError(f"{get_provider_label(provider)} 接口返回错误：{message}", status=error.code) from error
    except urllib.error.URLError as error:
        raise ApiError(f"无法连接 {get_provider_label(provider)} 接口：{error.reason}", status=502) from error


def native_gemini_api_request(path, data, content_type, method="POST", extra_headers=None, provider=None):
    provider = normalize_provider_name(provider)
    api_key = get_provider_api_key(provider)
    if not api_key:
        raise ApiError(get_missing_key_message(provider), status=503)

    base_url = get_provider_base_url(provider)
    if provider == "openai" and is_aihubmix_base_url(base_url):
        base_url = get_aihubmix_gemini_base_url()

    headers = {
        "Content-Type": content_type,
        "Accept": "application/json",
        "x-goog-api-key": api_key,
    }
    if extra_headers:
        headers.update(extra_headers)

    request = urllib.request.Request(
        f"{base_url}{path}",
        data=data,
        headers=headers,
        method=method,
    )

    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        try:
            payload = json.loads(detail)
            error_payload = payload.get("error")
            if isinstance(error_payload, dict):
                message = error_payload.get("message") or detail
            else:
                message = detail
        except json.JSONDecodeError:
            message = detail
        raise ApiError(f"{get_provider_label(provider)} 接口返回错误：{message}", status=error.code) from error
    except urllib.error.URLError as error:
        raise ApiError(f"无法连接 {get_provider_label(provider)} 接口：{error.reason}", status=502) from error


def extract_openai_response_text(payload, provider="openai"):
    if payload.get("output_text"):
        return payload["output_text"]

    for output in payload.get("output", []):
        for content in output.get("content", []):
            if content.get("type") == "refusal":
                raise ApiError(content.get("refusal", "模型拒绝了这次请求。"), status=502)
            if "text" in content:
                return content["text"]

    raise ApiError(f"{get_provider_label(provider)} 返回了无法识别的响应格式。", status=502)


def extract_gemini_response_text(payload, provider=None):
    provider = normalize_provider_name(provider)
    candidates = payload.get("candidates") or []
    if not candidates:
        prompt_feedback = payload.get("promptFeedback") or payload.get("prompt_feedback") or {}
        block_reason = prompt_feedback.get("blockReason") or prompt_feedback.get("block_reason")
        if block_reason:
            raise ApiError(f"{get_provider_label(provider)} 拒绝了这次请求：{block_reason}", status=502)
        raise ApiError(f"{get_provider_label(provider)} 返回了空响应。", status=502)

    parts = []
    for candidate in candidates:
        content = candidate.get("content") or {}
        for part in content.get("parts", []):
            text = part.get("text")
            if text:
                parts.append(str(text))
    text = "\n".join(parts).strip()
    if not text:
        raise ApiError(f"{get_provider_label(provider)} 返回了无法识别的响应格式。", status=502)
    return text


def extract_chat_completion_text(payload, provider=None):
    provider = normalize_provider_name(provider)
    choices = payload.get("choices") or []
    if not choices:
        raise ApiError(f"{get_provider_label(provider)} 返回了空响应。", status=502)

    message = choices[0].get("message") or {}
    if message.get("refusal"):
        raise ApiError(message.get("refusal", "模型拒绝了这次请求。"), status=502)

    content = message.get("content", "")
    if isinstance(content, str):
        return content.strip()

    if isinstance(content, list):
        text_parts = []
        for item in content:
            if not isinstance(item, dict):
                continue
            if item.get("type") == "refusal":
                raise ApiError(item.get("refusal", "模型拒绝了这次请求。"), status=502)
            if item.get("type") in {"text", "output_text"}:
                text_value = item.get("text")
                if isinstance(text_value, dict):
                    text_value = text_value.get("value", "")
                if text_value:
                    text_parts.append(str(text_value))
        if text_parts:
            return "\n".join(text_parts).strip()

    raise ApiError(f"{get_provider_label(provider)} 返回了无法识别的响应格式。", status=502)


def parse_json_text_response(text, provider=None):
    provider = normalize_provider_name(provider)
    raw_text = str(text or "").strip()
    if not raw_text:
        raise ApiError(f"{get_provider_label(provider)} 返回了空的 JSON 文本。", status=502)

    candidates = [raw_text]
    if raw_text.startswith("```"):
        lines = raw_text.splitlines()
        if len(lines) >= 3 and lines[-1].strip().startswith("```"):
            candidates.append("\n".join(lines[1:-1]).strip())

    first_curly = raw_text.find("{")
    last_curly = raw_text.rfind("}")
    if 0 <= first_curly < last_curly:
        candidates.append(raw_text[first_curly : last_curly + 1].strip())

    for candidate in candidates:
        if not candidate:
            continue
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue

    raise ApiError(f"{get_provider_label(provider)} 返回了无法解析的 JSON 结果。", status=502)


def gemini_generate_json(model, instructions, user_input, schema_name, schema, provider="gemini"):
    provider = normalize_provider_name(provider)
    payload = {
        "systemInstruction": {
            "parts": [
                {
                    "text": instructions,
                }
            ]
        },
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": user_input,
                    }
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
            "responseJsonSchema": schema,
        },
    }
    request_fn = native_gemini_api_request if provider == "gemini" or is_aihubmix_native_gemini_model(provider, model) else api_request
    response = request_fn(
        f"/models/{model}:generateContent",
        json.dumps(payload).encode("utf-8"),
        "application/json",
        provider=provider,
    )
    return parse_json_text_response(extract_gemini_response_text(response, provider), provider)


def get_audio_format(filename, content_type):
    content_types = {
        "audio/mpeg": "mp3",
        "audio/mp3": "mp3",
        "audio/wav": "wav",
        "audio/x-wav": "wav",
        "audio/webm": "webm",
        "audio/mp4": "m4a",
        "audio/x-m4a": "m4a",
        "audio/aac": "aac",
        "audio/ogg": "ogg",
        "audio/flac": "flac",
        "audio/x-aiff": "aiff",
        "audio/aiff": "aiff",
    }
    if content_type in content_types:
        return content_types[content_type]

    suffix = pathlib.Path(filename or "").suffix.lower().lstrip(".")
    return suffix or "wav"


def structured_json_request(model, instructions, user_input, schema_name, schema, provider=None, capability=None):
    provider = normalize_provider_name(provider)
    if provider == "openrouter":
        schema_text = json.dumps(schema, ensure_ascii=False, indent=2)
        last_error = None
        for candidate_model in get_provider_model_candidates(provider, capability or "review"):
            payload = {
                "model": candidate_model,
                "messages": [
                    {"role": "system", "content": instructions},
                    {
                        "role": "user",
                        "content": (
                            f"{user_input}\n\n"
                            "只返回一个合法 JSON 对象，不要添加 markdown、解释、代码块或额外前后缀。"
                            f"\nJSON Schema 名称：{schema_name}\n"
                            f"必须满足以下 JSON Schema：\n{schema_text}"
                        ),
                    },
                ],
                "temperature": 0.2,
                "stream": False,
            }
            try:
                response = api_request(
                    "/chat/completions",
                    json.dumps(payload).encode("utf-8"),
                    "application/json",
                    provider=provider,
                )
                return parse_json_text_response(extract_chat_completion_text(response, provider), provider)
            except ApiError as error:
                last_error = error
                if error.status not in {404, 429, 500, 502, 503, 504}:
                    raise
        if last_error:
            raise last_error
        raise ApiError("OpenRouter 免费模型当前不可用，请稍后再试。", status=503)

    if provider == "gemini" or is_aihubmix_native_gemini_model(provider, model):
        last_error = None
        for candidate_model in get_provider_model_candidates(provider, capability or "review"):
            try:
                if provider != "gemini" and not is_aihubmix_native_gemini_model(provider, candidate_model):
                    continue
                return gemini_generate_json(
                    candidate_model,
                    instructions,
                    user_input,
                    schema_name,
                    schema,
                    provider=provider,
                )
            except ApiError as error:
                last_error = error
                if error.status not in {404, 429, 500, 502, 503, 504}:
                    raise
        if last_error:
            raise last_error
        raise ApiError(f"{get_provider_label(provider)} 当前不可用，请稍后再试。", status=503)

    payload = {
        "model": model,
        "instructions": instructions,
        "reasoning": {"effort": "low"},
        "input": user_input,
        "text": {
            "format": {
                "type": "json_schema",
                "name": schema_name,
                "schema": schema,
                "strict": True,
            }
        },
    }
    response = api_request(
        "/responses",
        json.dumps(payload).encode("utf-8"),
        "application/json",
        provider=provider,
    )
    return json.loads(extract_openai_response_text(response, provider))


def clamp_band(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.0
    rounded = round(number * 2) / 2
    return max(0.0, min(9.0, rounded))


def clamp_review_payload(payload):
    payload["overall_band"] = clamp_band(payload.get("overall_band"))
    breakdown = payload.get("band_breakdown", {})
    for key in [
        "fluency_coherence",
        "lexical_resource",
        "grammatical_range_accuracy",
        "pronunciation",
    ]:
        breakdown[key] = clamp_band(breakdown.get(key))
    payload["band_breakdown"] = breakdown
    payload["criterion_analysis"] = payload.get(
        "criterion_analysis",
        {
            "fluency_coherence": "",
            "lexical_resource": "",
            "grammatical_range_accuracy": "",
            "pronunciation": "",
        },
    )
    payload["strengths"] = payload.get("strengths", [])[:4]
    payload["key_issues"] = payload.get("key_issues", [])[:4]
    payload["improvement_actions"] = payload.get("improvement_actions", [])[:4]
    payload["corrections"] = payload.get("corrections", [])[:3]
    payload["recommended_materials"] = payload.get("recommended_materials", [])[:5]
    payload["grammar_patterns"] = payload.get("grammar_patterns", [])[:3]
    payload["follow_up_questions"] = payload.get("follow_up_questions", [])[:4]
    payload["part_material_pack"] = payload.get(
        "part_material_pack",
        {"topic_angles": [], "reusable_phrases": [], "content_hooks": []},
    )
    payload["part_material_pack"]["topic_angles"] = payload["part_material_pack"].get("topic_angles", [])[:4]
    payload["part_material_pack"]["reusable_phrases"] = payload["part_material_pack"].get("reusable_phrases", [])[:5]
    payload["part_material_pack"]["content_hooks"] = payload["part_material_pack"].get("content_hooks", [])[:4]
    payload["transcript_analysis"] = payload.get(
        "transcript_analysis",
        {
            "summary": "",
            "delivery_notes": [],
            "language_notes": [],
            "highlighted_snippets": [],
            "next_focus": [],
        },
    )
    payload["transcript_analysis"]["delivery_notes"] = payload["transcript_analysis"].get("delivery_notes", [])[:4]
    payload["transcript_analysis"]["language_notes"] = payload["transcript_analysis"].get("language_notes", [])[:4]
    payload["transcript_analysis"]["highlighted_snippets"] = payload["transcript_analysis"].get(
        "highlighted_snippets", []
    )[:3]
    payload["transcript_analysis"]["next_focus"] = payload["transcript_analysis"].get("next_focus", [])[:4]
    return payload


def clamp_writing_review_payload(payload):
    payload["overall_band"] = clamp_band(payload.get("overall_band"))
    breakdown = payload.get("band_breakdown", {})
    for key in [
        "task_response",
        "coherence_cohesion",
        "lexical_resource",
        "grammatical_range_accuracy",
    ]:
        breakdown[key] = clamp_band(breakdown.get(key))
    payload["band_breakdown"] = breakdown
    payload["strengths"] = payload.get("strengths", [])[:4]
    payload["key_issues"] = payload.get("key_issues", [])[:4]
    payload["improvement_actions"] = payload.get("improvement_actions", [])[:4]
    payload["focus_areas"] = payload.get("focus_areas", [])[:4]
    payload["sentence_upgrades"] = payload.get("sentence_upgrades", [])[:4]
    payload["vocabulary_upgrades"] = payload.get("vocabulary_upgrades", [])[:4]
    payload["grammar_patterns"] = payload.get("grammar_patterns", [])[:4]
    payload["paragraph_plan"] = payload.get("paragraph_plan", [])[:5]
    payload["useful_phrases"] = payload.get("useful_phrases", [])[:5]
    return payload


def clamp_mock_summary_payload(payload):
    payload["overall_band"] = clamp_band(payload.get("overall_band"))
    breakdown = payload.get("band_breakdown", {})
    for key in [
        "fluency_coherence",
        "lexical_resource",
        "grammatical_range_accuracy",
        "pronunciation",
    ]:
        breakdown[key] = clamp_band(breakdown.get(key))
    payload["band_breakdown"] = breakdown
    payload["criterion_analysis"] = payload.get(
        "criterion_analysis",
        {
            "fluency_coherence": "",
            "lexical_resource": "",
            "grammatical_range_accuracy": "",
            "pronunciation": "",
        },
    )
    payload["strengths"] = payload.get("strengths", [])[:4]
    payload["key_issues"] = payload.get("key_issues", [])[:4]
    payload["improvement_actions"] = payload.get("improvement_actions", [])[:5]
    payload["part_reports"] = payload.get("part_reports", [])[:3]
    for report in payload["part_reports"]:
        report["estimated_band"] = clamp_band(report.get("estimated_band"))
    payload["transcript_overview"] = payload.get(
        "transcript_overview",
        {
            "fluency_pattern": "",
            "vocabulary_pattern": "",
            "grammar_pattern": "",
            "pronunciation_pattern": "",
        },
    )
    payload["recommended_materials"] = payload.get("recommended_materials", [])[:6]
    payload["grammar_patterns"] = payload.get("grammar_patterns", [])[:3]
    return payload


def transcribe_audio(audio_bytes, filename, content_type, provider=None):
    provider = normalize_provider_name(provider)
    model = get_provider_model(provider, "transcribe")
    if provider == "openrouter":
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "Please transcribe this IELTS speaking test response in English. "
                                "Preserve hesitations and filler words when they are audible. "
                                "Return only the transcript text."
                            ),
                        },
                        {
                            "type": "input_audio",
                            "input_audio": {
                                "data": base64.b64encode(audio_bytes).decode("ascii"),
                                "format": get_audio_format(filename, content_type),
                            },
                        },
                    ],
                }
            ],
            "stream": False,
        }
        response = api_request(
            "/chat/completions",
            json.dumps(payload).encode("utf-8"),
            "application/json",
            provider=provider,
        )
        transcript = extract_chat_completion_text(response, provider).strip().strip('"')
        if not transcript:
            raise ApiError(f"{get_provider_label(provider)} 已接收音频，但没有返回可用的转写结果。", status=502)
        return transcript

    if provider == "gemini" or is_aihubmix_native_gemini_model(provider, model):
        resolved_content_type = content_type or mimetypes.guess_type(filename or "")[0] or "audio/mpeg"
        payload = {
            "systemInstruction": {
                "parts": [
                    {
                        "text": (
                            "Please transcribe this IELTS speaking test response in English. "
                            "Preserve hesitations and filler words when they are audible. "
                            "Return only the transcript text."
                        )
                    }
                ]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "inline_data": {
                                "mime_type": resolved_content_type,
                                "data": base64.b64encode(audio_bytes).decode("ascii"),
                            }
                        }
                    ],
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "text/plain",
            },
        }
        response = native_gemini_api_request(
            f"/models/{model}:generateContent",
            json.dumps(payload).encode("utf-8"),
            "application/json",
            provider=provider,
        )
        transcript = extract_gemini_response_text(response, provider).strip().strip('"')
        if not transcript:
            raise ApiError(f"{get_provider_label(provider)} 已接收音频，但没有返回可用的转写结果。", status=502)
        return transcript

    boundary, body = build_multipart_body(
        {
            "model": model,
            "language": "en",
            "response_format": "json",
            "prompt": "This is an IELTS speaking test response in English. Preserve hesitations and filler words when they are audible.",
        },
        [
            {
                "name": "file",
                "filename": filename,
                "content_type": content_type,
                "content": audio_bytes,
            }
        ],
    )

    payload = api_request(
        "/audio/transcriptions",
        body,
        f"multipart/form-data; boundary={boundary}",
        provider=provider,
    )
    transcript = (payload.get("text") or "").strip()
    if not transcript:
        raise ApiError(f"{get_provider_label(provider)} 已接收音频，但没有返回可用的转写结果。", status=502)
    return transcript


def review_speaking(prompt_payload, transcript, transcript_hint, local_metrics, provider=None):
    provider = normalize_provider_name(provider)
    prompt_text = json.dumps(prompt_payload, ensure_ascii=False, indent=2)
    metrics_text = json.dumps(local_metrics, ensure_ascii=False, indent=2)

    user_input = f"""
请按 IELTS Speaking 的四项维度做评估。

题目定义:
{prompt_text}

音频转写:
{transcript}

用户补充转写（如果有，可作为参考对照）:
{transcript_hint or "未提供"}

本地节奏指标:
{metrics_text}

请输出结构化结果，重点关注：
1. Fluency and Coherence
2. Lexical Resource
3. Grammatical Range and Accuracy
4. Pronunciation

反馈应明确指出最主要的问题、可执行的提升建议、更自然的表达改写，以及适合该题型继续积累的素材。
另外请额外返回：
1. 1-3 个可追踪的 grammar_patterns，用于后续累计高频语法错误。
2. 3-4 个 follow_up_questions，模拟考官下一轮可能继续追问的方向。
3. 一个 part_material_pack，根据当前是 Part 1 / 2 / 3 分别给 topic_angles、reusable_phrases、content_hooks。
4. criterion_analysis，把四个评分维度分别用中文做成简明诊断。
5. transcript_analysis，基于转写内容总结表达习惯、可取片段和下一轮转写层面的重点。
""".strip()

    parsed = structured_json_request(
        get_provider_model(provider, "review"),
        REVIEW_INSTRUCTIONS,
        user_input,
        "ielts_speaking_review",
        SPEAKING_REVIEW_SCHEMA,
        provider=provider,
        capability="review",
    )
    return clamp_review_payload(parsed)


def summarize_speaking_mock(session_parts, provider=None):
    provider = normalize_provider_name(provider)
    session_text = json.dumps(session_parts, ensure_ascii=False, indent=2)

    user_input = f"""
请把这三段口语模考汇总成一次完整的 IELTS Speaking 总评。

三段模考数据:
{session_text}

请输出结构化结果，并做到：
1. 给出整轮 overall_band 和四项分数 band_breakdown。
2. 给出 criterion_analysis，把四个评分维度分别说明。
3. 给出 3 条以内的 part_reports，概括 Part 1 / 2 / 3 各自最主要的问题和下一步重点。
4. 给出 transcript_overview，总结三段转写里反复出现的表达或节奏模式。
5. 给出 1-3 个 grammar_patterns，聚合全轮最常见的语法问题。
6. 给出 recommended_materials，优先推荐下次最值得背的通用素材。
""".strip()

    parsed = structured_json_request(
        get_provider_model(provider, "review"),
        FULL_MOCK_SUMMARY_INSTRUCTIONS,
        user_input,
        "ielts_speaking_mock_summary",
        SPEAKING_MOCK_SUMMARY_SCHEMA,
        provider=provider,
        capability="review",
    )
    return clamp_mock_summary_payload(parsed)


def review_writing(prompt_payload, essay_text, local_metrics, target_band, provider=None):
    provider = normalize_provider_name(provider)
    prompt_text = json.dumps(prompt_payload, ensure_ascii=False, indent=2)
    metrics_text = json.dumps(local_metrics, ensure_ascii=False, indent=2)

    user_input = f"""
请按 IELTS Academic Writing 的四项维度做评估。

题目定义:
{prompt_text}

考生作文:
{essay_text}

本地统计指标:
{metrics_text}

目标分数:
{target_band or "未提供"}

请输出结构化结果，重点关注：
1. Task Achievement / Task Response
2. Coherence and Cohesion
3. Lexical Resource
4. Grammatical Range and Accuracy

反馈应明确指出这篇作文最主要的问题、最值得保留的优点，以及下一轮改写时最该优先修改的地方。
另外请额外返回：
1. 2-4 个 focus_areas，使用短标签描述下一轮最需要盯住的改进方向。
2. 2-4 个 sentence_upgrades，只改写考生原文里真实存在的句子。
3. 2-4 个 vocabulary_upgrades，聚焦重复、口语化或偏弱的表达。
4. 3-5 条 paragraph_plan，告诉考生如何更好地重写这篇作文的结构。
5. 3-5 个 useful_phrases，给出适合这道题继续套用的 IELTS 写作表达。
""".strip()

    parsed = structured_json_request(
        get_provider_model(provider, "writing"),
        WRITING_REVIEW_INSTRUCTIONS,
        user_input,
        "ielts_writing_review",
        WRITING_REVIEW_SCHEMA,
        provider=provider,
        capability="writing",
    )
    return clamp_writing_review_payload(parsed)


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(SITE_DIR), **kwargs)

    def do_OPTIONS(self):
        self.send_response(204)
        write_cors_headers(self)
        self.end_headers()

    def do_GET(self):
        try:
            parsed_path = urllib.parse.urlparse(self.path)
            route_path = parsed_path.path

            if route_path == "/api/ai/status":
                active_status = get_provider_status(AI_PROVIDER)
                backend_status = {provider: get_provider_status(provider) for provider in SUPPORTED_PROVIDERS}
                json_response(
                    self,
                    {
                        **active_status,
                        "available": bool(get_api_key()),
                        "backends": backend_status,
                    },
                )
                return
            if route_path == "/api/progress/state":
                snapshot = read_progress_snapshot()
                json_response(
                    self,
                    {
                        "ok": True,
                        "updatedAt": snapshot["updatedAt"],
                        "state": snapshot["state"],
                    },
                )
                return
            if route_path == "/api/cloud-sync/state":
                session = get_request_cloud_session(self, required=True)
                snapshot = read_cloud_progress(session["token"])
                json_response(
                    self,
                    {
                        "ok": True,
                        "accountId": snapshot["accountId"],
                        "updatedAt": snapshot["updatedAt"],
                        "state": snapshot["state"],
                    },
                )
                return
            if route_path == "/api/pronunciation":
                proxy_pronunciation(self)
                return
            super().do_GET()
        except ApiError as error:
            json_response(self, {"error": error.message}, status=error.status)
        except Exception as error:
            json_response(self, {"error": f"服务内部错误：{error}"}, status=500)

    def do_POST(self):
        try:
            parsed_path = urllib.parse.urlparse(self.path)
            route_path = parsed_path.path

            if route_path == "/api/progress/state":
                payload = read_json_body(self)
                incoming_state = payload.get("state")
                if not isinstance(incoming_state, dict):
                    raise ApiError("进度同步请求里缺少有效的 state 对象。", status=400)

                try:
                    incoming_updated_at = int(
                        payload.get("updatedAt")
                        or incoming_state.get("meta", {}).get("updatedAt")
                        or int(time.time() * 1000)
                    )
                except (TypeError, ValueError):
                    incoming_updated_at = int(time.time() * 1000)

                current_snapshot = read_progress_snapshot()
                if current_snapshot["state"] and current_snapshot["updatedAt"] > incoming_updated_at:
                    json_response(
                        self,
                        {
                            "ok": True,
                            "conflict": True,
                            "updatedAt": current_snapshot["updatedAt"],
                            "state": current_snapshot["state"],
                        },
                    )
                    return

                write_progress_snapshot(incoming_state, incoming_updated_at)
                json_response(
                    self,
                    {
                        "ok": True,
                        "conflict": False,
                        "updatedAt": incoming_updated_at,
                        "state": incoming_state,
                    },
                )
                return

            if route_path == "/api/cloud-sync/auth":
                payload = read_json_body(self)
                action = str(payload.get("action") or "").strip().lower()
                if action == "register":
                    session = register_cloud_account(payload.get("accountId"), payload.get("password"))
                    json_response(
                        self,
                        {
                            "ok": True,
                            "accountId": session["accountId"],
                            "token": session["token"],
                            "expiresAt": session["expiresAt"],
                        },
                    )
                    return
                if action == "login":
                    session = login_cloud_account(payload.get("accountId"), payload.get("password"))
                    json_response(
                        self,
                        {
                            "ok": True,
                            "accountId": session["accountId"],
                            "token": session["token"],
                            "expiresAt": session["expiresAt"],
                        },
                    )
                    return
                if action == "logout":
                    logout_cloud_session(payload.get("token") or self.headers.get("X-Cloud-Session"))
                    json_response(self, {"ok": True})
                    return
                raise ApiError("不支持的云同步操作。", status=400)

            if route_path == "/api/cloud-sync/state":
                session = get_request_cloud_session(self, required=True)
                payload = read_json_body(self)
                result = write_cloud_progress(session["token"], payload.get("state"), payload.get("updatedAt"))
                json_response(
                    self,
                    {
                        "ok": True,
                        "conflict": bool(result["conflict"]),
                        "accountId": result["accountId"],
                        "updatedAt": result["updatedAt"],
                        "state": result["state"],
                    },
                )
                return

            if route_path == "/api/ai/speaking-review":
                get_request_cloud_session(self, required=False)
                form_fields, form_files = parse_multipart_form_data(self)

                if "audio" not in form_files:
                    raise ApiError("请求里缺少音频文件。", status=400)

                audio_field = form_files["audio"]
                audio_bytes = audio_field["content"]
                if not audio_bytes:
                    raise ApiError("上传的音频文件为空。", status=400)
                if len(audio_bytes) > MAX_AUDIO_BYTES:
                    raise ApiError("音频文件过大，请控制在 20MB 以内。", status=400)

                filename = audio_field["filename"] or "response.webm"
                content_type = audio_field["content_type"] or mimetypes.guess_type(filename)[0] or "application/octet-stream"
                provider = require_provider_name(
                    form_fields.get("backend") or form_fields.get("provider") or AI_PROVIDER
                )
                prompt_payload = json.loads(form_fields.get("prompt_payload", "{}"))
                transcript_hint = str(form_fields.get("transcript_hint", "")).strip()
                local_metrics_raw = form_fields.get("local_metrics", "{}")
                local_metrics = json.loads(local_metrics_raw)

                transcript = transcribe_audio(audio_bytes, filename, content_type, provider=provider)
                review = review_speaking(
                    prompt_payload,
                    transcript,
                    transcript_hint,
                    local_metrics,
                    provider=provider,
                )

                json_response(
                    self,
                    {
                        "provider": provider,
                        "provider_label": get_provider_label(provider),
                        "transcribe_model": get_provider_model(provider, "transcribe"),
                        "review_model": get_provider_model(provider, "review"),
                        "transcript": transcript,
                        "review": review,
                    },
                )
                return

            if route_path == "/api/ai/writing-review":
                get_request_cloud_session(self, required=False)
                payload = read_json_body(self)
                provider = require_provider_name(payload.get("backend") or payload.get("provider"))
                essay_text = str(payload.get("essay_text", "")).strip()
                if not essay_text:
                    raise ApiError("请求里缺少作文正文。", status=400)
                if len(essay_text) > MAX_WRITING_CHARS:
                    raise ApiError("作文内容过长，请控制在 20000 个字符以内。", status=400)

                prompt_payload = payload.get("prompt_payload") or {}
                local_metrics = payload.get("local_metrics") or {}
                target_band = payload.get("target_band")
                review = review_writing(
                    prompt_payload,
                    essay_text,
                    local_metrics,
                    target_band,
                    provider=provider,
                )

                json_response(
                    self,
                    {
                        "provider": provider,
                        "provider_label": get_provider_label(provider),
                        "review_model": get_provider_model(provider, "writing"),
                        "review": review,
                    },
                )
                return

            if route_path == "/api/ai/speaking-mock-summary":
                get_request_cloud_session(self, required=False)
                payload = read_json_body(self)
                provider = require_provider_name(payload.get("backend") or payload.get("provider") or AI_PROVIDER)
                parts = payload.get("parts") or []
                if not isinstance(parts, list) or len(parts) < 3:
                    raise ApiError("整轮模考总评需要完整的 Part 1 / 2 / 3 数据。", status=400)

                summary = summarize_speaking_mock(parts[:3], provider=provider)
                json_response(
                    self,
                    {
                        "provider": provider,
                        "provider_label": get_provider_label(provider),
                        "review_model": get_provider_model(provider, "review"),
                        "review": summary,
                    },
                )
                return

            json_response(self, {"error": "Not found"}, status=404)
        except ApiError as error:
            json_response(self, {"error": error.message}, status=error.status)
        except Exception as error:
            json_response(self, {"error": f"服务内部错误：{error}"}, status=500)


def main():
    initialize_cloud_sync_db()
    server = ThreadingHTTPServer((HOST, PORT), AppHandler)
    print(f"Serving IELTS Sprint Studio at http://{HOST}:{PORT}")
    print(
        f"Active AI provider: {get_provider_label(AI_PROVIDER)} | transcribe: {TRANSCRIBE_MODEL} | "
        f"speaking review: {REVIEW_MODEL} | writing review: {WRITING_REVIEW_MODEL}"
    )
    print(
        "Writing review backends: "
        f"OpenAI={get_provider_model('openai', 'writing')} ({'ready' if get_provider_api_key('openai') else 'missing key'}) | "
        f"OpenRouter={get_provider_model('openrouter', 'writing')} ({'ready' if get_provider_api_key('openrouter') else 'missing key'}) | "
        f"Gemini={get_provider_model('gemini', 'writing')} ({'ready' if get_provider_api_key('gemini') else 'missing key'})"
    )
    print(f"Shared progress store: {PROGRESS_STATE_FILE}")
    print(f"Cloud sync database: {CLOUD_SYNC_DB_FILE}")
    server.serve_forever()


if __name__ == "__main__":
    main()
