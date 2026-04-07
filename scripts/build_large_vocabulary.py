#!/usr/bin/env python3
import csv
import json
import math
import re
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "app.js"
CACHE_DIR = ROOT / ".cache"
SOURCE_PATH = CACHE_DIR / "ecdict.csv"
OUTPUT_PATH = ROOT / "vocabulary-generated.js"
SOURCE_URL = "https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv"

TARGET_QUOTAS = {
    "listening": 1050,
    "reading": 1100,
    "writing": 1100,
    "speaking": 1050,
}

CORE_TAGS = {"ielts", "cet4", "cet6", "toefl"}
STOP_WORDS = {
    "the",
    "and",
    "for",
    "with",
    "from",
    "into",
    "onto",
    "about",
    "between",
    "without",
    "within",
    "under",
    "over",
    "after",
    "before",
    "while",
    "where",
    "which",
    "whose",
    "there",
    "their",
    "these",
    "those",
    "them",
    "they",
    "been",
    "being",
    "were",
    "was",
    "are",
    "is",
    "am",
    "have",
    "has",
    "had",
    "will",
    "would",
    "should",
    "could",
    "may",
    "might",
    "can",
    "shall",
    "than",
    "then",
    "also",
    "very",
    "much",
    "many",
    "more",
    "most",
    "some",
    "such",
    "each",
    "every",
    "any",
    "either",
    "neither",
    "both",
    "another",
    "other",
    "others",
    "because",
    "though",
    "although",
    "however",
    "therefore",
}

CATEGORY_CN_LABELS = {
    "listening": "听力",
    "reading": "阅读",
    "writing": "写作",
    "speaking": "口语",
}

POS_LABELS = {
    "n": "n. 名词",
    "v": "v. 动词",
    "a": "adj. 形容词",
    "r": "adv. 副词",
}

