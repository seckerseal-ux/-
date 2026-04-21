#!/usr/bin/env python3
import json
import re
from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError as exc:
    raise SystemExit("Missing dependency: pypdf. Install it with `python3 -m pip install --user pypdf`.") from exc


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "speaking-bank-generated.js"
DEFAULT_PART1_PDF = Path.home() / "Downloads" / "周思成雅思口语题库整理 Part 1.pdf"
DEFAULT_PART23_PDF = Path.home() / "Downloads" / "周思成雅思口语题库整理 Part 2 & Part 3.pdf"

PART1_SECTION_LABELS = {
    "经历类": "experience",
    "偏好类": "preference",
    "观点类": "opinion",
    "常识/描述类": "fact",
}
PART1_PICK_ORDER = ["experience", "preference", "opinion", "fact"]
QUESTION_STARTERS = ("What ", "Why ", "Do ", "How ", "Who ", "When ", "Where ", "Is ", "Are ", "Should ", "Can ", "Will ")
CUE_STARTERS = QUESTION_STARTERS + ("Whether ", "Whose ", "And explain")
WATERMARK_SNIPPETS = ("周思成雅思", "愿雅思助大家打开通向世界的大门！", "愿雅思助你打开通向世界的大门！")

DEFAULT_PART1_MATERIALS = ["To be honest,...", "In my case,...", "What I like most is...", "It depends, but..."]
DEFAULT_PART2_MATERIALS = [
    "What stands out to me is that...",
    "Another point worth mentioning is that...",
    "To give a bit more detail,...",
    "The main reason I remember it so clearly is that...",
]
DEFAULT_PART3_MATERIALS = ["From my perspective,...", "A key reason is that...", "For example,...", "in the long run"]

THEME_MATERIALS = [
    {
        "keywords": "home accommodation hometown area city house apartment neighborhood neighbourhood room countryside building library flowers".split(),
        "part1": ["within walking distance", "a close-knit community", "peace and quiet", "well-connected"],
        "part2": ["memorable", "peace and quiet", "well worth visiting", "leave a strong impression on me"],
        "part3": ["urban planning", "housing pressure", "public facilities", "quality of life"],
    },
    {
        "keywords": "work study school teacher teachers student major library geography sports morning routine weekends hobby reading books".split(),
        "part1": ["play a crucial role in", "be better equipped to", "on a regular basis", "keep improving"],
        "part2": ["step out of my comfort zone", "a turning point", "That experience taught me that...", "leave a lasting impact on me"],
        "part3": ["practical skills", "long-term development", "set a good example", "social expectations"],
    },
    {
        "keywords": "mobile phone photos social media computer tablet technology electronic devices internet app text messages".split(),
        "part1": ["rely on", "keep in touch with", "on a daily basis", "time-consuming"],
        "part2": ["come in handy", "part of daily life", "easy to access", "worth recommending"],
        "part3": ["digital habits", "screen time", "keep up with", "potential downside"],
    },
    {
        "keywords": "music musical instruments singer party snacks jewelry gifts t-shirt clothes shopping machine birthday".split(),
        "part1": ["be keen on", "part of daily life", "a popular choice", "for practical reasons"],
        "part2": ["full of atmosphere", "a personal favourite", "I was drawn to it because...", "Another reason is that..."],
        "part3": ["consumer habits", "personal taste", "social occasions", "changing trends"],
    },
    {
        "keywords": "environment recycle recycling animal animals countryside quiet noise outdoor sport sports venue".split(),
        "part1": ["healthy lifestyle", "get some fresh air", "environmentally friendly", "part of my routine"],
        "part2": ["refreshing", "get away from the noise", "close to nature", "clear my mind"],
        "part3": ["raise awareness of", "environmental protection", "community impact", "sustainable choice"],
    },
    {
        "keywords": "food foreign food transportation transport shop store website second-hand photo discussion decision promise late".split(),
        "part1": ["cost-effective", "convenient", "fit into my schedule", "a common habit"],
        "part2": ["I still remember it clearly", "to be more specific,...", "that was the moment when...", "for one thing,..."],
        "part3": ["consumer behaviour", "daily convenience", "practical solution", "public response"],
    },
    {
        "keywords": "person people friend friends energetic celebrity famous singer colleague grandparent grandparents feelings clothes".split(),
        "part1": ["easy to talk to", "get along with", "leave a strong impression on", "full of energy"],
        "part2": ["inspiring", "the reason I remember this person so clearly is that...", "a big influence on me", "someone I really look up to"],
        "part3": ["personality traits", "social pressure", "role model", "different generations"],
    },
]


