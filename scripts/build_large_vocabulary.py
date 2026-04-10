#!/usr/bin/env python3
import csv
import json
import math
import re
from pathlib import Path
from urllib.request import urlopen

try:
    from pypdf import PdfReader
except Exception:
    PdfReader = None

ROOT = Path(__file__).resolve().parents[1]
APP_JS = ROOT / "app.js"
CACHE_DIR = ROOT / ".cache"
SOURCE_PATH = CACHE_DIR / "ecdict.csv"
OUTPUT_PATH = ROOT / "vocabulary-generated.js"
SOURCE_URL = "https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv"
PDF_SOURCE_PATHS = [
    Path.home() / "Downloads" / "雅思一万词汇班(1).pdf",
]

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

PDF_PRIORITY_SCALE = 3

PDF_THEME_CATEGORY_BOOSTS = {
    "scientific research": {"reading": 6, "writing": 4, "listening": 3},
    "scientific processes": {"reading": 6, "writing": 4, "listening": 3},
    "substances&qualities": {"reading": 5, "writing": 4, "listening": 2},
    "the environment": {"reading": 6, "writing": 5, "listening": 3, "speaking": 2},
    "chemistry": {"reading": 5, "writing": 3, "listening": 2},
    "physics": {"reading": 5, "writing": 3, "listening": 2},
    "applied sciences": {"reading": 5, "writing": 4, "listening": 3},
    "biology & medicine": {"reading": 6, "writing": 4, "listening": 3},
    "biological processes& research": {"reading": 6, "writing": 4, "listening": 3},
    "plants& animals": {"reading": 5, "writing": 3, "listening": 2, "speaking": 2},
    "health": {"reading": 5, "writing": 5, "listening": 3, "speaking": 2},
    "physical geography": {"reading": 5, "writing": 4, "listening": 2, "speaking": 2},
    "sociology": {"writing": 6, "reading": 5, "speaking": 3},
    "business": {"writing": 6, "reading": 4, "speaking": 2, "listening": 2},
    "law": {"writing": 6, "reading": 4, "speaking": 2},
    "art": {"speaking": 4, "reading": 4, "writing": 3},
    "history": {"reading": 5, "writing": 4, "speaking": 3},
    "actions& processes": {"writing": 5, "speaking": 3, "reading": 3},
    "size&amount": {"writing": 5, "speaking": 4, "reading": 3},
    "opinion，uncertainty & probability": {"writing": 7, "speaking": 5, "reading": 3},
    "linking words": {"writing": 8, "speaking": 3, "reading": 2},
    "research methods": {"reading": 7, "writing": 5, "listening": 2},
}

PDF_MANUAL_PRIORITY = {
    "allocate": {"writing": 7, "reading": 3},
    "consensus": {"writing": 6, "speaking": 4, "reading": 3},
    "cumulative": {"reading": 5, "writing": 5},
    "empirical": {"reading": 6, "writing": 5},
    "fieldwork": {"reading": 7, "writing": 5},
    "meticulous": {"writing": 4, "speaking": 3},
    "myriad": {"writing": 4, "speaking": 3, "reading": 3},
    "nominal": {"reading": 5, "writing": 5},
    "parameter": {"reading": 7, "writing": 5},
    "pragmatic": {"writing": 6, "speaking": 5},
    "protocol": {"reading": 6, "writing": 4, "listening": 3},
    "salient": {"reading": 6, "writing": 6},
    "stance": {"writing": 6, "speaking": 5},
    "superfluous": {"writing": 5, "reading": 4},
}

BLOCKED_TERMS = {
    "ammunition",
    "assassin",
    "assassination",
    "artillery",
    "bomber",
    "cannon",
    "executioner",
    "genocide",
    "genocidal",
    "grenade",
    "homicide",
    "kidnap",
    "kidnapping",
    "manslaughter",
    "militant",
    "militia",
    "missile",
    "mortar",
    "murder",
    "murderer",
    "obituary",
    "obsequies",
    "rifle",
    "slaughter",
    "supremacist",
    "supremacism",
    "sycophant",
    "terrorism",
    "terrorist",
    "torpedo",
    "truculent",
    "warhead",
    "wanton",
    "weapon",
}

BLOCKED_CN_SNIPPETS = {
    "暗杀",
    "谋杀",
    "火炮",
    "刺客",
    "炮兵",
    "鱼雷",
    "弹药",
    "武器",
    "导弹",
    "手榴弹",
    "迫击炮",
    "凶手",
    "恐怖主义",
    "绑架",
    "处决",
    "种族灭绝",
    "屠杀",
    "葬礼",
    "讣告",
    "种族优越主义",
    "阿谀奉承者",
    "爱吵架的",
    "淫荡的",
}

BLOCKED_EN_SNIPPETS = {
    "ammunition",
    "assassin",
    "assassination",
    "artillery",
    "executioner",
    "funeral",
    "genocide",
    "grenade",
    "homicide",
    "kidnap",
    "manslaughter",
    "militant",
    "militia",
    "missile",
    "mortar",
    "murder",
    "murderer",
    "obituary",
    "rifle",
    "slaughter",
    "supremacist",
    "sycophant",
    "terrorism",
    "terrorist",
    "torpedo",
    "truculent",
    "warhead",
    "wanton",
    "weapon",
}

CATEGORY_BLOCKED_TERMS = {
    "writing": {
        "assassin",
        "assassination",
        "accessory",
        "apartment",
        "cabinet",
        "criminal",
        "costume",
        "decoration",
        "depot",
        "drawer",
        "execution",
        "executioner",
        "garment",
        "genocide",
        "genocidal",
        "helmet",
        "homicide",
        "host",
        "implement",
        "kidnap",
        "kidnapping",
        "luggage",
        "manslaughter",
        "murder",
        "murderer",
        "nonviolence",
        "outfit",
        "portfolio",
        "slaughter",
        "terrorism",
        "terrorist",
        "ticket",
        "violence",
        "wallet",
        "wardrobe",
    },
}

WRITING_CONCRETE_CN_SNIPPETS = {
    "附件",
    "零件",
    "皮夹",
    "抽屉",
    "橱柜",
    "衣服",
    "衣装",
    "装束",
    "衣橱",
    "公寓",
    "停车场",
    "配件",
    "行李",
    "头盔",
    "公文包",
    "装饰品",
    "门票",
    "箱",
    "钱包",
}

WRITING_CONCRETE_EN_SNIPPETS = {
    "accessory",
    "apartment",
    "cabinet",
    "costume",
    "cupboard",
    "decoration",
    "depot",
    "drawer",
    "garment",
    "helmet",
    "luggage",
    "outfit",
    "portfolio",
    "shelf",
    "suitcase",
    "ticket",
    "wallet",
    "wardrobe",
}