SCENE_PRESETS = {
    "listening": [
        {
            "label": "校园服务",
            "tags": ["校园听力", "服务咨询"],
            "note": "适合校园通知、办公室咨询、课程安排和表格办理场景。",
            "keywords_cn": "学校 校园 学生 课程 导师 注册 申请 表格 办公室 讲座 教室 图书馆 实验室 学费 奖学金".split(),
            "keywords_en": "campus student course tutor registration application form office lecture classroom library laboratory tuition scholarship".split(),
            "examples": {
                "n": 'At the student office, "{term}" often refers to a document, place, or arrangement new students need to remember.',
                "v": 'At the student office, "{term}" may appear when staff explain what students need to do before registration is complete.',
                "a": 'At the student office, "{term}" can describe a rule, a requirement, or an arrangement students need to pay attention to.',
                "r": 'At the student office, "{term}" can show how students are expected to respond or complete a task.',
            },
        },
        {
            "label": "出行预约",
            "tags": ["旅游交通", "时间安排"],
            "note": "适合订票、改签、路线说明和活动预约类听力场景。",
            "keywords_cn": "航班 火车 巴士 机场 车站 行程 票 旅游 预订 预约 酒店 路线 时间 导游".split(),
            "keywords_en": "flight train bus airport station itinerary ticket travel booking reservation hotel route schedule guide".split(),
            "examples": {
                "n": 'In a travel-booking conversation, "{term}" often refers to a ticket, a route, or part of the travel plan.',
                "v": 'In a travel-booking conversation, "{term}" may appear when a caller changes a booking or confirms a journey.',
                "a": 'In a travel-booking conversation, "{term}" can describe the timing, status, or conditions of a trip.',
                "r": 'In a travel-booking conversation, "{term}" can show how quickly or how clearly the plan changes.',
            },
        },
        {
            "label": "住宿设施",
            "tags": ["住宿生活", "设施通知"],
            "note": "适合住宿安排、设施维修、押金费用和日常生活通知。",
            "keywords_cn": "住宿 宿舍 房间 租房 租约 押金 维修 设施 水电 餐厅 食堂 邻居 公寓".split(),
            "keywords_en": "accommodation dormitory room rent lease deposit maintenance facility electricity cafeteria neighbour apartment".split(),
            "examples": {
                "n": 'In a housing or facilities talk, "{term}" often refers to a room, a piece of equipment, or a maintenance arrangement.',
                "v": 'In a housing or facilities talk, "{term}" may appear when staff explain how to fix a problem or complete a request.',
                "a": 'In a housing or facilities talk, "{term}" can describe the condition of a room, a rule, or a service arrangement.',
                "r": 'In a housing or facilities talk, "{term}" can show how residents are expected to act or report an issue.',
            },
        },
    ],
    "reading": [
        {
            "label": "科研方法",
            "tags": ["学术阅读", "研究方法"],
            "note": "适合研究设计、实验过程、理论说明和结论判断类文章。",
            "keywords_cn": "研究 实验 理论 机制 数据 分析 模型 假设 证据 学者 统计".split(),
            "keywords_en": "research experiment theory mechanism data analysis model hypothesis evidence scholar statistics".split(),
            "examples": {
                "n": 'In an academic passage, "{term}" is often used when the writer explains a concept, a process, or a research finding.',
                "v": 'In an academic passage, "{term}" may be used when researchers describe how a process works or how evidence is interpreted.',
                "a": 'In an academic passage, "{term}" can describe data, methods, or findings in a more precise way.',
                "r": 'In an academic passage, "{term}" often shows how a change happens or how strongly a result is supported.',
            },
        },
        {
            "label": "环境生态",
            "tags": ["环境话题", "自然科学"],
            "note": "适合生态保护、资源变化、气候影响和物种演化类阅读文章。",
            "keywords_cn": "生态 环境 气候 资源 物种 生物 化石 农业 地质 进化".split(),
            "keywords_en": "ecology environment climate resource species biology fossil agriculture geology evolution".split(),
            "examples": {
                "n": 'In a passage about the environment, "{term}" often appears when the writer discusses species, resources, or climate change.',
                "v": 'In a passage about the environment, "{term}" may be used to describe how ecosystems change over time.',
                "a": 'In a passage about the environment, "{term}" can describe natural conditions, scientific patterns, or ecological risks.',
                "r": 'In a passage about the environment, "{term}" often shows how strongly or how gradually a change takes place.',
            },
        },
        {
            "label": "社会历史",
            "tags": ["历史文化", "社会议题"],
            "note": "适合历史变迁、社会结构、文化现象和行为研究类文章。",
            "keywords_cn": "历史 考古 社会 文化 语言 心理 人类 城市 社区 传统 文献".split(),
            "keywords_en": "history archaeology society culture language psychology human urban community tradition document".split(),
            "examples": {
                "n": 'In a history or society passage, "{term}" often refers to an idea, a group, or a change the writer wants to explain.',
                "v": 'In a history or society passage, "{term}" may be used when the writer explains how people, customs, or institutions changed.',
                "a": 'In a history or society passage, "{term}" can describe a social trend, a historical pattern, or a cultural feature.',
                "r": 'In a history or society passage, "{term}" often shows the degree or pace of a social change.',
            },
        },
    ],
    "writing": [
        {
            "label": "政府政策",
            "tags": ["写作表达", "政策社会"],
            "note": "适合政府职责、公共政策、社会治理和责任分配类 Task 2 表达。",
            "keywords_cn": "政府 政策 法规 责任 公共 管理 立法 犯罪 税收 平等".split(),
            "keywords_en": "government policy regulation responsibility public management legislation crime taxation equality".split(),
            "examples": {
                "n": 'In Task 2, "{term}" works well when you discuss government action, public policy, or social responsibility.',
                "v": 'In Task 2, "{term}" is useful when you explain what governments, schools, or companies should do.',
                "a": 'In Task 2, "{term}" can help you describe policies, systems, or long-term social effects more precisely.',
                "r": 'In Task 2, "{term}" can make it clearer how strongly or how fairly an action affects people.',
            },
        },
        {
            "label": "教育科技",
            "tags": ["教育话题", "科技发展"],
            "note": "适合教育改革、技术影响、媒体使用和学习方式变化类写作题。",
            "keywords_cn": "教育 技术 媒体 学习 学校 老师 学生 网络 人工智能 培训".split(),
            "keywords_en": "education technology media learning school teacher student internet artificial intelligence training".split(),
            "examples": {
                "n": 'In Task 2, "{term}" is useful when you explain how education, media, or technology affects daily life.',
                "v": 'In Task 2, "{term}" can help you describe how people learn, teach, or respond to new technology.',
                "a": 'In Task 2, "{term}" can make your description of educational or technological change sound more precise.',
                "r": 'In Task 2, "{term}" helps show how quickly or how effectively a change happens.',
            },
        },
        {
            "label": "经济环境",
            "tags": ["经济城市", "环境影响"],
            "note": "适合城市发展、经济成本、环境压力和资源分配类写作题。",
            "keywords_cn": "经济 城市 交通 污染 能源 资源 成本 投资 就业 发展".split(),
            "keywords_en": "economy city transport pollution energy resource cost investment employment development".split(),
            "examples": {
                "n": 'In Task 2, "{term}" helps when you compare economic costs, urban change, or environmental impact.',
                "v": 'In Task 2, "{term}" can be used when you explain how cities, businesses, or individuals respond to a problem.',
                "a": 'In Task 2, "{term}" can describe economic pressure, urban trends, or environmental outcomes in a more formal way.',
                "r": 'In Task 2, "{term}" can show how widely or how seriously a policy affects a city or community.',
            },
        },
    ],
    "speaking": [
        {
            "label": "人物经历",
            "tags": ["口语素材", "人物经历"],
            "note": "适合描述人物、经历、感受变化和印象最深的事件。",
            "keywords_cn": "朋友 家人 老师 人物 经历 童年 记忆 影响 性格 情绪".split(),
            "keywords_en": "friend family teacher person experience childhood memory influence personality emotion".split(),
            "examples": {
                "n": 'In Part 1 or Part 2, "{term}" is useful when you describe a person, a memory, or a meaningful experience.',
                "v": 'In Part 1 or Part 2, "{term}" can help you explain what happened and how the experience changed you.',
                "a": 'In Part 1 or Part 2, "{term}" works well when you describe a person, an event, or your feelings about it.',
                "r": 'In Part 1 or Part 2, "{term}" can make the way you describe an experience sound more natural.',
            },
        },
        {
            "label": "地点旅行",
            "tags": ["地点话题", "旅行生活"],
            "note": "适合家乡、城市、旅行、想重访的地点和生活环境题目。",
            "keywords_cn": "家乡 城市 地点 旅行 假期 邻居 街区 公园 海边 酒店".split(),
            "keywords_en": "hometown city place travel holiday neighbourhood park seaside hotel".split(),
            "examples": {
                "n": 'In Part 2, "{term}" can help you talk about a place you visited or a trip you still remember clearly.',
                "v": 'In Part 2, "{term}" is handy when you explain what you did during a trip or how you explored a place.',
                "a": 'In Part 1 or Part 2, "{term}" can describe a place, a journey, or the atmosphere of an area more vividly.',
                "r": 'In Part 1 or Part 2, "{term}" can show how often or how comfortably you travel or spend time somewhere.',
            },
        },
        {
            "label": "习惯观点",
            "tags": ["日常习惯", "观点表达"],
            "note": "适合日常习惯、个人偏好、生活方式和 Part 3 观点展开。",
            "keywords_cn": "习惯 爱好 兴趣 工作 学习 日常 食物 购物 观点 生活".split(),
            "keywords_en": "habit hobby interest work study routine food shopping opinion lifestyle".split(),
            "examples": {
                "n": 'In Part 1 or Part 3, "{term}" is useful when you explain a routine, a preference, or a personal opinion.',
                "v": 'In Part 1 or Part 3, "{term}" can help you explain what people usually do and why they do it.',
                "a": 'In Part 1 or Part 3, "{term}" can describe habits, choices, or opinions in a more natural way.',
                "r": 'In Part 1 or Part 3, "{term}" can help you sound more natural when you explain frequency or attitude.',
            },
        },
    ],
}

