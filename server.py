#!/usr/bin/env python3
import base64
import cgi
import json
import mimetypes
import os
import pathlib
import time
import urllib.error
import urllib.request
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

BASE_DIR = pathlib.Path(__file__).resolve().parent
SITE_DIR = BASE_DIR
PROGRESS_STATE_FILE = BASE_DIR / ".ielts-lexicon-sprint-progress.json"


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

HOST = os.getenv("HOST", "127.0.0.1")
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
        "transcribe": "gemini-2.5-flash",
        "review": "gemini-2.5-flash",
        "writing": "gemini-2.5-flash",
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
    "transcribe": ("gemini-2.5-flash", "gemini-2.5-flash-lite"),
    "review": ("gemini-2.5-flash", "gemini-2.5-flash-lite"),
    "writing": ("gemini-2.5-flash", "gemini-2.5-flash-lite"),
}
SUPPORTED_PROVIDERS = tuple(DEFAULT_PROVIDER_BASE_URLS.keys())


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
    if os.getenv("GEMINI_API_KEY", "").strip():
        return "gemini"
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
MAX_AUDIO_BYTES = 20 * 1024 * 1024
MAX_WRITING_CHARS = 20000

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
    return os.getenv("OPENAI_API_KEY", "").strip() or (
        os.getenv("AI_API_KEY", "").strip() if AI_PROVIDER == "openai" else ""
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


def gemini_generate_json(model, instructions, user_input, schema_name, schema):
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
    response = api_request(
        f"/models/{model}:generateContent",
        json.dumps(payload).encode("utf-8"),
        "application/json",
        provider="gemini",
    )
    return parse_json_text_response(extract_gemini_response_text(response, "gemini"), "gemini")


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

    if provider == "gemini":
        last_error = None
        for candidate_model in get_provider_model_candidates(provider, capability or "review"):
            try:
                return gemini_generate_json(candidate_model, instructions, user_input, schema_name, schema)
            except ApiError as error:
                last_error = error
                if error.status not in {404, 429, 500, 502, 503, 504}:
                    raise
        if last_error:
            raise last_error
        raise ApiError("Gemini 当前不可用，请稍后再试。", status=503)

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
    if provider in {"openrouter", "gemini"}:
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
        if self.path == "/api/ai/status":
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
        if self.path == "/api/progress/state":
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
        super().do_GET()

    def do_POST(self):
        try:
            if self.path == "/api/progress/state":
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

            if self.path == "/api/ai/speaking-review":
                form = cgi.FieldStorage(
                    fp=self.rfile,
                    headers=self.headers,
                    environ={
                        "REQUEST_METHOD": "POST",
                        "CONTENT_TYPE": self.headers.get("Content-Type", ""),
                        "CONTENT_LENGTH": self.headers.get("Content-Length", "0"),
                    },
                    keep_blank_values=True,
                )

                if "audio" not in form:
                    raise ApiError("请求里缺少音频文件。", status=400)

                audio_field = form["audio"]
                if not getattr(audio_field, "file", None):
                    raise ApiError("上传的音频文件无效。", status=400)

                audio_bytes = audio_field.file.read()
                if not audio_bytes:
                    raise ApiError("上传的音频文件为空。", status=400)
                if len(audio_bytes) > MAX_AUDIO_BYTES:
                    raise ApiError("音频文件过大，请控制在 20MB 以内。", status=400)

                filename = audio_field.filename or "response.webm"
                content_type = audio_field.type or mimetypes.guess_type(filename)[0] or "application/octet-stream"
                provider = require_provider_name(form.getfirst("backend") or form.getfirst("provider") or AI_PROVIDER)
                prompt_payload = json.loads(form.getfirst("prompt_payload", "{}"))
                transcript_hint = form.getfirst("transcript_hint", "").strip()
                local_metrics_raw = form.getfirst("local_metrics", "{}")
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

            if self.path == "/api/ai/writing-review":
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

            if self.path == "/api/ai/speaking-mock-summary":
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
    server.serve_forever()


if __name__ == "__main__":
    main()