TERM_OVERRIDES = {
    "adolescent": {
        "category": "writing",
        "translation": "青少年的；青少年",
        "example": "Adolescent mental health has become a major public concern in many cities.",
        "note": "教育、家庭和青少年发展类写作高频。",
    },
    "aesthetic": {
        "category": "speaking",
        "translation": "审美的；美观的",
        "example": "Many people value the aesthetic appeal of historic buildings in their city.",
        "note": "建筑、设计和艺术审美类口语常用。",
    },
    "aesthetics": {
        "category": "speaking",
        "translation": "美学；审美风格",
        "example": "The cafe combines traditional details with modern aesthetics.",
        "note": "设计、建筑和艺术品味类口语常用。",
    },
    "aforementioned": {
        "category": "writing",
        "translation": "上述的；前文提到的",
        "example": "The aforementioned measures would help reduce pressure on public hospitals.",
        "note": "承接前文观点和举措时的正式写作连接词。",
    },
    "assertion": {
        "category": "writing",
        "translation": "断言；主张",
        "example": "The essay challenges the assertion that technology can solve every educational problem.",
        "note": "评价观点、反驳论断类写作高频。",
    },
    "collaborate": {
        "category": "reading",
        "translation": "合作；协作",
        "example": "Universities often collaborate with local businesses on research projects.",
        "note": "科研合作、项目协作和研究方法类阅读高频。",
    },
    "collaboration": {
        "category": "reading",
        "translation": "合作；协作",
        "example": "The article highlights collaboration between scientists from different countries.",
        "note": "科研合作和跨机构项目类阅读高频。",
    },
    "collate": {
        "category": "reading",
        "translation": "整理比对；汇编",
        "example": "The researchers collated the survey data before analysing the results.",
        "note": "数据整理、研究步骤和实验流程类阅读高频。",
    },
    "contention": {
        "category": "writing",
        "translation": "论点；争论",
        "example": "My main contention is that cities need better public transport rather than more roads.",
        "note": "提出中心论点、展开争议话题类写作高频。",
    },
    "census": {
        "category": "writing",
        "translation": "人口普查；统计调查",
        "example": "A regular census helps governments plan schools, transport, and healthcare more effectively.",
        "note": "人口结构、公共服务和社会规划类写作高频。",
    },
    "curator": {
        "category": "speaking",
        "translation": "策展人；馆长",
        "example": "The curator explained why the exhibition was arranged around a single theme.",
        "note": "博物馆、展览和艺术话题口语常用。",
    },
    "demography": {
        "category": "reading",
        "translation": "人口统计学；人口结构研究",
        "example": "The passage links demography to changing household size and migration patterns.",
        "note": "社会结构、人口变化和统计研究类阅读高频。",
    },
    "discourse": {
        "category": "writing",
        "translation": "论述；话语体系",
        "example": "Public discourse on education has shifted towards equal access and quality.",
        "note": "社会讨论、公共议题和正式论述类写作常用。",
    },
    "discretion": {
        "category": "writing",
        "translation": "自主决定权；谨慎",
        "example": "Teachers should have some discretion in how they adapt lessons to different classes.",
        "note": "规则执行、权责分配和制度设计类写作常用。",
    },
    "ecosystem": {
        "category": "reading",
        "translation": "生态系统",
        "example": "Protecting one ecosystem can also benefit nearby farmland and water sources.",
        "note": "环境、生态平衡和生物多样性类阅读高频。",
    },
    "empirical": {
        "category": "writing",
        "translation": "以实证为基础的；经验性的",
        "example": "The conclusion should be supported by empirical evidence rather than personal opinion.",
        "note": "论证证据、研究依据和学术写作类高频。",
    },
    "fieldwork": {
        "category": "reading",
        "translation": "实地调查；田野调查",
        "example": "The researchers carried out fieldwork in three rural communities.",
        "note": "研究方法、田野调查和实证研究类阅读高频。",
    },
    "gauge": {
        "category": "listening",
        "translation": "测量仪器；衡量标准",
        "example": "In the lecture, the professor used a simple gauge to measure changes in air pressure.",
        "note": "实验仪器、测量过程和学术讲座类听力常见。",
    },
    "figurative": {
        "category": "speaking",
        "translation": "比喻性的；形象化的",
        "example": "The poem uses figurative language to express uncertainty and loss.",
        "note": "艺术、文学和表达方式类口语常用。",
    },
    "metaphor": {
        "category": "reading",
        "translation": "隐喻；比喻说法",
        "example": "The passage explains how the writer uses metaphor to describe social change.",
        "note": "文学、修辞和文化类阅读常见表达。",
    },
    "nonetheless": {
        "category": "writing",
        "translation": "尽管如此；不过",
        "example": "The plan is expensive; nonetheless, many residents still support it.",
        "note": "让步转折和衔接论证类写作高频连接词。",
    },
    "parameter": {
        "category": "reading",
        "translation": "参数；界限",
        "example": "Cost is only one parameter when governments evaluate public projects.",
        "note": "数据分析、变量控制和研究方法类阅读高频。",
    },
    "pragmatic": {
        "category": "writing",
        "translation": "务实的；实际的",
        "example": "A pragmatic solution would be to improve buses before expanding the underground network.",
        "note": "提出实际可行方案时的写作高频词。",
    },
    "protocol": {
        "category": "reading",
        "translation": "协议；规程",
        "example": "The lab followed a strict protocol to ensure the results were reliable.",
        "note": "实验流程、技术规范和研究步骤类阅读高频。",
    },
    "salient": {
        "category": "writing",
        "translation": "显著的；突出的",
        "example": "One salient problem is the widening gap between urban and rural schools.",
        "note": "概括关键问题、突出核心特征类写作高频。",
    },
    "ritual": {
        "category": "speaking",
        "translation": "仪式；传统惯例",
        "example": "In my hometown, family meals during festivals have become a small ritual for us.",
        "note": "节日、传统和文化习惯类口语常用。",
    },
    "stance": {
        "category": "writing",
        "translation": "立场；态度",
        "example": "My stance is that public money should be spent on essential services first.",
        "note": "表达立场、评价争议话题类写作高频。",
    },
}