SCENE_SENTENCE_PARTS = {
    "校园服务": {
        "anchors": ["student office", "registration desk", "campus portal", "course handbook", "orientation session"],
        "actors": ["the administrator", "the course tutor", "the receptionist", "the programme coordinator"],
        "actions": ["finish registration on time", "find the correct classroom", "submit the form properly", "avoid missing the deadline"],
        "details": ["during enrolment week", "before the first seminar", "at the start of term", "after the orientation talk"],
    },
    "出行预约": {
        "anchors": ["booking desk", "travel centre", "departure board", "reservation email", "tour schedule"],
        "actors": ["the travel agent", "the guide", "the caller", "the booking assistant"],
        "actions": ["confirm the booking", "catch the earlier train", "follow the route correctly", "change the travel plan in time"],
        "details": ["before the weekend trip", "during the phone enquiry", "after the schedule changed", "before the final confirmation"],
    },
    "住宿设施": {
        "anchors": ["hall office", "apartment noticeboard", "maintenance request form", "front desk", "laundry room"],
        "actors": ["the housing officer", "the resident", "the maintenance staff", "the manager"],
        "actions": ["report the problem early", "collect the room key", "settle the payment", "move in without delay"],
        "details": ["before move-in day", "during the housing check", "after the repair notice", "at the end of the week"],
    },
    "科研方法": {
        "anchors": ["research paper", "methodology section", "experiment report", "data table", "journal article"],
        "actors": ["the researcher", "the author", "the report", "the passage"],
        "actions": ["interpret the findings", "follow the argument clearly", "evaluate the method", "understand the result"],
        "details": ["in the results section", "during the experiment description", "when the evidence is introduced", "near the final conclusion"],
    },
    "环境生态": {
        "anchors": ["ecology article", "climate report", "field study", "conservation project", "research summary"],
        "actors": ["the scientist", "the writer", "the report", "the study"],
        "actions": ["trace the environmental change", "compare the long-term impact", "understand the ecological risk", "explain the pattern clearly"],
        "details": ["over a long period", "in the field survey", "when climate data is compared", "while the trend is explained"],
    },
    "社会历史": {
        "anchors": ["history passage", "museum text", "social study", "archive record", "cultural report"],
        "actors": ["the historian", "the writer", "the passage", "the researcher"],
        "actions": ["explain the social change", "compare past and present life", "follow the historical development", "understand the cultural background"],
        "details": ["in the opening paragraph", "when earlier evidence is mentioned", "while different communities are compared", "near the final discussion"],
    },
    "政府政策": {
        "anchors": ["Task 2 essay", "policy discussion", "body paragraph", "argument outline", "public debate"],
        "actors": ["the writer", "the candidate", "the essay", "the argument"],
        "actions": ["support the main opinion", "explain government responsibility", "show the public impact clearly", "strengthen the central argument"],
        "details": ["in the first body paragraph", "when the opposite view is considered", "near the final recommendation", "while the main cause is discussed"],
    },
    "教育科技": {
        "anchors": ["education essay", "technology paragraph", "school example", "discussion outline", "supporting sentence"],
        "actors": ["the writer", "the student", "the teacher", "the essay"],
        "actions": ["explain how technology changes learning", "develop the example more clearly", "compare old and new methods", "support the topic sentence"],
        "details": ["when online learning is discussed", "in the supporting example", "while classroom change is described", "near the concluding sentence"],
    },
    "经济环境": {
        "anchors": ["urban essay", "cost analysis", "environment paragraph", "city example", "problem-solution response"],
        "actors": ["the writer", "the city planner", "the essay", "the argument"],
        "actions": ["compare costs and benefits", "describe the urban pressure", "explain the environmental result", "propose a workable solution"],
        "details": ["when city growth is discussed", "in the problem paragraph", "while the long-term effect is analysed", "near the final judgement"],
    },
    "人物经历": {
        "anchors": ["Part 2 answer", "personal story", "follow-up question", "memory from school", "short response"],
        "actors": ["the speaker", "the candidate", "the student", "the narrator"],
        "actions": ["describe the experience naturally", "show why the person mattered", "add a clearer personal detail", "explain the feeling more vividly"],
        "details": ["when a memory is introduced", "during the main story", "after the key event is described", "near the final reflection"],
    },
    "地点旅行": {
        "anchors": ["travel answer", "hometown topic", "holiday story", "city description", "Part 2 response"],
        "actors": ["the speaker", "the traveller", "the candidate", "the guide"],
        "actions": ["describe the place more vividly", "explain why the trip was memorable", "compare two locations naturally", "show what made the visit enjoyable"],
        "details": ["when the trip begins", "during the main description", "after the destination is introduced", "near the final reason"],
    },
    "习惯观点": {
        "anchors": ["Part 1 answer", "daily routine topic", "opinion question", "lifestyle discussion", "Part 3 response"],
        "actors": ["the speaker", "the candidate", "the interviewer", "the student"],
        "actions": ["explain the habit more clearly", "show a stronger opinion", "add a useful example", "sound more natural in the answer"],
        "details": ["when a personal habit is described", "while two choices are compared", "after the first opinion is given", "near the final explanation"],
    },
}