def slugify(text):
    cleaned = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return cleaned[:36] or "topic"


def format_describe_title(text):
    title = re.sub(r"\s+", " ", str(text or "")).strip().rstrip(".")
    if not title:
        return ""
    if title.lower().startswith("describe "):
        return title[:1].upper() + title[1:]
    return f"Describe {title}"


def extract_pdf_text(path):
    reader = PdfReader(str(path))
    return "\n".join((page.extract_text() or "") for page in reader.pages)


def clean_source_text(text):
    cleaned_lines = []
    for raw_line in text.splitlines():
        line = raw_line
        for snippet in WATERMARK_SNIPPETS:
            line = line.replace(snippet, "")
        line = re.sub(r"\s+", " ", line).strip()
        if not line:
            continue
        if re.fullmatch(r"\d+", line):
            continue
        if re.fullmatch(r"\d+\s*口语题库", line):
            continue
        if line in {"Part 1", "Part 2 & 3", "经典题", "新题", "地点类", "人物类", "经历类", "经历类 Experience-based"}:
            continue
        cleaned_lines.append(line)
    return "\n".join(cleaned_lines)


def is_marker_line(line):
    return (
        line.startswith("【")
        or line.startswith("PART 1")
        or line.startswith("PART 2")
        or line.startswith("PART 3")
        or any(line.startswith(label) for label in PART1_SECTION_LABELS)
        or line == "You should say:"
    )


def is_question_line(line):
    stripped = line.lstrip("• ").strip()
    return stripped.startswith(QUESTION_STARTERS) or stripped.endswith("?")


def build_logical_lines(block):
    logical = []
    for raw_line in block.splitlines():
        line = re.sub(r"\s+", " ", raw_line).strip()
        if not line:
            continue
        if logical:
            previous = logical[-1]
            if previous.startswith("•") and not is_marker_line(line) and not line.startswith("•"):
                logical[-1] = f"{previous} {line}".strip()
                continue
            if (
                previous.startswith(CUE_STARTERS)
                and not previous.endswith("?")
                and not is_marker_line(line)
                and not line.startswith(CUE_STARTERS)
            ):
                logical[-1] = f"{previous} {line}".strip()
                continue
            if previous.startswith("Describe ") and line != "You should say:" and not is_marker_line(line):
                logical[-1] = f"{previous} {line}".strip()
                continue
        logical.append(line)
    return logical


def detect_part1_section(line):
    for label, key in PART1_SECTION_LABELS.items():
        if line.startswith(label):
            return key
    return None


def pick_materials(topic_text, part, defaults):
    bag = topic_text.lower()
    chosen = []
    for theme in THEME_MATERIALS:
        if any(keyword in bag for keyword in theme["keywords"]):
            chosen.extend(theme[part])
        if len(chosen) >= 4:
            break
    unique = []
    for item in chosen + defaults:
        if item not in unique:
            unique.append(item)
    return unique[:4]