SCENE_PRESETS = {
    "listening": [
        {
            "label": "校园服务",
            "tags": ["校园听力", "服务咨询"],
            "note": "校园通知、注册和表格办理场景高频。",
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
            "label": "学术讲座",
            "tags": ["学术听力", "讲座笔记"],
            "note": "学术讲座、实验介绍和科研说明场景高频。",
            "keywords_cn": "研究 实验 数据 图表 讲座 教授 方法 样本 结果 理论 模型 过程 学术 科研 变量".split(),
            "keywords_en": "research experiment data chart lecture professor method sample result theory model process academic variable laboratory protocol parameter fieldwork".split(),
            "examples": {
                "n": 'In a lecture, "{term}" often refers to a concept, a stage, or a piece of evidence students need to note down.',
                "v": 'In a lecture, "{term}" may appear when a professor explains how a study is carried out or how results are interpreted.',
                "a": 'In a lecture, "{term}" can describe a method, a result, or a research feature in a more precise way.',
                "r": 'In a lecture, "{term}" often shows how clearly or how strongly a change is explained.',
            },
        },
        {
            "label": "出行预约",
            "tags": ["旅游交通", "时间安排"],
            "note": "订票、改签和路线说明场景高频。",
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
            "note": "住宿安排、设施维修和押金费用高频。",
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
            "note": "研究设计、实验过程和结论判断高频。",
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
            "note": "环境、资源和气候变化类阅读高频。",
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
            "note": "历史变迁、社会结构和文化现象高频。",
            "keywords_cn": "历史 考古 社会 文化 语言 心理 人类 城市 社区 传统 文献".split(),
            "keywords_en": "history archaeology society culture language psychology human urban community tradition document".split(),
            "examples": {
                "n": 'In a history or society passage, "{term}" often refers to an idea, a group, or a change the writer wants to explain.',
                "v": 'In a history or society passage, "{term}" may be used when the writer explains how people, customs, or institutions changed.',
                "a": 'In a history or society passage, "{term}" can describe a social trend, a historical pattern, or a cultural feature.',
                "r": 'In a history or society passage, "{term}" often shows the degree or pace of a social change.',
            },
        },
        {
            "label": "艺术人文",
            "tags": ["文化艺术", "人文阅读"],
            "note": "艺术、展览和文化现象类阅读高频。",
            "keywords_cn": "艺术 审美 展览 博物馆 诗歌 文学 设计 电影 绘画 隐喻 文化".split(),
            "keywords_en": "art aesthetic exhibition museum poetry literature design film painting metaphor curator imagery genre culture".split(),
            "examples": {
                "n": 'In an arts or culture passage, "{term}" often refers to a concept, a feature, or a role the writer wants to explain.',
                "v": 'In an arts or culture passage, "{term}" may be used to describe how an artist, writer, or curator presents an idea.',
                "a": 'In an arts or culture passage, "{term}" can describe style, meaning, or visual effect more precisely.',
                "r": 'In an arts or culture passage, "{term}" often shows how strongly an effect is created or interpreted.',
            },
        },
    ],
    "writing": [
        {
            "label": "政府政策",
            "tags": ["写作表达", "政策社会"],
            "note": "政府、政策和社会治理类写作高频。",
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
            "note": "教育、媒体和科技影响类写作高频。",
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
            "note": "城市发展、经济成本和环境压力类写作高频。",
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
            "note": "人物、经历和感受表达高频。",
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
            "note": "家乡、城市和旅行题高频。",
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
            "label": "文化艺术",
            "tags": ["艺术话题", "文化表达"],
            "note": "艺术、展览和审美体验类口语常用。",
            "keywords_cn": "艺术 审美 设计 展览 博物馆 电影 建筑 绘画 文学 音乐 文化".split(),
            "keywords_en": "art aesthetic design exhibition museum film architecture painting literature music culture curator metaphor imagery".split(),
            "examples": {
                "n": 'In Part 2 or Part 3, "{term}" is useful when you talk about a museum, a design style, or an artistic experience.',
                "v": 'In Part 2 or Part 3, "{term}" can help you explain how a film, a building, or an exhibition affected you.',
                "a": 'In Part 2 or Part 3, "{term}" can describe the style, atmosphere, or visual appeal of something more vividly.',
                "r": 'In Part 2 or Part 3, "{term}" can show how strongly you reacted to a cultural experience.',
            },
        },
        {
            "label": "习惯观点",
            "tags": ["日常习惯", "观点表达"],
            "note": "日常习惯、个人偏好和观点展开高频。",
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
    "writing": "government policy society economic education environment technology regulation investment inequality employment transport pollution urban medical crime responsibility consumer global taxation poverty resource energy public legislation development impact benefit cost budget welfare infrastructure subsidy housing allocation efficiency authority priority stance debate argument funding reform opportunity income expenditure".split(),
    "speaking": "family hometown friend travel hobby interest childhood routine neighbour people feeling emotion lifestyle work study daily food shopping gift place experience city festival sport movie music holiday personality".split(),
}

ABSTRACT_SUFFIXES = ("tion", "sion", "ment", "ity", "ance", "ence", "ism", "ist", "ology", "graphy", "ship", "tude")
FORMAL_SUFFIXES = ("ive", "ous", "able", "ible", "al", "ary", "ory", "ate", "ify")


def normalize_pdf_text(text):
    return (
        (text or "")
        .replace("ﬁ", "fi")
        .replace("ﬂ", "fl")
        .replace("’", "'")
        .replace("“", '"')
        .replace("”", '"')
        .replace("–", "-")
        .replace("—", "-")
        .replace("\u3000", " ")
    )


def detect_pdf_theme(page_text):
    lowered = normalize_pdf_text(page_text).lower()
    for theme in sorted(PDF_THEME_CATEGORY_BOOSTS, key=len, reverse=True):
        if theme in lowered:
            return theme
    return None


def extract_pdf_headwords(page_text):
    words = set()
    for raw_line in normalize_pdf_text(page_text).splitlines():
        line = re.sub(r"\s+", " ", raw_line).strip()
        if not line or not line[0].isascii() or not line[0].isalpha():
            continue
        lowered = line.lower()
        if lowered.startswith("word clusters") or lowered.startswith("the most difficult words in ielts"):
            continue
        match = re.match(r"^([A-Za-z][A-Za-z-]{2,24})(?=\s*(?:\||\[|\(|n\.|vt\.|vi\.|v\.|a\.|adj\.|adv\.|uc|cn|$))", line)
        if not match:
            continue
        word = match.group(1).lower()
        if not word.isalpha() or word in STOP_WORDS:
            continue
        words.add(word)
    return words


def load_pdf_priority_terms():
    priority = {}
    if PdfReader is None:
        return priority

    for source_path in PDF_SOURCE_PATHS:
        if not source_path.exists():
            continue
        reader = PdfReader(str(source_path))
        for page in reader.pages:
            text = normalize_pdf_text(page.extract_text() or "")
            theme = detect_pdf_theme(text)
            boosts = PDF_THEME_CATEGORY_BOOSTS.get(theme)
            if not boosts:
                continue
            for word in extract_pdf_headwords(text):
                bucket = priority.setdefault(word, {category: 0 for category in TARGET_QUOTAS})
                for category, weight in boosts.items():
                    bucket[category] += weight

    for word, boosts in PDF_MANUAL_PRIORITY.items():
        bucket = priority.setdefault(word, {category: 0 for category in TARGET_QUOTAS})
        for category, weight in boosts.items():
            bucket[category] += weight
    return priority


def is_blocked_term(word, translation="", definition=""):
    lowered_word = (word or "").lower()
    if lowered_word in BLOCKED_TERMS:
        return True

    bag_cn = f"{translation}".lower()
    bag_en = f"{definition} {word}".lower()
    return any(snippet in bag_cn for snippet in BLOCKED_CN_SNIPPETS) or any(snippet in bag_en for snippet in BLOCKED_EN_SNIPPETS)


def is_category_blocked_term(category, word, translation="", definition=""):
    lowered_word = (word or "").lower()
    if lowered_word in CATEGORY_BLOCKED_TERMS.get(category, set()):
        return True

    bag = f"{word} {translation} {definition}".lower()
    if category == "writing":
        if any(snippet in translation for snippet in WRITING_CONCRETE_CN_SNIPPETS):
            return True
        if any(snippet in bag for snippet in WRITING_CONCRETE_EN_SNIPPETS):
            return True
        risk_snippets = (
            "assassin",
            "assassination",
            "execution",
            "executioner",
            "genocide",
            "homicide",
            "kidnap",
            "murder",
            "murderer",
            "terrorism",
            "terrorist",
            "violence",
            "暗杀",
            "谋杀",
            "凶手",
            "恐怖主义",
            "绑架",
            "处决",
            "种族灭绝",
            "暴力",
        )
        return any(snippet in bag for snippet in risk_snippets)
    return False


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


def build_candidate_rows(source_path, existing_terms, pdf_priority_terms):
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
            if is_blocked_term(word, row.get("translation") or "", row.get("definition") or ""):
                continue

            tags = set((row.get("tag") or "").lower().split())
            if not (tags & CORE_TAGS or word in pdf_priority_terms):
                continue

            translation = normalize_translation(row.get("translation"))
            if not translation:
                continue

            frq = int(row.get("frq") or 0)
            bnc = int(row.get("bnc") or 0)
            if not (frq or bnc or "ielts" in tags or "toefl" in tags or word in pdf_priority_terms):
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


def score_candidate(row, pdf_priority):
    word = row["word"]
    tags = row["tags"]
    rank = row["frq"] or row["bnc"] or 50_000
    bonus = common_bonus(rank)
    bag_cn = f'{row["translation"]} {row["definition"]}'.lower()
    bag_en = f'{row["definition"]} {word}'.lower()
    pdf_boosts = pdf_priority.get(word, {})
    override = TERM_OVERRIDES.get(word, {})
    override_category = override.get("category")

    topic_hits_cn = {
        category: sum(1 for kw in CN_KEYWORDS[category] if kw in bag_cn)
        for category in CN_KEYWORDS
    }
    topic_hits_en = {
        category: sum(1 for kw in EN_KEYWORDS[category] if kw in bag_en)
        for category in EN_KEYWORDS
    }
    topic_hits = {
        category: topic_hits_cn[category] + topic_hits_en[category]
        for category in CN_KEYWORDS
    }

    abstract_noun_signal = row["pos"] == "n" and word.endswith(ABSTRACT_SUFFIXES)
    formal_adjective_signal = row["pos"] == "a" and word.endswith(ABSTRACT_SUFFIXES + FORMAL_SUFFIXES)
    writing_formal_signal = abstract_noun_signal or formal_adjective_signal

    scores = {key: 0.0 for key in TARGET_QUOTAS}
    scores["listening"] = topic_hits["listening"] * 8 + bonus + (3 if tags & {"cet4", "cet6"} else 0) + (2 if row["pos"] in {"n", "v"} else 0)
    scores["speaking"] = topic_hits["speaking"] * 8 + bonus + (3 if tags & {"cet4", "cet6"} else 0) + (2 if row["pos"] in {"v", "a", "r"} else 0)
    scores["reading"] = topic_hits["reading"] * 8 + (3 if tags & {"ielts", "toefl"} else 0) + (2 if row["pos"] in {"n", "a"} else 0) + (2 if word.endswith(ABSTRACT_SUFFIXES) else 0)
    scores["writing"] = (
        topic_hits_cn["writing"] * 9
        + topic_hits_en["writing"] * 4
        + (3 if tags & {"ielts", "toefl"} else 0)
        + (2 if row["pos"] in {"n", "a"} else 0)
        + (2 if writing_formal_signal else 0)
    )

    for category in TARGET_QUOTAS:
        scores[category] += pdf_boosts.get(category, 0) * PDF_PRIORITY_SCALE
        if is_category_blocked_term(category, row["word"], row["translation"], row["definition"]):
            scores[category] -= 80

    if override_category:
        for category in TARGET_QUOTAS:
            scores[category] += 60 if category == override_category else -4

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
        "listening": topic_hits["listening"] > 0 or pdf_boosts.get("listening", 0) >= 2 or (bool(tags & {"cet4", "cet6"}) and bonus >= 1.2 and row["pos"] in {"n", "v", "a"}),
        "speaking": topic_hits["speaking"] > 0 or pdf_boosts.get("speaking", 0) >= 2 or (bool(tags & {"cet4", "cet6"}) and bonus >= 1.2 and row["pos"] in {"n", "v", "a", "r"}),
        "reading": topic_hits["reading"] > 0 or pdf_boosts.get("reading", 0) >= 2 or (bool(tags & {"ielts", "toefl"}) and (word.endswith(ABSTRACT_SUFFIXES) or row["pos"] in {"n", "a"})),
        "writing": topic_hits_cn["writing"] > 0 or pdf_boosts.get("writing", 0) >= 2 or (bool(tags & {"ielts", "toefl", "cet6"}) and writing_formal_signal),
    }

    if override_category:
        category_eligible = {category: category == override_category for category in TARGET_QUOTAS}
    else:
        for category in TARGET_QUOTAS:
            if is_category_blocked_term(category, row["word"], row["translation"], row["definition"]):
                category_eligible[category] = False

    base = (5 if "ielts" in tags else 0) + (4 if "toefl" in tags else 0) + (3 if "cet6" in tags else 0) + (2 if "cet4" in tags else 0) + bonus + sum(pdf_boosts.values()) * 0.5 + (20 if override_category else 0)

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

    preferred_order = ["writing", "reading", "speaking", "listening"]

    def preferred_category(candidate):
        eligible = [category for category in preferred_order if candidate["eligible"][category]]
        if not eligible:
            return None
        return max(
            eligible,
            key=lambda category: (
                candidate["scores"][category],
                -preferred_order.index(category),
            ),
        )

    primary_ranked = sorted(
        [item for item in candidates if any(item["eligible"].values())],
        key=lambda item: (
            -max(item["scores"][category] for category in TARGET_QUOTAS if item["eligible"][category]),
            -item["base"],
            item["rank"],
            item["word"],
        ),
    )

    for candidate in primary_ranked:
        if candidate["word"] in used_words:
            continue
        category = preferred_category(candidate)
        if not category or len(selected[category]) >= TARGET_QUOTAS[category]:
            continue
        selected[category].append(candidate)
        used_words.add(candidate["word"])

    if all(len(selected[category]) >= TARGET_QUOTAS[category] for category in TARGET_QUOTAS):
        return selected

    fallback = sorted(
        candidates,
        key=lambda item: (-max(item["scores"].values()), -item["base"], item["rank"], item["word"]),
    )

    for category in preferred_order:
        category_fallback = [item for item in fallback if item["eligible"].get(category)]
        for candidate in category_fallback:
            if len(selected[category]) >= TARGET_QUOTAS[category]:
                break
            if candidate["word"] in used_words:
                continue
            selected[category].append(candidate)
            used_words.add(candidate["word"])

        if len(selected[category]) >= TARGET_QUOTAS[category]:
            continue

        for candidate in fallback:
            if len(selected[category]) >= TARGET_QUOTAS[category]:
                break
            if candidate["word"] in used_words:
                continue
            if is_category_blocked_term(category, candidate["word"], candidate["translation"], candidate["definition"]):
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


SEMANTIC_KEYWORDS = {
    "person": "人 人员 老师 学生 管理员 助手 官员 职员 导游 旅客 研究者 学者 居民 家长 朋友 librarian teacher student manager officer guide passenger researcher scholar resident parent friend worker staff".split(),
    "place": "地点 地方 场所 机场 车站 办公室 教室 宿舍 图书馆 大厅 中心 公寓 城市 家乡 公园 海边 房间 工作室 airport station office classroom dormitory library hall centre center apartment city hometown park seaside room venue museum clinic campus studio".split(),
    "money": "费用 成本 预算 资金 投资 税收 收入 支出 学费 fee cost budget funding investment tax income expense tuition rent salary".split(),
    "document": "文件 表格 门票 票据 收据 证件 申请 讲义 通知 行程 手册 form ticket receipt document application handout notice schedule handbook record certificate bill".split(),
    "event": "活动 课程 讲座 会议 预约 预订 行程 比赛 节日 seminar lecture workshop class meeting appointment reservation trip event festival session course tour".split(),
    "transport": "交通 火车 巴士 航班 船 路线 站点 机场 旅行 列车 车票 train bus flight ship route stop airport travel railway transport".split(),
    "research": "研究 实验 数据 理论 模型 假设 证据 分析 结果 study experiment data theory model hypothesis evidence analysis result method finding".split(),
    "environment": "环境 生态 资源 气候 物种 污染 能源 生物 ecology environment resource climate species pollution energy wildlife habitat biodiversity".split(),
    "policy": "政策 政府 法规 公共 制度 责任 管理 立法 policy government regulation public system responsibility management legislation law measure".split(),
    "emotion": "情绪 感受 记忆 印象 习惯 爱好 偏好 emotion feeling memory impression habit hobby preference attitude".split(),
    "abstract": "解释 说明 报告 讨论 概述 过程 影响 变化 结果 原因 效果 观点 现象 规律 账户 账目 account explanation report discussion overview process impact change result cause effect concept issue pattern description summary".split(),
}

VERB_HINTS = {
    "change": "推迟 延期 更改 调整 改变 转移 转让 转换 postpone delay reschedule transfer change alter shift convert replace move".split(),
    "submit": "提交 申请 登记 注册 确认 预约 预订 报名 submit apply register enrol enroll confirm reserve book sign".split(),
    "contact": "联系 咨询 解释 说明 通知 提醒 汇报 报告 call contact ask report explain inform remind notify".split(),
    "research": "分析 观察 测量 评估 研究 比较 识别 explain analyse analyze observe measure evaluate compare identify examine investigate".split(),
    "resource": "分配 拨给 投入 资助 供应 allocate devote channel fund invest finance provide".split(),
    "control": "限制 规范 监管 施加 impose regulate restrict ban control monitor supervise".split(),
    "support": "促进 鼓励 提倡 支持 改善 提升 promote encourage advocate support improve enhance foster".split(),
    "reduce": "缓解 减少 降低 减轻 控制 ease mitigate reduce lower relieve tackle curb".split(),
    "travel": "到达 出发 旅行 预订 取消 赶上 导航 arrive depart travel reserve cancel catch navigate board".split(),
    "personal": "喜欢 享受 回忆 描述 欣赏 分享 练习 prefer enjoy remember describe admire share practise practice".split(),
    "negative": "受苦 遭受 忍受 受害 suffer endure undergo struggle".split(),
    "communication": "解释 描述 表达 说明 讨论 分享 mention explain describe express discuss share present".split(),
}

ADJECTIVE_HINTS = {
    "person_trait": "友好 善良 耐心 和蔼 严厉 自信 礼貌 热情 冷静 外向 内向 可靠 affable friendly kind patient strict confident polite warm calm outgoing introverted reliable cheerful".split(),
    "interest": "热衷 热爱的 感兴趣 keen avid enthusiastic passionate interested fond devoted".split(),
    "place_quality": "安静 热闹 现代 方便 拥挤 宽敞 舒适 漂亮 吸引人 scenic quiet lively modern convenient crowded spacious comfortable beautiful attractive peaceful historic urban rural".split(),
    "event_atmosphere": "节日 节庆 假日 holiday festival festive seasonal".split(),
    "change_quality": "逐渐 稳定 显著 明显 微小 substantial significant dramatic noticeable steady gradual minor rapid".split(),
    "evaluative": "有效 实用 重要 必要 合理 可行 经济 负担得起 持续 灵活 useful effective important essential reasonable feasible affordable sustainable flexible practical efficient beneficial".split(),
}

SCENE_SENTENCE_LIBRARY = {
    "校园服务": {
        "noun": {
            "person": [
                "The {term} will explain the registration steps after the lecture.",
                "If you are unsure about the form, ask the {term} at the front desk.",
            ],
            "place": [
                "The {term} is open from nine to four on weekdays.",
                "Students need to visit the {term} before collecting their ID cards.",
            ],
            "document": [
                "Please submit the {term} to the student office before Friday.",
                "The handbook explains where to find the {term} online.",
            ],
            "money": [
                "The {term} must be paid before the enrolment deadline.",
                "Students were told that the {term} could be paid online.",
            ],
            "event": [
                "The {term} begins in the main hall at nine o'clock.",
                "Everyone attending the {term} should arrive ten minutes early.",
            ],
            "abstract": [
                "The tutor gave a clear {term} of the new registration rules.",
                "Students asked for a fuller {term} of the course requirements.",
            ],
            "general": [
                "The notice includes important information about the {term}.",
                "Students discussed the {term} during the orientation session.",
            ],
        },
        "verb": {
            "change": [
                "The tutor decided to {term} the workshop until next week.",
                "The department may {term} the timetable if too many students complain.",
            ],
            "submit": [
                "Students need to {term} the form before the first lecture.",
                "You should {term} your place online before Friday afternoon.",
            ],
            "contact": [
                "Please {term} the office if you have any questions about registration.",
                "Students were asked to {term} the department by email.",
            ],
            "general": [
                "First-year students often need to {term} the details more than once.",
                "The tutor asked everyone to {term} the information carefully.",
            ],
        },
        "adjective": [
            "Attendance at the safety session is {term} for all first-year students.",
            "The new arrangement seems {term}, so students should read the notice carefully.",
        ],
        "adverb": [
            "The form should be completed {term} and returned today.",
            "Students were advised to check the timetable {term} before the course started.",
        ],
    },
    "学术讲座": {
        "noun": {
            "research": [
                "The lecturer introduced the {term} before comparing the two studies.",
                "Students were asked to note the {term} in the final part of the lecture.",
            ],
            "abstract": [
                "The professor gave a clear {term} of the method used in the experiment.",
                "The lecture returned to the {term} when the results were explained.",
            ],
            "general": [
                "The lecturer mentioned the {term} while describing the research process.",
                "Students wrote down the {term} as soon as it appeared on the slide.",
            ],
        },
        "verb": {
            "research": [
                "The professor used the chart to {term} the difference between the two groups.",
                "The lecture explained how researchers {term} the results over time.",
            ],
            "general": [
                "The lecturer tried to {term} the main idea with a simple example.",
                "Students need to {term} the evidence carefully before answering the question.",
            ],
        },
        "adjective": [
            "The speaker described the method as {term} enough for a large-scale study.",
            "It was a {term} feature of the experiment, so students were told to underline it.",
        ],
        "adverb": [
            "The process was explained {term} in the second half of the lecture.",
            "The data were presented {term}, which made the trend easy to follow.",
        ],
    },
    "出行预约": {
        "noun": {
            "place": [
                "The coach to the {term} leaves every half hour.",
                "We headed straight to the {term} after leaving the city centre.",
            ],
            "document": [
                "Please keep the {term} until the end of your journey.",
                "The assistant checked the {term} before printing the receipt.",
            ],
            "transport": [
                "The last {term} to the city centre leaves at 10:15.",
                "They missed the earlier {term} because of the heavy traffic.",
            ],
            "money": [
                "There is an extra {term} if you change the booking at the last minute.",
                "The traveller was told that the {term} was included in the final price.",
            ],
            "event": [
                "Your {term} was confirmed by email that evening.",
                "The guide checked the {term} before the tour began.",
            ],
            "abstract": [
                "The guide gave a brief {term} of the travel plan before departure.",
                "We received a clear {term} of the route and the meeting point.",
            ],
            "general": [
                "The receptionist explained the {term} before we paid for the tickets.",
                "The assistant mentioned the {term} while checking the booking details.",
            ],
        },
        "verb": {
            "change": [
                "The airline may {term} the departure time because of the weather.",
                "The agency had to {term} the schedule at the last minute.",
            ],
            "submit": [
                "Passengers should {term} the booking before leaving for the station.",
                "You need to {term} your travel details online this evening.",
            ],
            "travel": [
                "We planned to {term} to the island early in the morning.",
                "Most visitors {term} by train because it is cheaper than flying.",
            ],
            "contact": [
                "Please {term} the booking office if you need to change the route.",
                "The traveller had to {term} the hotel before midnight.",
            ],
            "general": [
                "Travellers should {term} the details carefully before they leave.",
                "The guide asked everyone to {term} the plan again after lunch.",
            ],
        },
        "adjective": [
            "The direct service is {term} than the local train.",
            "It was a {term} journey, so we reached the hotel before noon.",
        ],
        "adverb": [
            "The guide spoke {term} during the safety briefing.",
            "Passengers moved {term} towards the correct platform.",
        ],
    },
    "住宿设施": {
        "noun": {
            "place": [
                "The {term} is close to the university library.",
                "They checked the {term} before signing the rental agreement.",
            ],
            "document": [
                "Please keep the {term} in case the landlord asks for proof of payment.",
                "The manager attached the {term} to the welcome email.",
            ],
            "money": [
                "The {term} will be returned when you move out of the flat.",
                "Students complained that the {term} was too high for a small room.",
            ],
            "event": [
                "The {term} was arranged for the day before move-in.",
                "Residents received a message about the {term} in the evening.",
            ],
            "abstract": [
                "The manager gave a short {term} of the new housing rules.",
                "Residents wanted a clearer {term} of how the repair system worked.",
            ],
            "general": [
                "The {term} was mentioned in the maintenance notice this morning.",
                "Residents discussed the {term} after dinner in the common room.",
            ],
        },
        "verb": {
            "change": [
                "The manager may {term} the room allocation after the inspection.",
                "They had to {term} the repair schedule because the parts arrived late.",
            ],
            "submit": [
                "Residents must {term} the request before the repair team can visit.",
                "You should {term} the payment online before collecting the keys.",
            ],
            "contact": [
                "Please {term} the housing office if the heater stops working.",
                "The resident decided to {term} the landlord about the leak.",
            ],
            "general": [
                "Residents often need to {term} the problem as soon as they notice it.",
                "The notice asked everyone to {term} the details before move-in day.",
            ],
        },
        "adjective": [
            "The room was clean, quiet, and surprisingly {term}.",
            "Students were told that the new rule was {term} for all residents.",
        ],
        "adverb": [
            "The maintenance team worked {term} and finished before noon.",
            "Residents were asked to report problems {term} through the online form.",
        ],
    },
    "科研方法": {
        "noun": {
            "research": [
                "The study identifies {term} as a key part of the experiment.",
                "The report suggests that {term} plays an important role in the findings.",
            ],
            "abstract": [
                "The article uses {term} to explain the main research process.",
                "The report gives a clear {term} of how the experiment was designed.",
            ],
            "general": [
                "The article refers to {term} when explaining the research method.",
                "The passage uses {term} to clarify the main argument.",
            ],
        },
        "verb": {
            "research": [
                "Researchers used the data to {term} the difference between the two groups.",
                "The team tried to {term} why the results changed over time.",
            ],
            "general": [
                "The author uses one case study to {term} the main point.",
                "The passage helps readers {term} the relationship between the variables.",
            ],
        },
        "adjective": {
            "change_quality": [
                "The results suggest that the change was {term} rather than immediate.",
                "The report describes a {term} difference between the two groups.",
            ],
            "evaluative": [
                "The passage offers an explanation that seems {term} and easy to follow.",
                "The method appears {term} for a study of this size.",
            ],
            "general": [
                "The results show a {term} difference between the two groups.",
                "The passage uses a {term} explanation of how the process works.",
            ],
        },
        "adverb": [
            "The data were analysed {term} before the report was published.",
            "The theory is explained {term} in the final paragraph.",
        ],
    },
    "环境生态": {
        "noun": {
            "environment": [
                "The report highlights {term} as a major environmental concern.",
                "Scientists are studying how {term} affects local wildlife.",
            ],
            "general": [
                "The article mentions {term} while discussing climate change.",
                "The passage links {term} to long-term ecological pressure.",
            ],
        },
        "verb": {
            "research": [
                "Researchers continue to {term} the impact of rising temperatures.",
                "Scientists used field data to {term} the change in the habitat.",
            ],
            "general": [
                "The government should {term} the damage before it becomes irreversible.",
                "Conservation groups hope to {term} the pressure on local species.",
            ],
        },
        "adjective": [
            "The river is becoming less {term} as industrial waste increases.",
            "It was a {term} change in the local climate.",
        ],
        "adverb": [
            "The species adapted {term} to the colder environment.",
            "The population declined {term} over the ten-year period.",
        ],
    },
    "社会历史": {
        "noun": {
            "abstract": [
                "The writer gives a useful {term} of how the custom developed over time.",
                "The passage offers a brief {term} of the social background.",
            ],
            "general": [
                "The writer uses {term} to explain the social change more clearly.",
                "The passage presents {term} as an important feature of the period.",
            ],
        },
        "verb": {
            "research": [
                "Historians continue to {term} how the community changed over time.",
                "The article tries to {term} why the custom became so popular.",
            ],
            "general": [
                "The passage uses one example to {term} the contrast between old and new values.",
                "The writer aims to {term} the effect of migration on local culture.",
            ],
        },
        "adjective": [
            "The article describes a {term} change in family structure.",
            "It was a {term} example of social inequality at the time.",
        ],
        "adverb": [
            "The custom spread {term} across the region.",
            "The two groups responded {term} to the same historical pressure.",
        ],
    },
    "艺术人文": {
        "noun": {
            "general": [
                "The passage uses {term} to explain how meaning is created in the artwork.",
                "The writer presents {term} as a key feature of the exhibition.",
            ],
        },
        "verb": {
            "general": [
                "The article explains how artists {term} familiar objects in unexpected ways.",
                "The writer uses one example to {term} the cultural meaning of the painting.",
            ],
        },
        "adjective": [
            "The passage describes a {term} contrast between modern and traditional styles.",
            "It was a {term} feature of the exhibition and appeared in several rooms.",
        ],
        "adverb": [
            "The museum text explains the idea {term} through a series of examples.",
            "The review describes the performance {term} without overexplaining it.",
        ],
    },
    "政府政策": {
        "noun": {
            "policy": [
                "Governments should give greater attention to {term} when making policy.",
                "The essay argues that {term} deserves more public support.",
            ],
            "money": [
                "More {term} should be directed towards public transport and healthcare.",
                "The government needs to manage {term} more carefully in difficult times.",
            ],
            "general": [
                "The policy debate often centres on {term} and social responsibility.",
                "The writer presents {term} as a key issue in public policy.",
            ],
        },
        "verb": {
            "resource": [
                "Governments should {term} more funding to public transport and healthcare.",
                "Local authorities need to {term} enough resources to frontline services.",
            ],
            "control": [
                "Governments should {term} harmful advertising aimed at children.",
                "The state needs to {term} the market more carefully.",
            ],
            "support": [
                "Public policy can {term} equal access to education.",
                "Schools should {term} healthier habits among young people.",
            ],
            "reduce": [
                "Governments should {term} traffic congestion in major cities.",
                "Stronger measures could {term} pressure on public hospitals.",
            ],
            "policy": [
                "Governments should {term} stronger measures to protect vulnerable groups.",
                "Many people believe the state should {term} public services more effectively.",
            ],
            "general": [
                "Policymakers need to {term} the long-term effects before making a decision.",
                "The essay suggests that governments should {term} the problem at an early stage.",
            ],
        },
        "adjective": {
            "evaluative": [
                "This approach seems {term} in the long run.",
                "The policy would be more {term} if local needs were considered.",
            ],
            "general": [
                "This is a more {term} way to improve public services.",
                "The writer supports a {term} approach to social policy.",
            ],
        },
        "adverb": [
            "Public money should be spent {term} rather than wasted on short-term fixes.",
            "The policy was applied {term} across different regions.",
        ],
    },
    "教育科技": {
        "noun": {
            "general": [
                "The essay presents {term} as a major influence on modern education.",
                "Teachers often discuss {term} when they compare old and new learning methods.",
            ],
        },
        "verb": {
            "general": [
                "Schools should {term} technology in ways that genuinely help students learn.",
                "Teachers can {term} real examples to make difficult ideas easier to understand.",
            ],
            "resource": [
                "Schools should {term} more funding to digital resources in poorer areas.",
                "Governments need to {term} enough support to teacher training.",
            ],
            "support": [
                "Governments need to {term} more support for digital education in rural areas.",
                "Schools should {term} the pressure on teachers by sharing more online resources.",
            ],
        },
        "adjective": {
            "evaluative": [
                "Online learning can become more {term} when students receive timely feedback.",
                "This change seems {term} for both teachers and students.",
            ],
            "general": [
                "Online learning can be more {term} when students receive timely feedback.",
                "It is a {term} example of how technology can improve access to education.",
            ],
        },
        "adverb": [
            "Students can learn more {term} if digital tools are used well.",
            "Teachers should introduce new media {term} rather than all at once.",
        ],
    },
    "经济环境": {
        "noun": {
            "money": [
                "The city must balance {term} against long-term environmental benefits.",
                "There is growing concern about the {term} of rapid urban growth.",
            ],
            "general": [
                "The essay links {term} to traffic, housing, and energy use.",
                "Urban planners often discuss {term} when they evaluate city development.",
            ],
        },
        "verb": {
            "resource": [
                "Governments must {term} resources more fairly across urban and rural areas.",
                "City leaders should {term} more funding to public transport.",
            ],
            "reduce": [
                "City authorities should {term} the pressure on public hospitals and schools.",
                "The policy aims to {term} pollution from private vehicles.",
            ],
            "general": [
                "Planners need to {term} the long-term cost of expanding the road network.",
                "The essay argues that cities should {term} environmental damage more seriously.",
            ],
        },
        "adjective": {
            "evaluative": [
                "Public transport is often a more {term} option than private cars.",
                "This solution seems {term} for cities facing rapid population growth.",
            ],
            "general": [
                "Public transport is often a more {term} option than private cars.",
                "It would be a {term} solution for cities facing rapid population growth.",
            ],
        },
        "adverb": [
            "Housing prices have risen {term} in many large cities.",
            "Resources should be distributed more {term} across the community.",
        ],
    },
    "人物经历": {
        "noun": {
            "person": [
                "My teacher was such an {term} person that everyone respected him.",
                "She is the most {term} person I have ever met.",
            ],
            "place": [
                "I still remember the {term} because we spent so much time there after school.",
                "The {term} was where one of my best memories happened.",
            ],
            "emotion": [
                "That trip left me with a strong sense of {term}.",
                "I still remember the moment because it was full of {term}.",
            ],
            "general": [
                "That experience taught me the value of {term}.",
                "The story became memorable because of one small moment of {term}.",
            ],
        },
        "verb": {
            "personal": [
                "I still {term} the advice my grandfather gave me when I was a child.",
                "That experience taught me how to {term} difficult situations more calmly.",
            ],
            "negative": [
                "Many students {term} from stress before important exams.",
                "I used to {term} from headaches when I slept too late.",
            ],
            "communication": [
                "It is hard to {term} that feeling in just a few words.",
                "I tried to {term} the experience as clearly as I could.",
            ],
            "general": [
                "That experience helped me {term} my feelings more clearly.",
                "The story gave me a chance to {term} what really mattered to me.",
            ],
        },
        "adjective": {
            "person_trait": [
                "She was so {term} that everyone felt comfortable talking to her.",
                "He seemed genuinely {term}, which made the conversation much easier.",
            ],
            "evaluative": [
                "The experience felt {term} from beginning to end.",
                "It was a {term} moment in my life.",
            ],
            "general": [
                "She was so {term} that everyone felt comfortable talking to her.",
                "The whole experience felt {term} and easy to remember.",
            ],
        },
        "adverb": [
            "He spoke {term} about the people who had helped him.",
            "I reacted {term} because I had never seen anything like it before.",
        ],
    },
    "地点旅行": {
        "noun": {
            "place": [
                "The {term} was the first place I wanted to visit in the city.",
                "We stopped at the {term} before heading back to the hotel.",
            ],
            "transport": [
                "The {term} was crowded, but the journey itself was enjoyable.",
                "We nearly missed the {term}, so we had to walk much faster.",
            ],
            "general": [
                "The trip became more enjoyable because of the {term}.",
                "I would love to return there because the {term} left a strong impression on me.",
            ],
        },
        "verb": {
            "travel": [
                "We decided to {term} around the old town on foot.",
                "I hope to {term} that place again when I have more free time.",
            ],
            "personal": [
                "The trip helped me {term} the city from a completely new angle.",
                "I usually {term} new places with one close friend.",
            ],
            "general": [
                "The guide encouraged us to {term} a quieter part of the city.",
                "I would like to {term} the area more slowly next time.",
            ],
        },
        "adjective": {
            "place_quality": [
                "The neighbourhood felt more {term} in the evening.",
                "It is a {term} place to visit if you enjoy quiet streets and old buildings.",
            ],
            "event_atmosphere": [
                "The town had a strong {term} atmosphere during the holiday.",
                "The market looked especially {term} on Saturday night.",
            ],
            "general": [
                "The place felt {term} from the moment we arrived.",
                "The neighbourhood looked more {term} in the evening.",
            ],
        },
        "adverb": [
            "We travelled {term} because the roads were empty in the morning.",
            "The town has grown {term} over the last decade.",
        ],
    },
    "文化艺术": {
        "noun": {
            "general": [
                "The exhibition made me think more deeply about the {term} behind the artist's work.",
                "One reason I enjoyed the museum was the {term} of the whole space.",
            ],
        },
        "verb": {
            "general": [
                "The exhibition helped me {term} the artist's idea much more clearly.",
                "That visit made me {term} local culture in a more personal way.",
            ],
        },
        "adjective": [
            "The building looked really {term}, especially when the lights came on in the evening.",
            "It was a {term} experience because every room had a different style.",
        ],
        "adverb": [
            "The guide described the paintings {term}, so the whole tour felt more engaging.",
            "I reacted {term} because I had never seen that style before.",
        ],
    },
    "习惯观点": {
        "noun": {
            "emotion": [
                "Reading has become an important part of my daily {term}.",
                "My main {term} is listening to music when I get home.",
            ],
            "place": [
                "I spend a lot of my free time in the {term} near my home.",
                "The {term} is where I usually go when I want to relax.",
            ],
            "general": [
                "I think {term} is one of the best ways to relax after work.",
                "People often mention {term} when they talk about a healthy lifestyle.",
            ],
        },
        "verb": {
            "personal": [
                "I usually {term} the same breakfast because it saves time in the morning.",
                "Most people {term} this option because it is both cheap and convenient.",
            ],
            "general": [
                "I would {term} this habit because it helps me stay organised.",
                "People often {term} their choices based on cost and convenience.",
            ],
        },
        "adjective": {
            "interest": [
                "I have always been an {term} reader since primary school.",
                "My brother is an {term} football fan, so he never misses a match.",
            ],
            "evaluative": [
                "That seems {term} for busy students who have very little free time.",
                "I think this routine is {term} for people who want a better work-life balance.",
            ],
            "general": [
                "That seems {term} for someone with a busy schedule.",
                "I think this habit has become more {term} over the last few years.",
            ],
        },
        "adverb": [
            "I usually study {term} in the evening when the house is quiet.",
            "People now shop more {term} than they did in the past.",
        ],
    },
}


def semantic_bag(candidate):
    return f'{candidate["word"]} {candidate["translation"]}'.lower()


def detect_semantic_role(candidate):
    bag = semantic_bag(candidate)
    for role, keywords in SEMANTIC_KEYWORDS.items():
        if any(keyword.lower() in bag for keyword in keywords):
            return role
    return "general"


def detect_verb_hint(candidate):
    bag = semantic_bag(candidate)
    for hint, keywords in VERB_HINTS.items():
        if any(keyword.lower() in bag for keyword in keywords):
            return hint
    return "general"


def detect_adjective_hint(candidate):
    bag = semantic_bag(candidate)
    for hint, keywords in ADJECTIVE_HINTS.items():
        if any(keyword.lower() in bag for keyword in keywords):
            return hint
    return "general"


def fix_articles(sentence):
    sentence = re.sub(r"\ba ([aeiou])", r"an \1", sentence, flags=re.I)
    return re.sub(r"\ban (?=[bcdfghjklmnpqrstvwxyz])", "a ", sentence, flags=re.I)


def build_scene_example(category, candidate, scene):
    library = SCENE_SENTENCE_LIBRARY[scene["label"]]
    pos = candidate["pos"]
    seed = stable_seed(category, scene["label"], candidate["word"], candidate["translation"])

    if pos == "n":
        role = detect_semantic_role(candidate)
        templates = library["noun"].get(role) or library["noun"].get("general") or []
    elif pos == "v":
        hint = detect_verb_hint(candidate)
        templates = library["verb"].get(hint) or library["verb"].get("general") or []
    elif pos == "a":
        adjective_library = library["adjective"]
        if isinstance(adjective_library, dict):
            hint = detect_adjective_hint(candidate)
            templates = adjective_library.get(hint) or adjective_library.get("general") or []
        else:
            templates = adjective_library
    else:
        templates = library["adverb"]

    template = pick_variant(templates, seed, 1)
    sentence = fix_articles(template.format(term=candidate["word"]))
    return capitalize_fragment(sentence)


def build_entry(category, candidate):
    override = TERM_OVERRIDES.get(candidate["word"], {})
    effective_category = override.get("category", category)
    candidate_context = {
        **candidate,
        "translation": override.get("translation", candidate["translation"]),
    }
    scene = pick_scene(effective_category, candidate_context)
    tags = [CATEGORY_CN_LABELS[effective_category], *scene["tags"], "高频扩展"]
    return {
        "id": f'bulk-{effective_category}-{candidate["word"]}',
        "category": effective_category,
        "kind": "word",
        "term": candidate["word"],
        "phonetic": candidate["phonetic"],
        "partOfSpeech": format_part_of_speech(candidate["pos"]),
        "translation": candidate_context["translation"],
        "note": override.get("note", scene["note"]),
        "example": override.get("example", build_scene_example(effective_category, candidate_context, scene)),
        "tags": tags,
    }


def main():
    source_path = ensure_source()
    existing_terms = parse_existing_terms()
    pdf_priority = load_pdf_priority_terms()
    raw_candidates = build_candidate_rows(source_path, existing_terms, set(pdf_priority))
    scored_candidates = [score_candidate(candidate, pdf_priority) for candidate in raw_candidates]
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
    print(f"  pdf-priority terms: {len(pdf_priority)}")
    for category, count in counts.items():
        print(f"  {category}: {count}")


if __name__ == "__main__":
    main()