CATEGORY_FOLLOWUPS = {
    "listening": [
        "before the next announcement starts",
        "without asking the same question again",
        "before the queue gets longer",
        "without missing the next step",
    ],
    "reading": [
        "without losing the main point",
        "before the paragraph shifts topic",
        "while keeping the evidence clear",
        "without confusing cause and effect",
    ],
    "writing": [
        "without weakening the main argument",
        "before moving to the next paragraph",
        "while keeping the tone formal",
        "without sounding repetitive",
    ],
    "speaking": [
        "without sounding too memorised",
        "while keeping the answer natural",
        "before the idea runs out",
        "with a clearer personal detail",
    ],
}

EXAMPLE_TEMPLATES = [
    '{detail}, {actor} might mention "{term}" at the {anchor} when people need to {action} {followup}.',
    'At the {anchor}, "{term}" often comes up when the discussion turns to how to {action} {followup}.',
    'You may hear "{term}" in the {anchor} context when {actor} explains how to {action} {followup}.',
    '{actor_cap} could use "{term}" {detail} to show why people need to {action} {followup}.',
    'In this {anchor} example, "{term}" fits naturally when people are trying to {action} {followup}.',
    'The speaker may bring up "{term}" after referring to the {anchor} and the need to {action} {followup}.',
    'When the conversation reaches the {anchor}, "{term}" can help explain how people {action} {followup}.',
    '{detail}, "{term}" is a useful word if the example focuses on how people {action} at the {anchor} {followup}.',
    'A common place to see "{term}" is the {anchor}, especially when {actor} wants to {action} {followup}.',
    'The example returns to "{term}" once the focus shifts to the {anchor}, because people still need to {action} {followup}.',
    '{actor_cap} may introduce "{term}" while describing the {anchor} and the effort to {action} {followup}.',
    'Once the example reaches the {anchor}, "{term}" works well for showing how people {action} {detail} {followup}.',
]