def derive_part1_angles(questions):
    rules = [
        ("过去经历", lambda q: q.startswith(("Have you", "Did you", "When did", "How long"))),
        ("个人偏好", lambda q: any(term in q for term in ("Do you like", "Do you prefer", "favourite", "favorite", "Would you like", "What kind"))),
        ("原因解释", lambda q: any(term in q for term in ("Why", "What makes", "How has", "What are the benefits"))),
        ("未来变化", lambda q: any(term in q for term in ("future", "next five years", "Will ", "Would you like"))),
        ("描述细节", lambda q: any(term in q for term in ("Please describe", "What do you usually", "Where", "Who"))),
        ("个人观点", lambda q: any(term in q for term in ("Do you think", "Should", "important"))),
    ]
    picked = []
    for label, matcher in rules:
        if any(matcher(question) for question in questions) and label not in picked:
            picked.append(label)
    return (picked or ["短回答", "补原因", "加例子", "说自然"])[:4]


def derive_part2_angles(cue_points):
    labels = []
    for line in cue_points:
        if line.startswith(("Who ", "Where ", "When ")):
            labels.append("背景信息")
        elif line.startswith(("How ",)):
            labels.append("过程细节")
        elif line.startswith(("What ", "Whether ")):
            labels.append("内容展开")
        elif line.startswith("And explain"):
            labels.append("感受与原因")
    unique = []
    for label in labels + ["背景信息", "具体细节", "个人感受", "总结原因"]:
        if label not in unique:
            unique.append(label)
    return unique[:4]


def select_balanced_part1_questions(section_map, max_items=5):
    selected = []
    cursors = {key: 0 for key in PART1_PICK_ORDER}

    for key in PART1_PICK_ORDER:
        items = section_map.get(key, [])
        if items:
            selected.append(items[0])
            cursors[key] = 1

    while len(selected) < max_items:
        added = False
        for key in PART1_PICK_ORDER:
            items = section_map.get(key, [])
            if cursors[key] < len(items):
                selected.append(items[cursors[key]])
                cursors[key] += 1
                added = True
                if len(selected) >= max_items:
                    break
        if not added:
            break

    return selected[:max_items]


def parse_part1_prompts(text):
    prompts = []
    counter = 1
    for block in re.split(r"(?=【\d+】)", text):
        lines = build_logical_lines(block)
        if not lines or not lines[0].startswith("【"):
            continue
        title_cn = re.sub(r"^【\d+】\s*", "", lines[0]).strip()
        part_line = next((line for line in lines if line.startswith("PART 1")), "")
        if not part_line:
            continue
        title_en = part_line.replace("PART 1", "", 1).strip()

        section_map = {key: [] for key in PART1_PICK_ORDER}
        current_section = "fact"
        for line in lines[1:]:
            section_key = detect_part1_section(line)
            if section_key:
                current_section = section_key
                continue
            if line.startswith("•"):
                section_map[current_section].append(line[1:].strip())

        questions = select_balanced_part1_questions(section_map)
        if not questions:
            continue

        prompts.append(
            {
                "id": f"pdf-part1-{counter:02d}-{slugify(title_en)}",
                "part": "part1",
                "title": title_cn,
                "intro": "Part 1 建议每题用 2-4 句回答，并顺手补一个原因或小例子。",
                "questions": questions,
                "targetDuration": {"min": 90, "max": 140},
                "materials": pick_materials(f"{title_cn} {title_en} {' '.join(questions)}", "part1", DEFAULT_PART1_MATERIALS),
                "angles": derive_part1_angles(questions),
                "source": "周思成雅思口语题库 Part 1",
                "sourceTitleEn": title_en,
            }
        )
        counter += 1
    return prompts


def split_question_sentences(text):
    return [re.sub(r"\s+", " ", match.group(0)).strip() for match in re.finditer(r"(?:What|Why|Do|How|Who|When|Where|Is|Are|Should|Can|Will)\s+.*?\?", text)]