CN_KEYWORDS = {
    "listening": "学校 校园 课程 讲座 导师 注册 预约 航班 酒店 住宿 租车 火车 飞机 票 旅游 医院 办公室 表格 申请 费用 报销 设施 图书馆 博物馆 地图 公交 机场 学生 服务 宿舍 报名 日程 通知 合同 付款 预订 交通".split(),
    "reading": "研究 科学 理论 数据 分析 生态 生物 考古 心理 历史 实验 机制 证据 化石 物种 气候 农业 地质 进化 天文 化学 数学 神经 语言 文献 模型 假设 现象 统计 学者 学科".split(),
    "writing": "政府 政策 社会 经济 教育 环境 技术 法规 投资 平等 就业 交通 污染 城市 医疗 犯罪 责任 消费 全球 税收 贫困 资源 能源 公共 立法 管理 措施 发展 影响 利益 成本".split(),
    "speaking": "家庭 家乡 朋友 旅行 爱好 兴趣 童年 习惯 邻居 人物 感受 情绪 生活 工作 学习 日常 食物 购物 礼物 地点 经历 城市 节日 运动 电影 音乐 假期 性格".split(),
}

EN_KEYWORDS = {
    "listening": "campus service booking reservation flight hostel hotel accommodation rent ticket museum library office application deadline schedule timetable lecture seminar student form clinic transport bus train airport dormitory reception payment contract route".split(),
    "reading": "research theory evidence data analysis ecology biology archaeology psychology history experiment mechanism fossil species climate agriculture geology evolution astronomy chemistry linguistics cognitive statistics scholar academic".split(),
    "writing": "government policy society economic education environment technology regulation investment inequality employment transport pollution urban medical crime responsibility consumer global taxation poverty resource energy public legislation development impact benefit cost".split(),
    "speaking": "family hometown friend travel hobby interest childhood routine neighbour people feeling emotion lifestyle work study daily food shopping gift place experience city festival sport movie music holiday personality".split(),
}

ABSTRACT_SUFFIXES = ("tion", "sion", "ment", "ity", "ance", "ence", "ism", "ist", "ology", "graphy", "ship", "tude")
FORMAL_SUFFIXES = ("ive", "ous", "able", "ible", "al", "ary", "ory", "ate", "ify")


def ensure_source():
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    if SOURCE_PATH.exists() and SOURCE_PATH.stat().st_size > 10_000_000:
        return SOURCE_PATH

    print(f"Downloading source dictionary from {SOURCE_URL}")
    SOURCE_PATH.write_bytes(urlopen(SOURCE_URL, timeout=120).read())
    return SOURCE_PATH


def parse_existing_terms():
    text = APP_JS.read_text(encoding="utf-8")
    return {match.lower() for match in re.findall(r'term: "([^"]+)"', text)}


def normalize_translation(raw_value):
    raw_value = (raw_value or "").replace("\\n", "\n")
    lines = [line.strip() for line in raw_value.splitlines() if line.strip() and "[网络]" not in line]
    if not lines:
        return ""

    cleaned = re.sub(r"^(n|v|vi|vt|adj|adv|prep|conj|pron|num|art|aux|int|a)\.\s*", "", lines[0], flags=re.I)
    cleaned = cleaned.replace(",", "；").replace(";", "；")
    cleaned = re.sub(r"\s+", " ", cleaned).strip("； ")
    parts = [part.strip() for part in cleaned.split("；") if part.strip()]
    return "；".join(parts[:2])[:40]


def detect_pos(row):
    pos = (row.get("pos") or "").lower()
    if pos:
        first = pos.split("/")[0].split(":")[0]
        if first in {"n", "v", "a", "r"}:
            return first

    translation = (row.get("translation") or "").lower()
    for prefix, code in [
        ("n.", "n"),
        ("vt.", "v"),
        ("vi.", "v"),
        ("v.", "v"),
        ("a.", "a"),
        ("adj.", "a"),
        ("ad.", "r"),
        ("adv.", "r"),
    ]:
        if translation.startswith(prefix):
            return code
    return "n"


def lemma_of(exchange, word):
    for part in (exchange or "").split("/"):
        if part.startswith("0:") and part[2:]:
            return part[2:]
    return word


def clean_phonetic(raw_value):
    phonetic = (raw_value or "").strip().strip("/")
    phonetic = re.sub(r"\s+", " ", phonetic)
    if not phonetic:
        return ""
    return f"/{phonetic}/"


def common_bonus(rank):
    if not rank:
        return 1.0
    return max(0.0, 7 - math.log10(rank + 10) * 1.8)


def build_candidate_rows(source_path, existing_terms):
    rows = []
    lemmas = set()
    with source_path.open(encoding="utf-8", errors="replace") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            word = (row.get("word") or "").strip()
            if not (word.isalpha() and word.islower() and 3 <= len(word) <= 18):
                continue
            if word in existing_terms or word in STOP_WORDS:
                continue

            tags = set((row.get("tag") or "").lower().split())
            if not (tags & CORE_TAGS):
                continue

            translation = normalize_translation(row.get("translation"))
            if not translation:
                continue

            frq = int(row.get("frq") or 0)
            bnc = int(row.get("bnc") or 0)
            if not (frq or bnc or "ielts" in tags or "toefl" in tags):
                continue

            lemma = lemma_of(row.get("exchange") or "", word)
            lemmas.add(lemma)
            rows.append(
                {
                    "word": word,
                    "lemma": lemma,
                    "phonetic": clean_phonetic(row.get("phonetic")),
                    "translation": translation,
                    "tags": tags,
                    "frq": frq,
                    "bnc": bnc,
                    "definition": (row.get("definition") or "").replace("\\n", " ").strip(),
                    "pos": detect_pos(row),
                }
            )

    # Drop inflected forms when the lemma already exists in the same candidate pool.
    return [row for row in rows if not (row["lemma"] != row["word"] and row["lemma"] in lemmas)]