def parse_part23_prompts(text):
    part2_prompts = []
    part3_prompts = []
    counter = 1
    for block in re.split(r"(?=【\d+】)", text):
        lines = build_logical_lines(block)
        if not lines or not lines[0].startswith("【"):
            continue
        title_cn = re.sub(r"^【\d+】\s*", "", lines[0]).strip()
        if "PART 2" not in lines or "PART 3" not in lines:
            continue

        joined = " ".join(lines)
        describe_match = re.search(r"Describe\s+(.+?)\s+You should say:", joined)
        if not describe_match:
            continue
        describe_title = re.sub(r"\s+", " ", describe_match.group(1)).strip().rstrip(".")
        full_part2_title = format_describe_title(describe_title)

        part3_start = lines.index("PART 3")
        describe_line_index = next((i for i, line in enumerate(lines) if line.startswith("Describe ")), None)
        part3_segment = " ".join(lines[part3_start + 1 : describe_line_index or len(lines)])
        part3_questions = split_question_sentences(part3_segment)[:5]

        cue_start = next((i for i, line in enumerate(lines) if line == "You should say:"), None)
        cue_points = []
        if cue_start is not None:
            for line in lines[cue_start + 1 :]:
                if line.startswith("【") or line.startswith("PART "):
                    break
                if line.startswith(CUE_STARTERS):
                    cue_points.append(line.rstrip("."))
            cue_points = cue_points[:5]

        if cue_points:
            part2_prompts.append(
                {
                    "id": f"pdf-part2-{counter:02d}-{slugify(describe_title)}",
                    "part": "part2",
                    "title": full_part2_title,
                    "topicTitle": title_cn,
                    "intro": "Cue Card 建议按提示词讲清背景、细节、感受和原因。",
                    "questions": cue_points,
                    "targetDuration": {"min": 95, "max": 135},
                    "materials": pick_materials(f"{title_cn} {describe_title} {' '.join(cue_points)}", "part2", DEFAULT_PART2_MATERIALS),
                    "angles": derive_part2_angles(cue_points),
                    "source": "周思成雅思口语题库 Part 2 & Part 3",
                    "sourceTitleEn": describe_title,
                }
            )

        if part3_questions:
            part3_prompts.append(
                {
                    "id": f"pdf-part3-{counter:02d}-{slugify(title_cn)}",
                    "part": "part3",
                    "title": f"{title_cn} · 深挖讨论",
                    "topicTitle": title_cn,
                    "intro": "Part 3 尽量给观点、原因和例子，再补一层延伸影响。",
                    "questions": part3_questions,
                    "targetDuration": {"min": 120, "max": 180},
                    "materials": pick_materials(f"{title_cn} {describe_title} {' '.join(part3_questions)}", "part3", DEFAULT_PART3_MATERIALS),
                    "angles": ["观点", "原因", "例子", "延伸影响"],
                    "source": "周思成雅思口语题库 Part 2 & Part 3",
                    "sourceTitleEn": describe_title,
                }
            )
        counter += 1

    return {"part2": part2_prompts, "part3": part3_prompts}


def main():
    if not DEFAULT_PART1_PDF.exists():
        raise SystemExit(f"Missing source PDF: {DEFAULT_PART1_PDF}")
    if not DEFAULT_PART23_PDF.exists():
        raise SystemExit(f"Missing source PDF: {DEFAULT_PART23_PDF}")

    part1_text = clean_source_text(extract_pdf_text(DEFAULT_PART1_PDF))
    part23_text = clean_source_text(extract_pdf_text(DEFAULT_PART23_PDF))

    payload = {
        "part1": parse_part1_prompts(part1_text),
        **parse_part23_prompts(part23_text),
    }

    output = (
        "// Generated from local IELTS speaking PDFs.\n"
        "// This file is generated by scripts/build_speaking_bank_from_pdfs.py\n"
        f"window.__LEXICON_SPEAKING_BANK__ = {json.dumps(payload, ensure_ascii=False, indent=2)};\n"
    )
    OUTPUT_PATH.write_text(output, encoding="utf-8")

    print(f"Generated speaking prompts -> {OUTPUT_PATH}")
    print(f"  part1: {len(payload['part1'])}")
    print(f"  part2: {len(payload['part2'])}")
    print(f"  part3: {len(payload['part3'])}")


if __name__ == "__main__":
    main()