def score_candidate(row):
    word = row["word"]
    tags = row["tags"]
    rank = row["frq"] or row["bnc"] or 50_000
    bonus = common_bonus(rank)
    bag_cn = f'{row["translation"]} {row["definition"]}'.lower()
    bag_en = f'{row["definition"]} {word}'.lower()

    topic_hits = {
        category: sum(1 for kw in CN_KEYWORDS[category] if kw in bag_cn)
        + sum(1 for kw in EN_KEYWORDS[category] if kw in bag_en)
        for category in CN_KEYWORDS
    }

    scores = {key: 0.0 for key in TARGET_QUOTAS}
    scores["listening"] = topic_hits["listening"] * 8 + bonus + (3 if tags & {"cet4", "cet6"} else 0) + (2 if row["pos"] in {"n", "v"} else 0)
    scores["speaking"] = topic_hits["speaking"] * 8 + bonus + (3 if tags & {"cet4", "cet6"} else 0) + (2 if row["pos"] in {"v", "a", "r"} else 0)
    scores["reading"] = topic_hits["reading"] * 8 + (3 if tags & {"ielts", "toefl"} else 0) + (2 if row["pos"] in {"n", "a"} else 0) + (2 if word.endswith(ABSTRACT_SUFFIXES) else 0)
    scores["writing"] = topic_hits["writing"] * 8 + (3 if tags & {"ielts", "toefl"} else 0) + (2 if row["pos"] in {"n", "a"} else 0) + (2 if word.endswith(ABSTRACT_SUFFIXES + FORMAL_SUFFIXES) else 0)

    if max(topic_hits.values()) == 0:
        if row["pos"] == "v":
            scores["listening"] += 1.5
            scores["speaking"] += 1.5
        elif row["pos"] == "a":
            scores["speaking"] += 1.5
            scores["writing"] += 1.5
        else:
            scores["reading"] += 1.5
            scores["writing"] += 1.5

    category_eligible = {
        "listening": topic_hits["listening"] > 0 or (tags & {"cet4", "cet6"} and bonus >= 1.2 and row["pos"] in {"n", "v", "a"}),
        "speaking": topic_hits["speaking"] > 0 or (tags & {"cet4", "cet6"} and bonus >= 1.2 and row["pos"] in {"n", "v", "a", "r"}),
        "reading": topic_hits["reading"] > 0 or (tags & {"ielts", "toefl"} and (word.endswith(ABSTRACT_SUFFIXES) or row["pos"] in {"n", "a"})),
        "writing": topic_hits["writing"] > 0 or ((tags & {"ielts", "toefl", "cet6"}) and (word.endswith(ABSTRACT_SUFFIXES + FORMAL_SUFFIXES) or row["pos"] in {"n", "a"})),
    }

    base = (5 if "ielts" in tags else 0) + (4 if "toefl" in tags else 0) + (3 if "cet6" in tags else 0) + (2 if "cet4" in tags else 0) + bonus

    return {
        **row,
        "scores": scores,
        "eligible": category_eligible,
        "base": base,
        "rank": rank,
    }


def select_candidates(candidates):
    selected = {category: [] for category in TARGET_QUOTAS}
    used_words = set()

    # Reserve category-specific words first so the labels stay meaningful.
    for category in ["listening", "speaking", "writing", "reading"]:
        ranked = sorted(
            (candidate for candidate in candidates if candidate["eligible"][category]),
            key=lambda item: (-item["scores"][category], -item["base"], item["rank"], item["word"]),
        )
        for candidate in ranked:
            if candidate["word"] in used_words:
                continue
            selected[category].append(candidate)
            used_words.add(candidate["word"])
            if len(selected[category]) >= TARGET_QUOTAS[category]:
                break

    if all(len(selected[category]) >= TARGET_QUOTAS[category] for category in TARGET_QUOTAS):
        return selected

    fallback = sorted(
        candidates,
        key=lambda item: (-max(item["scores"].values()), -item["base"], item["rank"], item["word"]),
    )

    for category in TARGET_QUOTAS:
        for candidate in fallback:
            if len(selected[category]) >= TARGET_QUOTAS[category]:
                break
            if candidate["word"] in used_words:
                continue
            selected[category].append(candidate)
            used_words.add(candidate["word"])

    return selected


def pick_scene(category, candidate):
    bag = f'{candidate["translation"]} {candidate["definition"]} {candidate["word"]}'.lower()
    presets = SCENE_PRESETS[category]
    best_scene = presets[0]
    best_score = -1

    for scene in presets:
        score = sum(1 for kw in scene["keywords_cn"] if kw in bag) + sum(1 for kw in scene["keywords_en"] if kw in bag)
        if score > best_score:
            best_score = score
            best_scene = scene

    return best_scene


def format_part_of_speech(pos_code):
    return POS_LABELS.get(pos_code, "n. 名词")


def stable_seed(*values):
    text = "|".join(str(value) for value in values)
    total = 0
    for char in text:
        total = (total * 131 + ord(char)) % 1_000_003
    return total


def pick_variant(options, seed, offset=0):
    return options[(seed + offset) % len(options)]


def capitalize_fragment(value):
    if not value:
        return value
    return value[0].upper() + value[1:]


def build_scene_example(category, candidate, scene):
    parts = SCENE_SENTENCE_PARTS[scene["label"]]
    actor = pick_variant(parts["actors"], stable_seed(category, scene["label"], candidate["word"], "actor"), 1)
    anchor = pick_variant(parts["anchors"], stable_seed(category, scene["label"], candidate["word"], "anchor"), 2)
    action = pick_variant(parts["actions"], stable_seed(category, scene["label"], candidate["word"], "action"), 3)
    detail = pick_variant(parts["details"], stable_seed(category, scene["label"], candidate["word"], "detail"), 4)
    followup = pick_variant(CATEGORY_FOLLOWUPS[category], stable_seed(category, scene["label"], candidate["word"], "followup"), 5)
    template = pick_variant(EXAMPLE_TEMPLATES, stable_seed(category, scene["label"], candidate["word"], candidate["translation"], "template"), 6)
    sentence = template.format(
        term=candidate["word"],
        actor=actor,
        actor_cap=capitalize_fragment(actor),
        anchor=anchor,
        action=action,
        detail=detail,
        followup=followup,
    )
    return capitalize_fragment(sentence)


def build_entry(category, candidate):
    scene = pick_scene(category, candidate)
    tags = [CATEGORY_CN_LABELS[category], *scene["tags"], "高频扩展"]
    return {
        "id": f'bulk-{category}-{candidate["word"]}',
        "category": category,
        "kind": "word",
        "term": candidate["word"],
        "phonetic": candidate["phonetic"],
        "partOfSpeech": format_part_of_speech(candidate["pos"]),
        "translation": candidate["translation"],
        "note": scene["note"],
        "example": build_scene_example(category, candidate, scene),
        "tags": tags,
    }


def main():
    source_path = ensure_source()
    existing_terms = parse_existing_terms()
    raw_candidates = build_candidate_rows(source_path, existing_terms)
    scored_candidates = [score_candidate(candidate) for candidate in raw_candidates]
    selected = select_candidates(scored_candidates)

    entries = []
    counts = {}
    for category in ["listening", "reading", "writing", "speaking"]:
        entries.extend(build_entry(category, candidate) for candidate in selected[category])
        counts[category] = len(selected[category])

    payload = (
        "// Generated from ECDICT (MIT License): https://github.com/skywind3000/ECDICT\n"
        "// This file is generated by scripts/build_large_vocabulary.py\n"
        f"window.__LEXICON_LARGE_VOCABULARY__ = {json.dumps(entries, ensure_ascii=False, indent=2)};\n"
    )
    OUTPUT_PATH.write_text(payload, encoding="utf-8")

    total = sum(counts.values())
    print(f"Generated {total} new word entries -> {OUTPUT_PATH}")
    for category, count in counts.items():
        print(f"  {category}: {count}")


if __name__ == "__main__":
    main()
