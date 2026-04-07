const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const LOCAL_PROXY_ORIGIN = "http://127.0.0.1:8000";
const STORAGE_KEY = "ielts-lexicon-sprint-state-v1";
const CLOUD_SYNC_STORAGE_KEY = "ielts-lexicon-sprint-cloud-sync-v1";
const SHARED_PROGRESS_SYNC_DELAY = 800;
const CLOUD_PROGRESS_SYNC_DELAY = 2500;
const MAX_DAILY_LIMIT = 100;
const ONLINE_TTS_PROXY_PATH = "/api/pronunciation";
const DIRECT_TTS_BASE_URL = "https://translate.googleapis.com/translate_tts";
const MAX_TTS_SEGMENT_LENGTH = 180;
const CATEGORY_ORDER = ["listening", "reading", "writing", "speaking"];
const SPEAKING_PART_ORDER = ["part1", "part2", "part3"];
const SPEAKING_PART_LABELS = {
  part1: "Part 1",
  part2: "Part 2",
  part3: "Part 3",
};

const DEFAULT_RUNTIME_CONFIG = Object.freeze({
  backendBaseUrl: "",
  aiApiBaseUrl: "",
  cloudSyncBaseUrl: "",
  pronunciationApiBaseUrl: "",
});

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function readRuntimeConfig() {
  const source =
    typeof window !== "undefined" && window.__IELTS_LEXICON_CONFIG__ && typeof window.__IELTS_LEXICON_CONFIG__ === "object"
      ? window.__IELTS_LEXICON_CONFIG__
      : {};
  const backendBaseUrl = normalizeBaseUrl(source.backendBaseUrl || source.apiBaseUrl);

  return {
    ...DEFAULT_RUNTIME_CONFIG,
    backendBaseUrl,
    aiApiBaseUrl: normalizeBaseUrl(source.aiApiBaseUrl) || backendBaseUrl,
    cloudSyncBaseUrl: normalizeBaseUrl(source.cloudSyncBaseUrl) || backendBaseUrl,
    pronunciationApiBaseUrl: normalizeBaseUrl(source.pronunciationApiBaseUrl) || backendBaseUrl,
  };
}

const RUNTIME_CONFIG = readRuntimeConfig();

const CATEGORY_META = {
  listening: {
    label: "听力单词",
    description: "校园服务、课程安排、预约通知和讲座提示等高频场景词。",
    headline: "先听得懂，再做题更稳",
  },
  reading: {
    label: "阅读单词",
    description: "学术话题和逻辑关系词，帮助你更快抓住文章主线。",
    headline: "优先培养识别速度",
  },
  writing: {
    label: "写作单词",
    description: "论证型表达配合词块，适合 Task 2 和图表概述写作。",
    headline: "从单词升级到可直接落笔的表达",
  },
  speaking: {
    label: "口语单词",
    description: "生活话题、人物经历和可直接输出的自然搭配。",
    headline: "让回答更自然、更有内容",
  },
};

const REVIEW_SCHEMES = {
  standard: [10 * MINUTE, 1 * DAY, 2 * DAY, 4 * DAY, 7 * DAY, 15 * DAY, 30 * DAY],
  sprint: [10 * MINUTE, 12 * HOUR, 1 * DAY, 3 * DAY, 5 * DAY, 10 * DAY, 21 * DAY],
  steady: [10 * MINUTE, 1 * DAY, 3 * DAY, 7 * DAY, 14 * DAY, 30 * DAY, 45 * DAY],
};

const SUPPORT_MATERIALS = {
  fluency: [
    "What stands out to me is that...",
    "The reason I say this is that...",
    "Another point worth mentioning is that...",
  ],
  development: [
    "To give a specific example,...",
    "As a result, ...",
    "That experience taught me that...",
  ],
  opinion: [
    "From my perspective,...",
    "In the long run,...",
    "play a crucial role in",
  ],
};

const vocabularyBank = [
  {
    id: "listen-orientation",
    category: "listening",
    kind: "word",
    term: "orientation",
    phonetic: "/ˌɔːriənˈteɪʃən/",
    translation: "迎新介绍；入门说明会",
    note: "常见于校园服务和开学安排。",
    example: "The orientation for new students will begin in Room 204 at 8:30.",
    tags: ["校园听力", "通知"],
  },
  {
    id: "listen-venue",
    category: "listening",
    kind: "word",
    term: "venue",
    phonetic: "/ˈvenjuː/",
    translation: "会场；活动地点",
    note: "听力里常和 event, lecture, seminar 搭配。",
    example: "The venue has been changed from the library to the main hall.",
    tags: ["活动", "地点"],
  },
  {
    id: "listen-postpone",
    category: "listening",
    kind: "word",
    term: "postpone",
    phonetic: "/pəˈspəʊn/",
    translation: "推迟；延期",
    note: "预约、考试和会议场景非常高频。",
    example: "The workshop has been postponed until next Thursday.",
    tags: ["时间安排", "服务咨询"],
  },
  {
    id: "listen-compulsory",
    category: "listening",
    kind: "word",
    term: "compulsory",
    phonetic: "/kəmˈpʌlsəri/",
    translation: "必修的；强制性的",
    note: "常见于课程选择和规定说明。",
    example: "Attendance at the safety lecture is compulsory for all students.",
    tags: ["课程", "规定"],
  },
  {
    id: "listen-enrolment",
    category: "listening",
    kind: "word",
    term: "enrolment",
    phonetic: "/ɪnˈrəʊlmənt/",
    translation: "注册；入学登记",
    note: "英国拼写更贴近雅思场景。",
    example: "The enrolment office closes at four in the afternoon.",
    tags: ["注册", "校园"],
  },
  {
    id: "listen-reservation",
    category: "listening",
    kind: "word",
    term: "reservation",
    phonetic: "/ˌrezəˈveɪʃən/",
    translation: "预订；预约",
    note: "旅游和图书馆服务中都很常见。",
    example: "You can confirm your reservation by phone or email.",
    tags: ["旅游", "服务"],
  },
  {
    id: "listen-handout",
    category: "listening",
    kind: "word",
    term: "handout",
    phonetic: "/ˈhændaʊt/",
    translation: "讲义；发放资料",
    note: "讲座与 tutorial 场景高频。",
    example: "Please collect the handout before the lecture starts.",
    tags: ["讲座", "资料"],
  },
  {
    id: "listen-refreshments",
    category: "listening",
    kind: "word",
    term: "refreshments",
    phonetic: "/rɪˈfreʃmənts/",
    translation: "茶点；饮料",
    note: "活动通知里常用复数形式。",
    example: "Light refreshments will be served during the break.",
    tags: ["活动", "通知"],
  },
  {
    id: "listen-run-through",
    category: "listening",
    kind: "chunk",
    term: "run through the schedule",
    phonetic: "",
    translation: "快速过一遍日程安排",
    note: "适合听力跟读和口头复述。",
    example: "The tutor will run through the schedule before the field trip begins.",
    tags: ["听抄词块", "日程"],
  },
  {
    id: "listen-submit-in-person",
    category: "listening",
    kind: "chunk",
    term: "submit the form in person",
    phonetic: "",
    translation: "本人递交表格",
    note: "服务咨询和行政场景常见。",
    example: "You need to submit the form in person at the student office.",
    tags: ["听抄词块", "行政"],
  },
  {
    id: "listen-open-public",
    category: "listening",
    kind: "chunk",
    term: "be open to the public",
    phonetic: "",
    translation: "向公众开放",
    note: "博物馆、展览和校园设施通知高频。",
    example: "The new science centre will be open to the public on weekends.",
    tags: ["听抄词块", "通知"],
  },
  {
    id: "listen-keep-receipt",
    category: "listening",
    kind: "chunk",
    term: "keep the receipt for reference",
    phonetic: "",
    translation: "保留收据以备查阅",
    note: "支付、报销和活动报名都能遇到。",
    example: "Please keep the receipt for reference in case there is a problem.",
    tags: ["听抄词块", "服务"],
  },
  {
    id: "read-sustainable",
    category: "reading",
    kind: "word",
    term: "sustainable",
    phonetic: "/səˈsteɪnəbəl/",
    translation: "可持续的",
    note: "环境、经济、城市发展主题都常见。",
    example: "Researchers are looking for sustainable ways to reduce energy use.",
    tags: ["环境", "学术词"],
  },
  {
    id: "read-biodiversity",
    category: "reading",
    kind: "word",
    term: "biodiversity",
    phonetic: "/ˌbaɪəʊdaɪˈvɜːsəti/",
    translation: "生物多样性",
    note: "生态保护类文章高频核心词。",
    example: "The report highlights the importance of protecting biodiversity.",
    tags: ["环境", "科学"],
  },
  {
    id: "read-hypothesis",
    category: "reading",
    kind: "word",
    term: "hypothesis",
    phonetic: "/haɪˈpɒθəsɪs/",
    translation: "假设",
    note: "实验研究和学术推断常见。",
    example: "The scientists tested the hypothesis over a period of two years.",
    tags: ["研究", "学术词"],
  },
  {
    id: "read-scarce",
    category: "reading",
    kind: "word",
    term: "scarce",
    phonetic: "/skeəs/",
    translation: "稀缺的；不足的",
    note: "资源、土地和水源议题很常见。",
    example: "Fresh water is becoming increasingly scarce in some regions.",
    tags: ["资源", "学术词"],
  },
  {
    id: "read-urbanisation",
    category: "reading",
    kind: "word",
    term: "urbanisation",
    phonetic: "/ˌɜːbənaɪˈzeɪʃən/",
    translation: "城市化",
    note: "社会变化类文章高频。",
    example: "Rapid urbanisation has changed the structure of local communities.",
    tags: ["社会", "城市"],
  },
  {
    id: "read-deteriorate",
    category: "reading",
    kind: "word",
    term: "deteriorate",
    phonetic: "/dɪˈtɪəriəreɪt/",
    translation: "恶化",
    note: "常描述健康、环境或经济状况变差。",
    example: "Air quality continued to deteriorate after the factory expanded.",
    tags: ["变化", "学术词"],
  },
  {
    id: "read-consensus",
    category: "reading",
    kind: "word",
    term: "consensus",
    phonetic: "/kənˈsensəs/",
    translation: "共识",
    note: "观点类文章和研究综述常用。",
    example: "There is growing consensus that early intervention is effective.",
    tags: ["逻辑词", "观点"],
  },
  {
    id: "read-decline",
    category: "reading",
    kind: "word",
    term: "decline",
    phonetic: "/dɪˈklaɪn/",
    translation: "下降；减少",
    note: "可作名词或动词，图表和阅读都常见。",
    example: "The article describes a steady decline in fish populations.",
    tags: ["变化", "数据"],
  },
  {
    id: "write-allocate",
    category: "writing",
    kind: "word",
    term: "allocate",
    phonetic: "/ˈæləkeɪt/",
    translation: "分配；拨给",
    note: "政府、预算和资源类写作高频。",
    example: "Governments should allocate more funding to public transport.",
    tags: ["写作", "政策"],
  },
  {
    id: "write-substantial",
    category: "writing",
    kind: "word",
    term: "substantial",
    phonetic: "/səbˈstænʃəl/",
    translation: "大量的；显著的",
    note: "常用于形容变化、投入和影响。",
    example: "A substantial investment would be needed to modernise the system.",
    tags: ["写作", "学术表达"],
  },
  {
    id: "write-mitigate",
    category: "writing",
    kind: "word",
    term: "mitigate",
    phonetic: "/ˈmɪtɪɡeɪt/",
    translation: "缓解；减轻",
    note: "问题解决类题目很常用。",
    example: "Better planning could mitigate the pressure on city hospitals.",
    tags: ["写作", "问题解决"],
  },
  {
    id: "write-viable",
    category: "writing",
    kind: "word",
    term: "viable",
    phonetic: "/ˈvaɪəbəl/",
    translation: "可行的",
    note: "适合评价方案和政策。",
    example: "This is a viable solution for low-income families.",
    tags: ["写作", "论证"],
  },
  {
    id: "write-impose",
    category: "writing",
    kind: "word",
    term: "impose",
    phonetic: "/ɪmˈpəʊz/",
    translation: "实施；强加",
    note: "法规、限制和税收类表达高频。",
    example: "Some people believe governments should impose stricter regulations.",
    tags: ["写作", "政策"],
  },
  {
    id: "write-advocate",
    category: "writing",
    kind: "word",
    term: "advocate",
    phonetic: "/ˈædvəkeɪt/",
    translation: "提倡；主张",
    note: "用来表达支持某项立场更书面。",
    example: "Many educators advocate project-based learning in secondary schools.",
    tags: ["写作", "观点"],
  },
  {
    id: "write-underpin",
    category: "writing",
    kind: "word",
    term: "underpin",
    phonetic: "/ˌʌndəˈpɪn/",
    translation: "支撑；构成基础",
    note: "适合描述原因或基础条件。",
    example: "Stable funding underpins the long-term success of public programmes.",
    tags: ["写作", "因果"],
  },
  {
    id: "write-disproportionately",
    category: "writing",
    kind: "word",
    term: "disproportionately",
    phonetic: "/ˌdɪsprəˈpɔːʃənətli/",
    translation: "不成比例地",
    note: "适合描述社会影响不均衡。",
    example: "Low-income groups are disproportionately affected by rising rents.",
    tags: ["写作", "社会议题"],
  },
  {
    id: "write-crucial-role",
    category: "writing",
    kind: "chunk",
    term: "play a crucial role in",
    phonetic: "",
    translation: "在……中起关键作用",
    note: "高频万能搭配，适合 Task 2 主体段。",
    example: "Parents play a crucial role in shaping children's attitudes to study.",
    tags: ["词块", "论证"],
  },
  {
    id: "write-long-run",
    category: "writing",
    kind: "chunk",
    term: "in the long run",
    phonetic: "",
    translation: "从长远来看",
    note: "适合比较短期和长期影响。",
    example: "In the long run, preventive healthcare can reduce public spending.",
    tags: ["词块", "逻辑连接"],
  },
  {
    id: "write-root-cause",
    category: "writing",
    kind: "chunk",
    term: "address the root cause",
    phonetic: "",
    translation: "解决根本原因",
    note: "问题解决题很好用。",
    example: "Policies should address the root cause rather than the surface symptoms.",
    tags: ["词块", "问题解决"],
  },
  {
    id: "write-policy-perspective",
    category: "writing",
    kind: "chunk",
    term: "from a policy perspective",
    phonetic: "",
    translation: "从政策角度来看",
    note: "让论证显得更正式、更清楚。",
    example: "From a policy perspective, subsidies can encourage cleaner transport.",
    tags: ["词块", "观点"],
  },
  {
    id: "write-better-equipped",
    category: "writing",
    kind: "chunk",
    term: "be better equipped to",
    phonetic: "",
    translation: "更有能力去……",
    note: "常用于描述能力提升或条件改善。",
    example: "Graduates are better equipped to adapt to a changing job market.",
    tags: ["词块", "结果"],
  },
  {
    id: "speak-outgoing",
    category: "speaking",
    kind: "word",
    term: "outgoing",
    phonetic: "/ˌaʊtˈɡəʊɪŋ/",
    translation: "外向的",
    note: "人物类话题非常顺手。",
    example: "My cousin is really outgoing, so he makes friends easily.",
    tags: ["口语", "人物"],
  },
  {
    id: "speak-overwhelmed",
    category: "speaking",
    kind: "word",
    term: "overwhelmed",
    phonetic: "/ˌəʊvəˈwelmd/",
    translation: "压力很大；应接不暇的",
    note: "适合描述学习、工作和城市生活。",
    example: "I felt overwhelmed when I first moved to a much bigger city.",
    tags: ["口语", "情绪"],
  },
  {
    id: "speak-memorable",
    category: "speaking",
    kind: "word",
    term: "memorable",
    phonetic: "/ˈmemərəbəl/",
    translation: "难忘的",
    note: "经历和人物话题都很万能。",
    example: "One of the most memorable trips I've had was with my grandparents.",
    tags: ["口语", "经历"],
  },
  {
    id: "speak-flexible",
    category: "speaking",
    kind: "word",
    term: "flexible",
    phonetic: "/ˈfleksəbəl/",
    translation: "灵活的",
    note: "工作、学习和时间安排话题很常用。",
    example: "A flexible schedule helps me balance study and part-time work.",
    tags: ["口语", "学习"],
  },
  {
    id: "speak-nutritious",
    category: "speaking",
    kind: "word",
    term: "nutritious",
    phonetic: "/njuːˈtrɪʃəs/",
    translation: "有营养的",
    note: "健康、食物和家庭话题可以直接用。",
    example: "My mum usually cooks simple but nutritious meals at home.",
    tags: ["口语", "生活"],
  },
  {
    id: "speak-commute",
    category: "speaking",
    kind: "word",
    term: "commute",
    phonetic: "/kəˈmjuːt/",
    translation: "通勤；通学",
    note: "Part 1 的 home/work/study 题经常会用到。",
    example: "I commute by metro because it's faster during rush hour.",
    tags: ["口语", "出行"],
  },
  {
    id: "speak-leisure",
    category: "speaking",
    kind: "word",
    term: "leisure",
    phonetic: "/ˈleʒə/",
    translation: "休闲；空闲时间",
    note: "兴趣爱好题很常见。",
    example: "In my leisure time, I usually go for a walk or listen to podcasts.",
    tags: ["口语", "爱好"],
  },
  {
    id: "speak-inspiring",
    category: "speaking",
    kind: "word",
    term: "inspiring",
    phonetic: "/ɪnˈspaɪərɪŋ/",
    translation: "鼓舞人的；启发人的",
    note: "人物、书籍、课程、演讲题都能用。",
    example: "My art teacher was inspiring because she encouraged us to experiment.",
    tags: ["口语", "人物"],
  },
  {
    id: "speak-keep-touch",
    category: "speaking",
    kind: "chunk",
    term: "keep in touch with",
    phonetic: "",
    translation: "与……保持联系",
    note: "人际关系类万能词块。",
    example: "I still keep in touch with my classmates from secondary school.",
    tags: ["词块", "人物"],
  },
  {
    id: "speak-comfort-zone",
    category: "speaking",
    kind: "chunk",
    term: "step out of my comfort zone",
    phonetic: "",
    translation: "走出舒适区",
    note: "Part 2 讲经历时很好展开。",
    example: "Joining the debate club really helped me step out of my comfort zone.",
    tags: ["词块", "经历"],
  },
  {
    id: "speak-regular-basis",
    category: "speaking",
    kind: "chunk",
    term: "on a regular basis",
    phonetic: "",
    translation: "定期地；经常地",
    note: "Part 1 日常习惯题非常好用。",
    example: "I try to exercise on a regular basis, even if it's just for half an hour.",
    tags: ["词块", "习惯"],
  },
  {
    id: "speak-broaden-horizons",
    category: "speaking",
    kind: "chunk",
    term: "broaden my horizons",
    phonetic: "",
    translation: "开阔我的眼界",
    note: "旅行、阅读、学习新技能题都可用。",
    example: "Travelling alone really broadened my horizons when I was at university.",
    tags: ["词块", "经历"],
  },
  {
    id: "speak-strike-balance",
    category: "speaking",
    kind: "chunk",
    term: "strike a balance between",
    phonetic: "",
    translation: "在……之间取得平衡",
    note: "工作学习、效率生活题型万能。",
    example: "It's hard to strike a balance between studying and relaxing before exams.",
    tags: ["词块", "生活"],
  },
];

function createExpandedVocabularyEntries(prefix, category, items) {
  return items.map((item) => ({
    id: `${prefix}-${item.id}`,
    category,
    kind: item.kind,
    term: item.term,
    phonetic: item.phonetic || "",
    partOfSpeech: item.partOfSpeech || "",
    translation: item.translation,
    note: item.note,
    example: item.example,
    tags: item.tags || [],
  }));
}

const expandedVocabularyBank = [
  ...createExpandedVocabularyEntries("listen", "listening", [
    {
      id: "tuition",
      kind: "word",
      term: "tuition",
      translation: "学费；教学",
      note: "校园咨询和缴费场景高频。",
      example: "The first part of the tuition fee needs to be paid by the end of August.",
      tags: ["校园听力", "费用"],
    },
    {
      id: "deadline",
      kind: "word",
      term: "deadline",
      translation: "截止日期",
      note: "表格提交、作业和报名都很常见。",
      example: "The deadline for the field trip application is next Monday.",
      tags: ["校园听力", "时间"],
    },
    {
      id: "scholarship",
      kind: "word",
      term: "scholarship",
      translation: "奖学金",
      note: "奖助信息和申请要求常见。",
      example: "She received a scholarship to cover part of her accommodation costs.",
      tags: ["校园听力", "资助"],
    },
    {
      id: "brochure",
      kind: "word",
      term: "brochure",
      translation: "宣传册；手册",
      note: "旅游、展览和课程介绍里很高频。",
      example: "You can find the full timetable in the brochure on the front desk.",
      tags: ["资料", "服务"],
    },
    {
      id: "laboratory",
      kind: "word",
      term: "laboratory",
      translation: "实验室",
      note: "校园地图和课程说明常见。",
      example: "The chemistry laboratory is on the third floor of the science building.",
      tags: ["校园听力", "地点"],
    },
    {
      id: "corridor",
      kind: "word",
      term: "corridor",
      translation: "走廊",
      note: "地图题和方向说明常见。",
      example: "Go along the corridor and turn left at the photocopy room.",
      tags: ["地图", "方向"],
    },
    {
      id: "cafeteria",
      kind: "word",
      term: "cafeteria",
      translation: "自助餐厅；食堂",
      note: "校园设施和生活场景高频。",
      example: "The cafeteria now serves hot meals until seven in the evening.",
      tags: ["校园听力", "生活"],
    },
    {
      id: "maintenance",
      kind: "word",
      term: "maintenance",
      translation: "维护；维修",
      note: "住宿和设施通知里常见。",
      example: "The sports centre will close for maintenance over the weekend.",
      tags: ["设施", "通知"],
    },
    {
      id: "invoice",
      kind: "word",
      term: "invoice",
      translation: "发票；费用清单",
      note: "支付和报销场景高频。",
      example: "Please email the invoice to the finance office for approval.",
      tags: ["费用", "服务"],
    },
    {
      id: "supervisor",
      kind: "word",
      term: "supervisor",
      translation: "主管；导师",
      note: "研究、实习和项目场景很常见。",
      example: "You should ask your supervisor to sign the form before you submit it.",
      tags: ["学术", "行政"],
    },
    {
      id: "itinerary",
      kind: "word",
      term: "itinerary",
      translation: "行程安排",
      note: "旅行和活动安排高频。",
      example: "The itinerary includes a museum visit and a guided walk in the afternoon.",
      tags: ["旅游", "安排"],
    },
    {
      id: "commuter",
      kind: "word",
      term: "commuter",
      translation: "通勤者",
      note: "交通与城市生活场景常见。",
      example: "A lot of commuters prefer the early train because it is less crowded.",
      tags: ["交通", "生活"],
    },
    {
      id: "inspection",
      kind: "word",
      term: "inspection",
      translation: "检查；视察",
      note: "住宿和安全通知常见。",
      example: "There will be a room inspection on Thursday morning.",
      tags: ["住宿", "通知"],
    },
    {
      id: "availability",
      kind: "word",
      term: "availability",
      translation: "可获得性；空余情况",
      note: "预约和订位对话高频。",
      example: "We need to check the availability of the conference room first.",
      tags: ["预约", "服务"],
    },
    {
      id: "reimbursement",
      kind: "word",
      term: "reimbursement",
      translation: "报销",
      note: "学校活动和工作场景会出现。",
      example: "Students can apply for reimbursement after handing in their receipts.",
      tags: ["费用", "行政"],
    },
    {
      id: "installment",
      kind: "word",
      term: "installment",
      translation: "分期付款",
      note: "缴费咨询里常见。",
      example: "The tuition can be paid in three installments during the semester.",
      tags: ["费用", "咨询"],
    },
    {
      id: "deposit",
      kind: "word",
      term: "deposit",
      translation: "押金；定金",
      note: "住宿、借用器材和报名场景高频。",
      example: "You need to pay a small deposit before borrowing the camera.",
      tags: ["住宿", "费用"],
    },
    {
      id: "lease",
      kind: "word",
      term: "lease",
      translation: "租约",
      note: "租房和住宿咨询高频。",
      example: "The lease runs from September to the end of June.",
      tags: ["住宿", "生活"],
    },
    {
      id: "fill-questionnaire",
      kind: "chunk",
      term: "fill in the questionnaire",
      translation: "填写问卷",
      note: "调查和反馈场景常见。",
      example: "Please fill in the questionnaire before you leave the workshop.",
      tags: ["听抄词块", "反馈"],
    },
    {
      id: "pick-up-key",
      kind: "chunk",
      term: "pick up the key at reception",
      translation: "在前台领取钥匙",
      note: "住宿办理高频表达。",
      example: "You can pick up the key at reception after two o'clock.",
      tags: ["听抄词块", "住宿"],
    },
    {
      id: "appointment-in-advance",
      kind: "chunk",
      term: "make an appointment in advance",
      translation: "提前预约",
      note: "咨询和体检场景非常常见。",
      example: "Students are advised to make an appointment in advance during busy periods.",
      tags: ["听抄词块", "服务"],
    },
    {
      id: "last-shuttle",
      kind: "chunk",
      term: "catch the last shuttle bus",
      translation: "赶上最后一班接驳车",
      note: "交通对话里很实用。",
      example: "If the lecture finishes late, you may miss the last shuttle bus.",
      tags: ["听抄词块", "交通"],
    },
    {
      id: "student-discount",
      kind: "chunk",
      term: "apply for a student discount",
      translation: "申请学生优惠",
      note: "票务和服务咨询高频。",
      example: "You can apply for a student discount with your campus card.",
      tags: ["听抄词块", "费用"],
    },
    {
      id: "notice-board",
      kind: "chunk",
      term: "check the notice board regularly",
      translation: "定期查看公告栏",
      note: "课程和住宿通知常见。",
      example: "Please check the notice board regularly for room changes.",
      tags: ["听抄词块", "通知"],
    },
  ]),
  ...createExpandedVocabularyEntries("read", "reading", [
    {
      id: "habitat",
      kind: "word",
      term: "habitat",
      translation: "栖息地",
      note: "生态和动物类文章高频。",
      example: "The loss of natural habitat has forced many species to migrate.",
      tags: ["阅读", "环境"],
    },
    {
      id: "deteriorate",
      kind: "word",
      term: "deteriorate",
      translation: "恶化",
      note: "健康、环境和社会问题文章常见。",
      example: "Air quality tends to deteriorate in large cities during winter.",
      tags: ["阅读", "学术词"],
    },
    {
      id: "mitigate",
      kind: "word",
      term: "mitigate",
      translation: "缓解；减轻",
      note: "解决方案类文章高频。",
      example: "New policies were introduced to mitigate the impact of flooding.",
      tags: ["阅读", "学术词"],
    },
    {
      id: "preliminary",
      kind: "word",
      term: "preliminary",
      translation: "初步的；预备的",
      note: "研究报告中很常见。",
      example: "The preliminary findings were later confirmed by a larger study.",
      tags: ["阅读", "研究"],
    },
    {
      id: "subsequent",
      kind: "word",
      term: "subsequent",
      translation: "随后的；后来的",
      note: "文章时间线和因果关系常见。",
      example: "Subsequent research produced more reliable evidence.",
      tags: ["阅读", "逻辑"],
    },
    {
      id: "adverse",
      kind: "word",
      term: "adverse",
      translation: "不利的；负面的",
      note: "结果和影响类文章高频。",
      example: "The report highlighted the adverse effects of sleep deprivation.",
      tags: ["阅读", "影响"],
    },
    {
      id: "resilient",
      kind: "word",
      term: "resilient",
      translation: "有韧性的；恢复力强的",
      note: "城市、生态和心理主题常见。",
      example: "Some coastal communities have become more resilient to storms.",
      tags: ["阅读", "环境"],
    },
    {
      id: "disparity",
      kind: "word",
      term: "disparity",
      translation: "差异；悬殊",
      note: "社会、教育和收入差距文章高频。",
      example: "The article examines the disparity between rural and urban schools.",
      tags: ["阅读", "社会"],
    },
    {
      id: "constrain",
      kind: "word",
      term: "constrain",
      translation: "限制；约束",
      note: "资源和条件不足时常见。",
      example: "Limited funding may constrain the scope of the project.",
      tags: ["阅读", "学术词"],
    },
    {
      id: "hypothesis",
      kind: "word",
      term: "hypothesis",
      translation: "假设",
      note: "科学实验和研究设计高频。",
      example: "The researchers tested the hypothesis in several different settings.",
      tags: ["阅读", "研究"],
    },
    {
      id: "intervention",
      kind: "word",
      term: "intervention",
      translation: "干预；介入措施",
      note: "医疗、教育和社会政策常见。",
      example: "Early intervention can improve learning outcomes significantly.",
      tags: ["阅读", "教育"],
    },
    {
      id: "cognitive",
      kind: "word",
      term: "cognitive",
      translation: "认知的",
      note: "心理学和教育文章高频。",
      example: "Music training may support children's cognitive development.",
      tags: ["阅读", "心理"],
    },
    {
      id: "contaminate",
      kind: "word",
      term: "contaminate",
      translation: "污染；弄脏",
      note: "环境和食品安全文章常见。",
      example: "Industrial waste can contaminate rivers if it is not treated properly.",
      tags: ["阅读", "环境"],
    },
    {
      id: "legitimate",
      kind: "word",
      term: "legitimate",
      translation: "合理的；合法的",
      note: "论证与评价文章常见。",
      example: "The author raised legitimate concerns about data privacy.",
      tags: ["阅读", "论证"],
    },
    {
      id: "plausible",
      kind: "word",
      term: "plausible",
      translation: "貌似合理的",
      note: "作者观点和解释判断高频。",
      example: "At first glance, the explanation sounds plausible.",
      tags: ["阅读", "论证"],
    },
    {
      id: "underlying",
      kind: "word",
      term: "underlying",
      translation: "潜在的；根本的",
      note: "原因分析类文章很常见。",
      example: "The study focused on the underlying causes of unemployment.",
      tags: ["阅读", "逻辑"],
    },
    {
      id: "consecutive",
      kind: "word",
      term: "consecutive",
      translation: "连续的",
      note: "数据和时间描述高频。",
      example: "The region experienced drought for three consecutive years.",
      tags: ["阅读", "数据"],
    },
    {
      id: "prevalent",
      kind: "word",
      term: "prevalent",
      translation: "普遍的；流行的",
      note: "社会问题和健康类文章常见。",
      example: "This belief was especially prevalent among younger participants.",
      tags: ["阅读", "社会"],
    },
    {
      id: "significant-role",
      kind: "chunk",
      term: "play a significant role in",
      translation: "在……中发挥重要作用",
      note: "长难句和主旨句里很常见。",
      example: "Soil quality plays a significant role in agricultural productivity.",
      tags: ["阅读词块", "逻辑"],
    },
    {
      id: "be-exposed-to",
      kind: "chunk",
      term: "be exposed to",
      translation: "接触到；暴露于",
      note: "环境、教育和媒体文章高频。",
      example: "Children are exposed to digital devices at an earlier age than before.",
      tags: ["阅读词块", "学术"],
    },
    {
      id: "alarming-rate",
      kind: "chunk",
      term: "at an alarming rate",
      translation: "以惊人的速度",
      note: "趋势和变化描述常见。",
      example: "Some glaciers are melting at an alarming rate.",
      tags: ["阅读词块", "趋势"],
    },
    {
      id: "long-term",
      kind: "chunk",
      term: "in the long term",
      translation: "从长远来看",
      note: "作者评价和推论高频。",
      example: "In the long term, cleaner transport may benefit both health and the economy.",
      tags: ["阅读词块", "逻辑"],
    },
    {
      id: "body-of-research",
      kind: "chunk",
      term: "a growing body of research",
      translation: "越来越多的研究成果",
      note: "学术类阅读文章高频。",
      example: "A growing body of research suggests that sleep affects memory formation.",
      tags: ["阅读词块", "研究"],
    },
    {
      id: "attributed-to",
      kind: "chunk",
      term: "be attributed to",
      translation: "归因于",
      note: "因果关系判断高频。",
      example: "The decline was largely attributed to a shortage of skilled workers.",
      tags: ["阅读词块", "因果"],
    },
  ]),
  ...createExpandedVocabularyEntries("write", "writing", [
    {
      id: "feasible",
      kind: "word",
      term: "feasible",
      translation: "可行的",
      note: "论证方案是否现实很常用。",
      example: "This proposal may be effective, but it is not financially feasible for every city.",
      tags: ["写作", "论证"],
    },
    {
      id: "detrimental",
      kind: "word",
      term: "detrimental",
      translation: "有害的；不利的",
      note: "表达负面影响时非常好用。",
      example: "Excessive screen time can be detrimental to children's concentration.",
      tags: ["写作", "影响"],
    },
    {
      id: "substantial",
      kind: "word",
      term: "substantial",
      translation: "大量的；重大的",
      note: "数据和程度描述都很实用。",
      example: "The government should make a substantial investment in public transport.",
      tags: ["写作", "程度"],
    },
    {
      id: "congestion",
      kind: "word",
      term: "congestion",
      translation: "拥堵",
      note: "交通题高频核心词。",
      example: "Road pricing is often introduced to reduce traffic congestion in city centres.",
      tags: ["写作", "交通"],
    },
    {
      id: "incentive",
      kind: "word",
      term: "incentive",
      translation: "激励；诱因",
      note: "政策和行为改变题高频。",
      example: "Tax reductions can provide an incentive for companies to hire more staff.",
      tags: ["写作", "政策"],
    },
    {
      id: "regulation",
      kind: "word",
      term: "regulation",
      translation: "法规；监管",
      note: "政府类题目常用。",
      example: "Stricter regulation is needed to control misleading advertising.",
      tags: ["写作", "政府"],
    },
    {
      id: "inequality",
      kind: "word",
      term: "inequality",
      translation: "不平等",
      note: "教育、收入和地区差异题高频。",
      example: "Better access to education can reduce social inequality over time.",
      tags: ["写作", "社会"],
    },
    {
      id: "overconsumption",
      kind: "word",
      term: "overconsumption",
      translation: "过度消费",
      note: "环境与商业题常用。",
      example: "Overconsumption places unnecessary pressure on natural resources.",
      tags: ["写作", "环境"],
    },
    {
      id: "vulnerable",
      kind: "word",
      term: "vulnerable",
      translation: "脆弱的；易受影响的",
      note: "社会和健康题高频。",
      example: "Policy changes should protect vulnerable groups rather than widen existing gaps.",
      tags: ["写作", "社会"],
    },
    {
      id: "urbanisation",
      kind: "word",
      term: "urbanisation",
      translation: "城市化",
      note: "城乡发展题高频。",
      example: "Rapid urbanisation has created pressure on housing and transport systems.",
      tags: ["写作", "城市"],
    },
    {
      id: "accountability",
      kind: "word",
      term: "accountability",
      translation: "问责；责任制",
      note: "政府和机构类题目很好用。",
      example: "Greater accountability can improve the quality of public services.",
      tags: ["写作", "政府"],
    },
    {
      id: "innovation",
      kind: "word",
      term: "innovation",
      translation: "创新",
      note: "科技和教育题常见。",
      example: "Innovation is essential if countries want to remain competitive internationally.",
      tags: ["写作", "科技"],
    },
    {
      id: "prioritise",
      kind: "word",
      term: "prioritise",
      translation: "优先考虑",
      note: "议论文中表达取舍很常用。",
      example: "Authorities should prioritise affordable housing over luxury developments.",
      tags: ["写作", "论证"],
    },
    {
      id: "undermine",
      kind: "word",
      term: "undermine",
      translation: "削弱；损害",
      note: "负面因果关系表达很有力。",
      example: "A constant focus on test scores may undermine students' curiosity.",
      tags: ["写作", "影响"],
    },
    {
      id: "mandatory",
      kind: "word",
      term: "mandatory",
      translation: "强制的",
      note: "政府政策和学校规定题高频。",
      example: "Some people argue that community service should be mandatory for teenagers.",
      tags: ["写作", "政策"],
    },
    {
      id: "accessible",
      kind: "word",
      term: "accessible",
      translation: "易获得的；可到达的",
      note: "公共服务和教育机会题很常用。",
      example: "Public transport should be affordable and accessible to all residents.",
      tags: ["写作", "社会"],
    },
    {
      id: "justify",
      kind: "word",
      term: "justify",
      translation: "证明……合理；为……辩护",
      note: "表达立场时很有用。",
      example: "The long-term benefits may justify the initial cost of the policy.",
      tags: ["写作", "论证"],
    },
    {
      id: "implementation",
      kind: "word",
      term: "implementation",
      translation: "实施；执行",
      note: "方案落地类表达高频。",
      example: "The policy failed because its implementation was poorly planned.",
      tags: ["写作", "政策"],
    },
    {
      id: "educational-perspective",
      kind: "chunk",
      term: "from an educational perspective",
      translation: "从教育角度来看",
      note: "Task 2 展开观点很自然。",
      example: "From an educational perspective, smaller classes can improve participation.",
      tags: ["写作词块", "观点"],
    },
    {
      id: "heavy-burden",
      kind: "chunk",
      term: "place a heavy burden on",
      translation: "给……带来沉重负担",
      note: "表达成本和压力很实用。",
      example: "Rising housing prices place a heavy burden on young families.",
      tags: ["写作词块", "影响"],
    },
    {
      id: "positive-change",
      kind: "chunk",
      term: "bring about positive change",
      translation: "带来积极变化",
      note: "政策效果和总结段很常用。",
      example: "Well-designed regulations can bring about positive change in the long run.",
      tags: ["写作词块", "结果"],
    },
    {
      id: "widely-argued",
      kind: "chunk",
      term: "it is widely argued that",
      translation: "人们普遍认为",
      note: "引入观点时很顺手。",
      example: "It is widely argued that schools should do more than teach academic subjects.",
      tags: ["写作词块", "引入"],
    },
    {
      id: "practical-steps",
      kind: "chunk",
      term: "take practical steps to",
      translation: "采取切实措施去……",
      note: "解决方案段落高频。",
      example: "Governments must take practical steps to improve air quality in major cities.",
      tags: ["写作词块", "解决方案"],
    },
    {
      id: "outweigh-drawbacks",
      kind: "chunk",
      term: "the benefits are likely to outweigh the drawbacks",
      translation: "利大于弊",
      note: "利弊题结论段非常常见。",
      example: "In this case, the benefits are likely to outweigh the drawbacks.",
      tags: ["写作词块", "结论"],
    },
  ]),
  ...createExpandedVocabularyEntries("speak", "speaking", [
    {
      id: "neighbourhood",
      kind: "word",
      term: "neighbourhood",
      translation: "街区；居住社区",
      note: "Part 1 Home and Hometown 高频。",
      example: "I like my neighbourhood because it is quiet and everything is within walking distance.",
      tags: ["口语", "家乡"],
    },
    {
      id: "memorable",
      kind: "word",
      term: "memorable",
      translation: "难忘的",
      note: "Part 2 描述经历时非常常用。",
      example: "It was a memorable trip because it was the first time I travelled alone.",
      tags: ["口语", "经历"],
    },
    {
      id: "relieved",
      kind: "word",
      term: "relieved",
      translation: "如释重负的",
      note: "表达情绪变化很自然。",
      example: "I felt relieved after finishing my final presentation.",
      tags: ["口语", "感受"],
    },
    {
      id: "overwhelming",
      kind: "word",
      term: "overwhelming",
      translation: "让人应接不暇的；压倒性的",
      note: "城市、工作和活动题很好用。",
      example: "At first, moving to a big city was a bit overwhelming for me.",
      tags: ["口语", "感受"],
    },
    {
      id: "affordable",
      kind: "word",
      term: "affordable",
      translation: "负担得起的",
      note: "购物、住房和交通题高频。",
      example: "Public transport is convenient and much more affordable than driving.",
      tags: ["口语", "生活"],
    },
    {
      id: "spacious",
      kind: "word",
      term: "spacious",
      translation: "宽敞的",
      note: "描述房间、建筑和公园都能用。",
      example: "My favourite cafe is bright and spacious, so it is a good place to study.",
      tags: ["口语", "地点"],
    },
    {
      id: "energetic",
      kind: "word",
      term: "energetic",
      translation: "精力充沛的",
      note: "描述人物和生活状态常见。",
      example: "My younger brother is energetic and always wants to try new sports.",
      tags: ["口语", "人物"],
    },
    {
      id: "reserved",
      kind: "word",
      term: "reserved",
      translation: "内向的；含蓄的",
      note: "人物性格题很实用。",
      example: "I used to be quite reserved, but university made me more confident.",
      tags: ["口语", "人物"],
    },
    {
      id: "rewarding",
      kind: "word",
      term: "rewarding",
      translation: "有成就感的；值得做的",
      note: "工作、学习和兴趣题高频。",
      example: "Teaching children can be demanding, but it is also very rewarding.",
      tags: ["口语", "学习工作"],
    },
    {
      id: "hectic",
      kind: "word",
      term: "hectic",
      translation: "忙乱的",
      note: "日常生活和工作节奏题常见。",
      example: "My weekdays are usually hectic because I have classes and a part-time job.",
      tags: ["口语", "生活"],
    },
    {
      id: "sociable",
      kind: "word",
      term: "sociable",
      translation: "善于交际的",
      note: "人物题常见形容词。",
      example: "She is extremely sociable, so she makes friends almost everywhere she goes.",
      tags: ["口语", "人物"],
    },
    {
      id: "practical",
      kind: "word",
      term: "practical",
      translation: "实用的；务实的",
      note: "礼物、建议和学习方法题都能用。",
      example: "I prefer practical gifts because I can actually use them in daily life.",
      tags: ["口语", "观点"],
    },
    {
      id: "frustrating",
      kind: "word",
      term: "frustrating",
      translation: "令人沮丧的",
      note: "表达问题和困难很自然。",
      example: "It can be frustrating when public transport is delayed during rush hour.",
      tags: ["口语", "感受"],
    },
    {
      id: "delighted",
      kind: "word",
      term: "delighted",
      translation: "非常高兴的",
      note: "表达积极情绪时比 happy 更自然。",
      example: "I was delighted when I heard that I had passed the interview.",
      tags: ["口语", "感受"],
    },
    {
      id: "childhood",
      kind: "word",
      term: "childhood",
      translation: "童年",
      note: "人物、经历和旧物题高频。",
      example: "This song reminds me of my childhood because my parents used to play it at home.",
      tags: ["口语", "经历"],
    },
    {
      id: "motivation",
      kind: "word",
      term: "motivation",
      translation: "动力；积极性",
      note: "学习、工作和习惯题高频。",
      example: "My main motivation for learning English is to study abroad in the future.",
      tags: ["口语", "学习工作"],
    },
    {
      id: "routine",
      kind: "word",
      term: "routine",
      translation: "日常安排；惯例",
      note: "Part 1 生活习惯题常见。",
      example: "I try to keep a simple morning routine so I can start the day calmly.",
      tags: ["口语", "习惯"],
    },
    {
      id: "inconvenient",
      kind: "word",
      term: "inconvenient",
      translation: "不方便的",
      note: "交通、时间和位置题实用。",
      example: "It is a bit inconvenient that the gym is so far from my apartment.",
      tags: ["口语", "生活"],
    },
    {
      id: "impresses-me-most",
      kind: "chunk",
      term: "what impresses me most is",
      translation: "最让我印象深刻的是",
      note: "Part 2 展开细节很好用。",
      example: "What impresses me most is how friendly the local people were.",
      tags: ["词块", "展开"],
    },
    {
      id: "honest-with-you",
      kind: "chunk",
      term: "to be honest with you",
      translation: "老实说",
      note: "Part 1 自然口语衔接高频。",
      example: "To be honest with you, I do not cook very often because I am usually busy.",
      tags: ["词块", "口语衔接"],
    },
    {
      id: "ended-up",
      kind: "chunk",
      term: "I ended up",
      translation: "结果我……；最后我……",
      note: "讲经历变化非常自然。",
      example: "I planned to stay for one hour, but I ended up spending the whole afternoon there.",
      tags: ["词块", "经历"],
    },
    {
      id: "reminds-me-of",
      kind: "chunk",
      term: "it reminds me of",
      translation: "它让我想起……",
      note: "物品、地方和人物题非常常见。",
      example: "It reminds me of the small park near my primary school.",
      tags: ["词块", "回忆"],
    },
    {
      id: "main-reasons",
      kind: "chunk",
      term: "one of the main reasons is that",
      translation: "其中一个主要原因是……",
      note: "回答 why 问题很顺手。",
      example: "One of the main reasons is that it saves me a lot of time.",
      tags: ["词块", "原因"],
    },
    {
      id: "mixed-feelings",
      kind: "chunk",
      term: "I have mixed feelings about",
      translation: "我对……看法有些复杂",
      note: "Part 3 表达平衡观点很实用。",
      example: "I have mixed feelings about online shopping because it is convenient but wasteful.",
      tags: ["词块", "观点"],
    },
  ]),
];

vocabularyBank.push(...expandedVocabularyBank);
if (Array.isArray(window.__LEXICON_LARGE_VOCABULARY__)) {
  vocabularyBank.push(...window.__LEXICON_LARGE_VOCABULARY__);
}

const speakingMockBank = {
  part1: [
    {
      id: "part1-home",
      part: "part1",
      title: "Home and Hometown",
      intro: "练习 Part 1 的短回答，重点是自然、直接、给一点细节。",
      questions: [
        "Where do you live now?",
        "What do you like most about your neighbourhood?",
        "Is your hometown a good place for young people?",
        "Would you like to move in the future?",
      ],
      targetDuration: { min: 90, max: 140 },
      materials: ["within walking distance", "a close-knit community", "on a regular basis", "commute"],
      angles: ["地点特点", "生活便利性", "个人偏好", "未来变化"],
    },
    {
      id: "part1-study",
      part: "part1",
      title: "Study or Work",
      intro: "用 2-4 句回答每个问题，尽量避免只有 yes / no。",
      questions: [
        "What do you study or what kind of work do you do?",
        "What part of it do you find most rewarding?",
        "Do you prefer working alone or with other people?",
        "Would you like to change your field in the future?",
      ],
      targetDuration: { min: 90, max: 140 },
      materials: ["flexible", "play a crucial role in", "be better equipped to", "keep in touch with"],
      angles: ["职责", "感受", "原因", "未来规划"],
    },
    {
      id: "part1-free-time",
      part: "part1",
      title: "Free Time and Habits",
      intro: "Part 1 常考爱好和生活方式，重点是回答自然，不要背模板感太重。",
      questions: [
        "What do you usually do in your leisure time?",
        "Do you prefer staying at home or going out at weekends?",
        "Have your hobbies changed over time?",
        "Do you think people need more free time nowadays?",
      ],
      targetDuration: { min: 90, max: 140 },
      materials: ["leisure", "on a regular basis", "strike a balance between", "broaden my horizons"],
      angles: ["现在的习惯", "过去与现在", "原因", "个人看法"],
    },
  ],
  part2: [
    {
      id: "part2-teacher",
      part: "part2",
      title: "Describe a Teacher Who Influenced You",
      intro: "Cue Card 建议按背景 - 细节 - 感受 - 影响来讲，尽量撑满 1-2 分钟。",
      questions: [
        "who this person is",
        "when you met this person",
        "what this person did that impressed you",
        "and explain why this person influenced you so much",
      ],
      targetDuration: { min: 95, max: 135 },
      materials: ["inspiring", "step out of my comfort zone", "What stands out to me is that...", "The reason I remember this person so clearly is that..."],
      angles: ["背景介绍", "具体事件", "个人感受", "长期影响"],
    },
    {
      id: "part2-place",
      part: "part2",
      title: "Describe a Place You Want to Revisit",
      intro: "地点题要有画面感，别只列景点，最好补上体验和原因。",
      questions: [
        "where the place is",
        "when you went there",
        "what you did there",
        "and explain why you would like to go there again",
      ],
      targetDuration: { min: 95, max: 135 },
      materials: ["memorable", "broaden my horizons", "within walking distance", "Another point worth mentioning is that..."],
      angles: ["地点信息", "活动细节", "情绪感受", "再次去的原因"],
    },
    {
      id: "part2-skill",
      part: "part2",
      title: "Describe a Skill You Learned Later in Life",
      intro: "技能题适合讲学习过程、困难点和变化。",
      questions: [
        "what the skill is",
        "when you learned it",
        "how you learned it",
        "and explain how it changed you",
      ],
      targetDuration: { min: 95, max: 135 },
      materials: ["be better equipped to", "step out of my comfort zone", "on a regular basis", "That experience taught me that..."],
      angles: ["起点", "学习过程", "挑战", "结果"],
    },
  ],
  part3: [
    {
      id: "part3-education",
      part: "part3",
      title: "Education and Role Models",
      intro: "Part 3 更像深入讨论，建议每题至少给观点 + 原因 + 例子。",
      questions: [
        "Why do some teachers have a stronger impact on students than others?",
        "Do you think schools should focus more on practical skills?",
        "How can adults continue learning after leaving school?",
        "What makes someone a good role model for young people?",
      ],
      targetDuration: { min: 120, max: 180 },
      materials: ["From my perspective,...", "play a crucial role in", "in the long run", "To give a specific example,..."],
      angles: ["观点", "原因", "例子", "社会层面"],
    },
    {
      id: "part3-cities",
      part: "part3",
      title: "Cities, Tourism and Public Space",
      intro: "Part 3 城市与公共议题常见，注意比较不同群体的影响。",
      questions: [
        "How does tourism affect local communities?",
        "Should cities invest more in public spaces?",
        "Why do some people prefer to live in smaller towns?",
        "How can city governments make urban life less stressful?",
      ],
      targetDuration: { min: 120, max: 180 },
      materials: ["from a policy perspective", "sustainable", "address the root cause", "disproportionately"],
      angles: ["正反影响", "政府措施", "居民体验", "长期结果"],
    },
    {
      id: "part3-skills",
      part: "part3",
      title: "Skills, Technology and Lifelong Learning",
      intro: "这类题要体现抽象讨论能力，别只讲自己的例子。",
      questions: [
        "Which skills are becoming more important today?",
        "Can technology replace traditional teaching completely?",
        "Why do some adults stop learning new things?",
        "How can society encourage lifelong learning?",
      ],
      targetDuration: { min: 120, max: 180 },
      materials: ["viable", "be better equipped to", "in the long run", "Another point worth mentioning is that..."],
      angles: ["趋势判断", "原因分析", "解决方案", "社会影响"],
    },
  ],
};

const writingPromptBank = {
  task1: [
    {
      id: "writing-task1-energy",
      task: "task1",
      genre: "line graph",
      title: "能源占比变化",
      intro: "Task 1 先盯 overview，再抓显著趋势和国家之间的对比。",
      prompt: "The line graph compares the share of electricity generated from wind and solar energy in France and Germany from 2000 to 2020.",
      details: [
        "France wind: 5% -> 28%",
        "France solar: 1% -> 18%",
        "Germany wind: 8% -> 24%",
        "Germany solar: 0% -> 21%",
      ],
      checklist: ["写清 overall trend", "至少比较两组数据", "避免加入个人观点"],
      materials: ["Overall, it is clear that...", "By contrast,...", "rose steadily", "remained the lowest"],
      keywords: ["wind", "solar", "france", "germany", "electricity", "increase"],
      minimumWords: 150,
      source: "Cambridge-style 改写题",
    },
    {
      id: "writing-task1-commute",
      task: "task1",
      genre: "bar chart",
      title: "两城通勤方式",
      intro: "这类柱图题适合按城市或交通方式分组写，避免流水账。",
      prompt: "The bar chart compares the proportion of commuters using car, bus and bicycle in two cities in 2000 and 2020.",
      details: [
        "City A: car 52% -> 40%, bus 28% -> 25%, bicycle 20% -> 35%",
        "City B: car 46% -> 50%, bus 34% -> 24%, bicycle 20% -> 26%",
      ],
      checklist: ["先总览 major changes", "多用比较句", "至少指出一个最高或最低项"],
      materials: ["accounted for", "stood at", "whereas", "The highest figure was recorded for..."],
      keywords: ["commuters", "car", "bus", "bicycle", "city", "proportion"],
      minimumWords: 150,
      source: "Cambridge-style 改写题",
    },
    {
      id: "writing-task1-recycle",
      task: "task1",
      genre: "process diagram",
      title: "塑料瓶回收流程",
      intro: "流程图要按顺序组织，多用被动语态和顺序连接词。",
      prompt: "The diagram shows how used plastic bottles are recycled.",
      details: [
        "collection",
        "sorting by type",
        "crushing",
        "heating and pellet production",
        "manufacturing new products",
      ],
      checklist: ["按先后顺序写", "多用被动", "用两到三个顺序衔接词"],
      materials: ["At the initial stage,...", "This is followed by...", "subsequently", "finally"],
      keywords: ["plastic bottles", "recycled", "sorting", "heating", "products"],
      minimumWords: 150,
      source: "Cambridge-style 改写题",
    },
    {
      id: "writing-task1-map",
      task: "task1",
      genre: "maps",
      title: "海边村庄变化",
      intro: "地图题核心是土地用途变化和空间关系，不是单纯列位置。",
      prompt: "The maps show how a coastal village changed between 1995 and 2025.",
      details: [
        "farmland replaced by housing",
        "fishing port expanded",
        "new road and car park added",
        "small hotel built near the beach",
      ],
      checklist: ["先写 overall change", "多用 has been replaced / was added", "抓 major land-use changes"],
      materials: ["has been replaced by", "was converted into", "was added", "Overall, the area became more..."],
      keywords: ["village", "changed", "housing", "port", "road", "hotel"],
      minimumWords: 150,
      source: "Cambridge-style 改写题",
    },
  ],
  task2: [
    {
      id: "writing-task2-education",
      task: "task2",
      genre: "discuss both views",
      title: "儿童是否应尽早入学",
      intro: "讨论双方观点时，别只平铺两边，要在结尾明确自己的态度。",
      prompt: "Some people think children should begin formal education at a very early age, while others believe they should start school later. Discuss both views and give your own opinion.",
      details: ["可比较 discipline vs emotional maturity", "最后一定要写自己的判断"],
      checklist: ["开头亮立场", "两边都覆盖", "每段至少展开一层原因"],
      materials: ["Although both views have merit,...", "From my perspective,...", "A key reason is that...", "For example,..."],
      keywords: ["children", "formal education", "early age", "school", "later"],
      minimumWords: 250,
      source: "Cambridge-style 改写题",
    },
    {
      id: "writing-task2-transport",
      task: "task2",
      genre: "discuss both views",
      title: "公共交通还是修路",
      intro: "适合用比较框架写长期效率、环境影响和实施速度。",
      prompt: "Some people think governments should spend more money on public transport, while others believe building more roads is a better solution to traffic congestion. Discuss both views and give your opinion.",
      details: ["可比较 long-term efficiency, environmental impact, implementation speed"],
      checklist: ["比较标准要清楚", "立场不要摇摆", "结尾重申观点"],
      materials: ["Compared with...", "The primary advantage is that...", "however", "in the long run"],
      keywords: ["governments", "public transport", "roads", "traffic congestion"],
      minimumWords: 250,
      source: "Cambridge-style 改写题",
    },
    {
      id: "writing-task2-remote",
      task: "task2",
      genre: "advantages disadvantages",
      title: "远程办公利弊",
      intro: "这类题型一定要明确哪一边更强，不能只写一半。",
      prompt: "Remote working is becoming increasingly common. Do the advantages of this trend outweigh the disadvantages?",
      details: ["可写 flexibility, lower commuting costs, isolation, weaker team communication"],
      checklist: ["明确判断哪边更强", "每段只盯一个优势或劣势", "最好补一个具体场景"],
      materials: ["While this may bring short-term benefits,...", "As a result,...", "for instance", "outweigh"],
      keywords: ["remote working", "advantages", "disadvantages", "common"],
      minimumWords: 250,
      source: "Cambridge-style 改写题",
    },
    {
      id: "writing-task2-environment",
      task: "task2",
      genre: "agree or disagree",
      title: "环保责任主要在政府吗",
      intro: "extent 题型可以部分同意，但态度必须稳定清楚。",
      prompt: "Some people believe that protecting the environment is mainly the responsibility of governments rather than individuals. To what extent do you agree or disagree?",
      details: ["可比较 policy power vs individual daily habits"],
      checklist: ["回答 extent", "用例子说明责任边界", "避免两边都沾一点却没有结论"],
      materials: ["To a large extent,...", "Nevertheless,...", "play a crucial role in", "This is because..."],
      keywords: ["environment", "governments", "individuals", "responsibility", "agree"],
      minimumWords: 250,
      source: "Cambridge-style 改写题",
    },
    {
      id: "writing-task2-housing",
      task: "task2",
      genre: "problem and solution",
      title: "年轻人买不起房",
      intro: "问题解决题要避免空泛，问题和方案都要具体可执行。",
      prompt: "In many cities, young people are finding it difficult to afford housing. What problems does this cause, and what solutions can be suggested?",
      details: ["问题：晚婚晚育、长距离通勤、压力更大", "解决：补贴、保障房、增加供给"],
      checklist: ["问题和方案都覆盖", "至少写一个具体后果", "solution 要有执行主体"],
      materials: ["This problem can be addressed by...", "As a consequence,...", "low-income households", "subsidise"],
      keywords: ["cities", "young people", "afford housing", "problems", "solutions"],
      minimumWords: 250,
      source: "Cambridge-style 改写题",
    },
    {
      id: "writing-task2-ai-education",
      task: "task2",
      genre: "positive or negative",
      title: "人工智能会改变教师角色吗",
      intro: "这类发展题要说明影响对象和长短期后果。",
      prompt: "Artificial intelligence is likely to change the role of teachers in the future. Is this a positive or negative development?",
      details: ["可写 personalised learning, feedback speed, overreliance, reduced human guidance"],
      checklist: ["明确正负判断", "段落围绕影响对象展开", "不要只列优缺点不下结论"],
      materials: ["From my perspective,...", "A key reason is that...", "This could lead to...", "human guidance"],
      keywords: ["artificial intelligence", "teachers", "future", "positive", "negative"],
      minimumWords: 250,
      source: "Cambridge-style 改写题",
    },
  ],
};

const DEFAULT_STATE = {
  meta: {
    updatedAt: 0,
  },
  settings: {
    dailyLimit: 12,
    reviewScheme: "standard",
    focusCategory: "all",
    accent: "uk",
    writingTargetBand: "7.0",
  },
  progress: {},
  logs: {},
  speakingHistory: [],
  speakingArchive: [],
  speakingMockArchive: [],
  writingDraft: {
    task: "task2",
    promptId: "writing-task2-transport",
    customPrompt: "",
    essay: "",
  },
  writingArchive: [],
};

const DEFAULT_CLOUD_SYNC_SESSION = {
  accountId: "",
  token: "",
  lastSyncedAt: 0,
};

const elements = {
  heroDueCount: document.querySelector("#hero-due-count"),
  heroNewLimit: document.querySelector("#hero-new-limit"),
  heroMasteredCount: document.querySelector("#hero-mastered-count"),
  heroStreak: document.querySelector("#hero-streak"),
  planSummary: document.querySelector("#plan-summary"),
  todayDueTotal: document.querySelector("#today-due-total"),
  todayNewSlots: document.querySelector("#today-new-slots"),
  todayReviewedCount: document.querySelector("#today-reviewed-count"),
  todayAccuracy: document.querySelector("#today-accuracy"),
  curveStrip: document.querySelector("#curve-strip"),
  deckGrid: document.querySelector("#deck-grid"),
  studySource: document.querySelector("#study-source"),
  studyCategory: document.querySelector("#study-category"),
  studyKind: document.querySelector("#study-kind"),
  studyStart: document.querySelector("#study-start"),
  studyQueueSize: document.querySelector("#study-queue-size"),
  studyQueueMeta: document.querySelector("#study-queue-meta"),
  pronunciationStatus: document.querySelector("#pronunciation-status"),
  studyCard: document.querySelector("#study-card"),
  spellingSource: document.querySelector("#spelling-source"),
  spellingCategory: document.querySelector("#spelling-category"),
  spellingStart: document.querySelector("#spelling-start"),
  spellingCard: document.querySelector("#spelling-card"),
  bankCategory: document.querySelector("#bank-category"),
  bankKind: document.querySelector("#bank-kind"),
  bankSearch: document.querySelector("#bank-search"),
  bankGrid: document.querySelector("#bank-grid"),
  timelineGrid: document.querySelector("#timeline-grid"),
  dueList: document.querySelector("#due-list"),
  dueTotalChip: document.querySelector("#due-total-chip"),
  dailyLimit: document.querySelector("#daily-limit"),
  reviewScheme: document.querySelector("#review-scheme"),
  preferredFocus: document.querySelector("#preferred-focus"),
  preferredAccent: document.querySelector("#preferred-accent"),
  cloudAuthForm: document.querySelector("#cloud-auth-form"),
  cloudSyncStatus: document.querySelector("#cloud-sync-status"),
  cloudSyncMeta: document.querySelector("#cloud-sync-meta"),
  cloudAccount: document.querySelector("#cloud-account"),
  cloudPassword: document.querySelector("#cloud-password"),
  cloudAccountChip: document.querySelector("#cloud-account-chip"),
  cloudLastSyncChip: document.querySelector("#cloud-last-sync-chip"),
  cloudRegister: document.querySelector("#cloud-register"),
  cloudLogin: document.querySelector("#cloud-login"),
  cloudSyncNow: document.querySelector("#cloud-sync-now"),
  cloudLogout: document.querySelector("#cloud-logout"),
  coachTips: document.querySelector("#coach-tips"),
  speakingMode: document.querySelector("#speaking-mode"),
  speakingPart: document.querySelector("#speaking-part"),
  speakingPrompt: document.querySelector("#speaking-prompt"),
  speakingSessionShell: document.querySelector("#speaking-session-shell"),
  speakingPromptCard: document.querySelector("#speaking-prompt-card"),
  writingTask: document.querySelector("#writing-task"),
  writingPrompt: document.querySelector("#writing-prompt"),
  writingTargetBand: document.querySelector("#writing-target-band"),
  writingPromptCard: document.querySelector("#writing-prompt-card"),
  writingAiStatusChip: document.querySelector("#writing-ai-status-chip"),
  writingAiModelMeta: document.querySelector("#writing-ai-model-meta"),
  writingCustomPrompt: document.querySelector("#writing-custom-prompt"),
  writingEssay: document.querySelector("#writing-essay"),
  writingWordCount: document.querySelector("#writing-word-count"),
  writingParagraphCount: document.querySelector("#writing-paragraph-count"),
  writingAnalyzeLocal: document.querySelector("#writing-analyze-local"),
  writingAnalyzeAi: document.querySelector("#writing-analyze-ai"),
  writingResult: document.querySelector("#writing-result"),
  writingMetrics: document.querySelector("#writing-metrics"),
  writingFocusChip: document.querySelector("#writing-focus-chip"),
  writingFocusList: document.querySelector("#writing-focus-list"),
  writingHistoryChip: document.querySelector("#writing-history-chip"),
  writingHistoryList: document.querySelector("#writing-history-list"),
  speakingAudio: document.querySelector("#speaking-audio"),
  speakingAudioPlayer: document.querySelector("#speaking-audio-player"),
  speakingTranscript: document.querySelector("#speaking-transcript"),
  speakingAnalyzeLocal: document.querySelector("#speaking-analyze-local"),
  speakingAnalyzeAi: document.querySelector("#speaking-analyze-ai"),
  speakingResetMock: document.querySelector("#speaking-reset-mock"),
  aiStatusChip: document.querySelector("#ai-status-chip"),
  aiModelMeta: document.querySelector("#ai-model-meta"),
  speakingResult: document.querySelector("#speaking-result"),
  speakingMetrics: document.querySelector("#speaking-metrics"),
  speakingGrammarChip: document.querySelector("#speaking-grammar-chip"),
  speakingGrammarList: document.querySelector("#speaking-grammar-list"),
  speakingHistoryChip: document.querySelector("#speaking-history-chip"),
  speakingHistoryList: document.querySelector("#speaking-history-list"),
  liveRegion: document.querySelector("#live-region"),
};

const vocabularyMap = new Map(vocabularyBank.map((item) => [item.id, item]));

const ui = {
  studyQueue: [],
  studyIndex: 0,
  studyReveal: false,
  studyRecycle: {},
  studyContext: {
    source: "today",
    category: "all",
    kind: "all",
  },
  spellingQueue: [],
  spellingIndex: 0,
  spellingFeedback: null,
  spellingRecycle: {},
  spellingContext: {
    source: "today",
    category: "all",
  },
  voices: [],
  pronunciationAudio: null,
  pronunciationQueue: [],
  pronunciationCache: new Map(),
  speakingAudioUrl: "",
  speakingPromptSelections: {},
  speakingMode: "full",
  speakingMockSession: {
    startedAt: null,
    activePart: "part1",
    responses: {},
    summary: null,
  },
  ai: {
    checked: false,
    available: false,
    provider: "",
    providerLabel: "",
    baseUrl: "",
    transcribeModel: "",
    reviewModel: "",
    writingReviewModel: "",
    statusHint: "",
  },
  cloud: {
    ...loadCloudSyncSession(),
    syncing: false,
    statusTone: "info",
    statusMessage: "未登录",
    statusDetail: "登录同一个同步账号后，所有接到同一云端接口的入口都能共用同一份学习进度。",
  },
};

const WRITING_CONNECTORS = [
  "however",
  "therefore",
  "moreover",
  "furthermore",
  "in addition",
  "for example",
  "for instance",
  "as a result",
  "on the other hand",
  "by contrast",
  "overall",
  "whereas",
  "while",
  "consequently",
  "similarly",
  "in conclusion",
];

const WRITING_ACADEMIC_PHRASES = [
  "overall",
  "it is clear that",
  "by contrast",
  "for example",
  "as a result",
  "compared with",
  "a key reason",
  "from my perspective",
  "i would argue",
  "the primary advantage",
  "in conclusion",
  "accounted for",
  "stood at",
  "significant",
  "considerable",
  "substantial",
  "trend",
];

const WRITING_SUBORDINATORS = [
  "because",
  "although",
  "while",
  "whereas",
  "which",
  "that",
  "when",
  "if",
  "since",
  "unless",
];

const WRITING_STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "in",
  "on",
  "for",
  "is",
  "are",
  "was",
  "were",
  "be",
  "this",
  "that",
  "it",
  "as",
  "with",
  "by",
  "at",
  "from",
  "their",
  "they",
  "them",
  "people",
  "more",
  "can",
  "should",
  "would",
  "there",
  "these",
  "those",
  "have",
  "has",
  "had",
  "about",
]);

let state = loadState();

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function createCategoryCounter() {
  return Object.fromEntries(CATEGORY_ORDER.map((category) => [category, 0]));
}

function createKindCounter() {
  return {
    word: 0,
    chunk: 0,
  };
}

function createSourceCounter() {
  return {
    study: 0,
    spelling: 0,
  };
}

function createEmptySpeakingMockSession() {
  return {
    startedAt: null,
    activePart: SPEAKING_PART_ORDER[0],
    responses: {},
    summary: null,
  };
}

function createEmptyDailyLog() {
  return {
    reviewActions: 0,
    reviewSuccesses: 0,
    reviewMistakes: 0,
    spellingAttempts: 0,
    spellingCorrect: 0,
    newLearned: 0,
    categoryActions: createCategoryCounter(),
    categorySuccesses: createCategoryCounter(),
    kindActions: createKindCounter(),
    sourceActions: createSourceCounter(),
  };
}

function hydrateDailyLog(log = {}) {
  return {
    ...createEmptyDailyLog(),
    ...log,
    categoryActions: {
      ...createCategoryCounter(),
      ...(log.categoryActions || {}),
    },
    categorySuccesses: {
      ...createCategoryCounter(),
      ...(log.categorySuccesses || {}),
    },
    kindActions: {
      ...createKindCounter(),
      ...(log.kindActions || {}),
    },
    sourceActions: {
      ...createSourceCounter(),
      ...(log.sourceActions || {}),
    },
  };
}

function isFileContext() {
  return window.location.protocol === "file:";
}

function isLoopbackHost() {
  return ["127.0.0.1", "localhost"].includes(window.location.hostname);
}

function isGitHubPagesHost() {
  return !isFileContext() && /\.github\.io$/i.test(window.location.hostname);
}

function isLocalProxyContext() {
  return isFileContext() || isLoopbackHost();
}

function isHostedContext() {
  return !isFileContext() && !isLoopbackHost();
}

function supportsSameOriginHostedApis() {
  return isHostedContext() && !isGitHubPagesHost();
}

function hasConfiguredAiApi() {
  return Boolean(RUNTIME_CONFIG.aiApiBaseUrl);
}

function hasAiApiSupport() {
  return isFileContext() || isLoopbackHost() || hasConfiguredAiApi() || supportsSameOriginHostedApis();
}

function hasConfiguredCloudSync() {
  return Boolean(RUNTIME_CONFIG.cloudSyncBaseUrl);
}

function hasCloudSyncSupport() {
  return hasConfiguredCloudSync() || supportsSameOriginHostedApis();
}

function hasConfiguredPronunciationProxy() {
  return Boolean(RUNTIME_CONFIG.pronunciationApiBaseUrl);
}

function getApiBase() {
  if (isFileContext()) {
    return LOCAL_PROXY_ORIGIN;
  }

  if (hasConfiguredAiApi()) {
    return RUNTIME_CONFIG.aiApiBaseUrl;
  }

  return "";
}

function getApiUrl(path) {
  const base = getApiBase();
  return base ? `${base}${path}` : path;
}

function getCloudApiUrl(path) {
  const base = hasConfiguredCloudSync() ? RUNTIME_CONFIG.cloudSyncBaseUrl : "";
  return base ? `${base}${path}` : path;
}

function getSharedProgressUrl() {
  if (!isLocalProxyContext()) {
    return "";
  }
  return isFileContext() ? `${LOCAL_PROXY_ORIGIN}/api/progress/state` : "/api/progress/state";
}

function hasMeaningfulState(snapshot = {}) {
  return Boolean(
    Object.keys(snapshot.progress || {}).length ||
      Object.keys(snapshot.logs || {}).length ||
      (snapshot.speakingHistory || []).length ||
      (snapshot.speakingArchive || []).length ||
      (snapshot.speakingMockArchive || []).length ||
      (snapshot.writingArchive || []).length ||
      (snapshot.writingDraft?.essay || "").trim() ||
      (snapshot.writingDraft?.customPrompt || "").trim(),
  );
}

function getStateUpdatedAt(snapshot = state) {
  return Number(snapshot?.meta?.updatedAt || 0) || 0;
}

function normalizeState(parsed = {}, options = {}) {
  const input = parsed && typeof parsed === "object" ? parsed : {};
  const storedUpdatedAt = Number(input.meta?.updatedAt || 0) || 0;
  const inferredUpdatedAt =
    storedUpdatedAt || (!options.preserveMissingTimestamp && hasMeaningfulState(input) ? Date.now() : 0);

  return {
    meta: {
      ...DEFAULT_STATE.meta,
      ...(input.meta || {}),
      updatedAt: inferredUpdatedAt,
    },
    settings: { ...DEFAULT_STATE.settings, ...(input.settings || {}) },
    progress: input.progress || {},
    logs: input.logs || {},
    speakingHistory: Array.isArray(input.speakingHistory) ? input.speakingHistory.slice(0, 6) : [],
    speakingArchive: Array.isArray(input.speakingArchive) ? input.speakingArchive.slice(0, 18) : [],
    speakingMockArchive: Array.isArray(input.speakingMockArchive) ? input.speakingMockArchive.slice(0, 12) : [],
    writingDraft: { ...DEFAULT_STATE.writingDraft, ...(input.writingDraft || {}) },
    writingArchive: Array.isArray(input.writingArchive) ? input.writingArchive.slice(0, 18) : [],
  };
}

function persistStateLocally(snapshot = state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return cloneDefaultState();
    }
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    return cloneDefaultState();
  }
}

function normalizeCloudSyncSession(parsed = {}) {
  const input = parsed && typeof parsed === "object" ? parsed : {};
  return {
    accountId: String(input.accountId || "").trim().toLowerCase(),
    token: String(input.token || "").trim(),
    lastSyncedAt: Number(input.lastSyncedAt || 0) || 0,
  };
}

function loadCloudSyncSession() {
  try {
    const raw = localStorage.getItem(CLOUD_SYNC_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_CLOUD_SYNC_SESSION };
    }
    return normalizeCloudSyncSession(JSON.parse(raw));
  } catch (error) {
    return { ...DEFAULT_CLOUD_SYNC_SESSION };
  }
}

function persistCloudSyncSession() {
  localStorage.setItem(
    CLOUD_SYNC_STORAGE_KEY,
    JSON.stringify({
      accountId: ui.cloud.accountId,
      token: ui.cloud.token,
      lastSyncedAt: ui.cloud.lastSyncedAt,
    }),
  );
}

let sharedProgressSyncTimer = null;
let sharedProgressSyncInFlight = false;
let cloudProgressSyncTimer = null;
let cloudProgressSyncInFlight = false;

async function fetchSharedProgressSnapshot() {
  const endpoint = getSharedProgressUrl();
  if (!endpoint) {
    return null;
  }

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error("shared progress unavailable");
  }
  return response.json();
}

async function pushSharedProgressSnapshot(snapshot = state) {
  const endpoint = getSharedProgressUrl();
  if (!endpoint || sharedProgressSyncInFlight) {
    return false;
  }

  sharedProgressSyncInFlight = true;
  try {
    const payload = {
      state: snapshot,
      updatedAt: getStateUpdatedAt(snapshot) || Date.now(),
    };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error("shared progress save failed");
    }

    const serverPayload = await response.json().catch(() => ({}));
    if (serverPayload?.state && !serverPayload.conflict) {
      state = normalizeState(serverPayload.state, { preserveMissingTimestamp: true });
      persistStateLocally(state);
    }
    return true;
  } catch (error) {
    return false;
  } finally {
    sharedProgressSyncInFlight = false;
  }
}

function scheduleSharedProgressSync() {
  if (!getSharedProgressUrl()) {
    return;
  }

  if (sharedProgressSyncTimer) {
    clearTimeout(sharedProgressSyncTimer);
  }
  sharedProgressSyncTimer = setTimeout(() => {
    sharedProgressSyncTimer = null;
    pushSharedProgressSnapshot();
  }, SHARED_PROGRESS_SYNC_DELAY);
}

async function syncSharedProgressOnStartup() {
  const endpoint = getSharedProgressUrl();
  if (!endpoint) {
    return;
  }

  try {
    const remotePayload = await fetchSharedProgressSnapshot();
    const remoteState = remotePayload?.state ? normalizeState(remotePayload.state, { preserveMissingTimestamp: true }) : null;
    const remoteUpdatedAt = Math.max(Number(remotePayload?.updatedAt || 0) || 0, getStateUpdatedAt(remoteState));
    const localUpdatedAt = getStateUpdatedAt(state);

    if (remoteState && remoteUpdatedAt > localUpdatedAt) {
      state = remoteState;
      persistStateLocally(state);
      return;
    }

    if (localUpdatedAt > remoteUpdatedAt || (hasMeaningfulState(state) && !remoteUpdatedAt)) {
      await pushSharedProgressSnapshot(state);
    }
  } catch (error) {
    // Local proxy is optional; if it's not running, we keep the local snapshot silently.
  }
}

function getDefaultCloudSyncDetail() {
  if (!hasCloudSyncSupport()) {
    if (isGitHubPagesHost()) {
      return "GitHub Pages 版默认只保存浏览器本地进度；如果还想跨设备同步，请在 site-config.js 里配置 backendBaseUrl（或 cloudSyncBaseUrl）指向独立后端。";
    }
    return "当前入口默认只保留浏览器本地进度；如果还想跨设备同步，请在 site-config.js 里配置 backendBaseUrl（或 cloudSyncBaseUrl）指向独立后端。";
  }

  return "登录同一个同步账号后，所有接到同一云端接口的入口都能共用同一份学习进度。";
}

function setCloudSyncStatus(message, tone = "info", detail = "") {
  ui.cloud.statusMessage = message;
  ui.cloud.statusTone = tone;
  ui.cloud.statusDetail = detail || getDefaultCloudSyncDetail();
  renderCloudSyncUi();
}

function renderCloudSyncUi() {
  if (!elements.cloudSyncStatus) {
    return;
  }

  const backendAvailable = hasCloudSyncSupport();
  const loggedIn = backendAvailable && Boolean(ui.cloud.token);
  const statusMessage = ui.cloud.statusMessage || "未登录";
  const statusTone = ui.cloud.statusTone || "info";
  const lastSyncLabel = ui.cloud.lastSyncedAt ? formatCalendarDate(ui.cloud.lastSyncedAt) : "尚未同步";

  elements.cloudSyncStatus.textContent = `云端同步：${statusMessage}`;
  elements.cloudSyncStatus.className = `chip chip--${statusTone}`;
  elements.cloudSyncMeta.textContent = ui.cloud.statusDetail || getDefaultCloudSyncDetail();
  elements.cloudAccountChip.textContent = loggedIn ? `当前账号：${ui.cloud.accountId}` : "当前：本地模式";
  elements.cloudLastSyncChip.textContent = `最近同步：${lastSyncLabel}`;

  if (elements.cloudAccount) {
    if (loggedIn) {
      elements.cloudAccount.value = ui.cloud.accountId;
    }
    elements.cloudAccount.disabled = ui.cloud.syncing || !backendAvailable;
  }

  if (elements.cloudPassword) {
    elements.cloudPassword.disabled = ui.cloud.syncing || !backendAvailable;
  }

  if (elements.cloudRegister) {
    elements.cloudRegister.disabled = ui.cloud.syncing || !backendAvailable;
  }
  if (elements.cloudLogin) {
    elements.cloudLogin.disabled = ui.cloud.syncing || !backendAvailable;
  }
  if (elements.cloudSyncNow) {
    elements.cloudSyncNow.disabled = ui.cloud.syncing || !loggedIn || !backendAvailable;
  }
  if (elements.cloudLogout) {
    elements.cloudLogout.disabled = ui.cloud.syncing || !loggedIn || !backendAvailable;
  }
}

function resetCloudSyncSession(options = {}) {
  const { message = "未登录", tone = "info", detail = getDefaultCloudSyncDetail(), clearAccountInput = false } = options;
  if (cloudProgressSyncTimer) {
    clearTimeout(cloudProgressSyncTimer);
    cloudProgressSyncTimer = null;
  }
  ui.cloud.accountId = "";
  ui.cloud.token = "";
  ui.cloud.lastSyncedAt = 0;
  ui.cloud.syncing = false;
  persistCloudSyncSession();
  if (elements.cloudPassword) {
    elements.cloudPassword.value = "";
  }
  if (clearAccountInput && elements.cloudAccount) {
    elements.cloudAccount.value = "";
  }
  setCloudSyncStatus(message, tone, detail);
}

function createCloudRequestError(message, status = 500, code = "cloud_sync_error") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function createAiRequestHeaders(extraHeaders = {}) {
  const headers = new Headers(extraHeaders);
  if (ui.cloud.token && !headers.has("X-Cloud-Session")) {
    headers.set("X-Cloud-Session", ui.cloud.token);
  }
  if (ui.cloud.accountId && !headers.has("X-Cloud-Account")) {
    headers.set("X-Cloud-Account", ui.cloud.accountId);
  }
  return headers;
}

function isCloudSessionError(error) {
  const errorCode = String(error?.code || "");
  const errorStatus = Number(error?.status || 0) || 0;
  return errorStatus === 401 || ["missing_session", "session_invalid", "session_expired"].includes(errorCode);
}

async function requestCloudJson(path, options = {}) {
  if (!hasCloudSyncSupport()) {
    throw createCloudRequestError(getDefaultCloudSyncDetail(), 400, "cloud_sync_unconfigured");
  }

  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (ui.cloud.token && !headers.has("X-Cloud-Session")) {
    headers.set("X-Cloud-Session", ui.cloud.token);
  }

  const response = await fetch(getCloudApiUrl(path), {
    ...options,
    headers,
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw createCloudRequestError(payload.error || "云端同步服务暂时不可用。", response.status, payload.code);
  }

  return payload;
}

async function fetchCloudProgressSnapshot() {
  if (!ui.cloud.token) {
    return null;
  }
  return requestCloudJson("/api/cloud-sync/state", {
    method: "GET",
  });
}

async function refreshUiAfterStateHydration() {
  syncSettingsUI();
  renderCurveStrip();
  if (elements.writingTask) {
    populateWritingPrompts();
    updateWritingCounts();
  }
  startStudySession();
  renderStaticPanels();
  renderSpeakingSessionShell();
  updateSpeakingActionButtons();
  renderCloudSyncUi();
}

async function applyCloudRemoteState(remoteState, updatedAt, options = {}) {
  state = normalizeState(remoteState, { preserveMissingTimestamp: true });
  persistStateLocally(state);
  if (getSharedProgressUrl()) {
    try {
      await pushSharedProgressSnapshot(state);
    } catch (error) {
      // Shared local mirror is optional; cloud sync should still succeed.
    }
  }
  ui.cloud.lastSyncedAt = Math.max(Number(updatedAt || 0) || 0, getStateUpdatedAt(state));
  persistCloudSyncSession();
  await refreshUiAfterStateHydration();
  if (options.announceMessage) {
    announce(options.announceMessage);
  }
}

function handleCloudSessionExpired(error) {
  resetCloudSyncSession({
    message: "登录已失效",
    tone: "warning",
    detail: error?.message || "云端同步账号的登录状态已经过期，请重新登录一次。",
  });
}

async function pushCloudProgressSnapshot(snapshot = state, options = {}) {
  if (!hasCloudSyncSupport() || !ui.cloud.token || cloudProgressSyncInFlight) {
    return false;
  }

  cloudProgressSyncInFlight = true;
  ui.cloud.syncing = true;
  setCloudSyncStatus(
    "同步中",
    "info",
    `正在把单词进度、今日计划和口语/写作档案写入账号“${ui.cloud.accountId}”的云端空间。`,
  );

  try {
    const payload = await requestCloudJson("/api/cloud-sync/state", {
      method: "POST",
      body: JSON.stringify({
        state: snapshot,
        updatedAt: getStateUpdatedAt(snapshot) || Date.now(),
      }),
    });

    if (payload?.state && payload.conflict) {
      await applyCloudRemoteState(payload.state, payload.updatedAt, {
        announceMessage:
          options.announceConflictMessage || "云端里有一份更新更近的进度，系统已经自动切换到那一份。",
      });
      setCloudSyncStatus("已同步", "success", `云端账号“${ui.cloud.accountId}”里有更新版本，系统已自动切到较新的进度。`);
      return true;
    }

    if (payload?.state) {
      state = normalizeState(payload.state, { preserveMissingTimestamp: true });
      persistStateLocally(state);
    }

    ui.cloud.lastSyncedAt = Number(payload?.updatedAt || getStateUpdatedAt(state) || Date.now()) || Date.now();
    persistCloudSyncSession();
    setCloudSyncStatus("已同步", "success", `当前设备和账号“${ui.cloud.accountId}”已经连上，后续本地改动会自动同步到云端。`);
    if (options.announceMessage) {
      announce(options.announceMessage);
    }
    return true;
  } catch (error) {
    if (isCloudSessionError(error)) {
      handleCloudSessionExpired(error);
    } else {
      setCloudSyncStatus("同步失败", "danger", error?.message || "云端同步暂时不可用，请稍后再试。");
    }
    return false;
  } finally {
    ui.cloud.syncing = false;
    cloudProgressSyncInFlight = false;
    renderCloudSyncUi();
  }
}

function scheduleCloudProgressSync() {
  if (!ui.cloud.token || !hasCloudSyncSupport()) {
    return;
  }

  if (cloudProgressSyncTimer) {
    clearTimeout(cloudProgressSyncTimer);
  }

  setCloudSyncStatus("待同步", "warning", `检测到本地进度有更新，系统会在短暂空闲后自动同步到账号“${ui.cloud.accountId}”。`);
  cloudProgressSyncTimer = setTimeout(() => {
    cloudProgressSyncTimer = null;
    pushCloudProgressSnapshot();
  }, CLOUD_PROGRESS_SYNC_DELAY);
}

async function syncCloudProgressOnStartup(options = {}) {
  if (!hasCloudSyncSupport()) {
    setCloudSyncStatus("本地模式", "info", getDefaultCloudSyncDetail());
    return;
  }

  if (!ui.cloud.token) {
    setCloudSyncStatus("未登录", "info", getDefaultCloudSyncDetail());
    return;
  }

  ui.cloud.syncing = true;
  setCloudSyncStatus("连接中", "info", `正在连接云端账号“${ui.cloud.accountId}”，检查是否有更新的学习进度。`);

  try {
    const remotePayload = await fetchCloudProgressSnapshot();
    if (remotePayload?.accountId) {
      ui.cloud.accountId = String(remotePayload.accountId || ui.cloud.accountId).trim().toLowerCase();
      persistCloudSyncSession();
    }

    const remoteState = remotePayload?.state ? normalizeState(remotePayload.state, { preserveMissingTimestamp: true }) : null;
    const remoteUpdatedAt = Math.max(Number(remotePayload?.updatedAt || 0) || 0, getStateUpdatedAt(remoteState));
    const localUpdatedAt = getStateUpdatedAt(state);

    if (remoteState && remoteUpdatedAt > localUpdatedAt) {
      await applyCloudRemoteState(remoteState, remoteUpdatedAt, {
        announceMessage: options.announceMessage || "",
      });
      setCloudSyncStatus("已同步", "success", `已从账号“${ui.cloud.accountId}”拉回一份更新更近的学习进度。`);
      return;
    }

    if (localUpdatedAt > remoteUpdatedAt || (hasMeaningfulState(state) && !remoteUpdatedAt)) {
      await pushCloudProgressSnapshot(state, {
        announceMessage: options.announceMessage || "",
      });
      return;
    }

    ui.cloud.lastSyncedAt = remoteUpdatedAt || ui.cloud.lastSyncedAt || Date.now();
    persistCloudSyncSession();
    setCloudSyncStatus("已同步", "success", `当前设备和账号“${ui.cloud.accountId}”已经保持同一份进度。`);
    if (options.announceMessage) {
      announce(options.announceMessage);
    }
  } catch (error) {
    if (isCloudSessionError(error)) {
      handleCloudSessionExpired(error);
    } else {
      setCloudSyncStatus("连接失败", "danger", error?.message || "暂时连不上云端同步服务，请稍后再试。");
    }
  } finally {
    ui.cloud.syncing = false;
    renderCloudSyncUi();
  }
}

async function handleCloudAuth(action) {
  if (!hasCloudSyncSupport()) {
    setCloudSyncStatus("本地模式", "info", getDefaultCloudSyncDetail());
    return;
  }

  const accountId = elements.cloudAccount?.value?.trim() || "";
  const password = elements.cloudPassword?.value || "";

  if (!accountId) {
    setCloudSyncStatus("等待输入", "warning", "先填一个同步账号，再去注册或登录。");
    return;
  }

  if (!password) {
    setCloudSyncStatus("等待输入", "warning", "还差同步口令。注册和登录都需要同一套口令。");
    return;
  }

  ui.cloud.syncing = true;
  setCloudSyncStatus(
    action === "register" ? "注册中" : "登录中",
    "info",
    action === "register"
      ? "正在创建你的云端同步账号，并准备把当前进度推上去。"
      : "正在登录云端同步账号，并准备对比本地和云端哪一份更新。",
  );

  try {
    const payload = await requestCloudJson("/api/cloud-sync/auth", {
      method: "POST",
      body: JSON.stringify({
        action,
        accountId,
        password,
      }),
    });

    ui.cloud.accountId = String(payload.accountId || accountId).trim().toLowerCase();
    ui.cloud.token = String(payload.token || "").trim();
    ui.cloud.lastSyncedAt = 0;
    persistCloudSyncSession();
    if (elements.cloudPassword) {
      elements.cloudPassword.value = "";
    }
    renderCloudSyncUi();

    await syncCloudProgressOnStartup({
      announceMessage:
        action === "register" ? "云端同步账号已创建，当前进度已经开始同步。" : "云端同步账号已登录，当前进度已经开始同步。",
    });
  } catch (error) {
    ui.cloud.syncing = false;
    setCloudSyncStatus(action === "register" ? "注册失败" : "登录失败", "danger", error?.message || "云端同步账号暂时不可用，请稍后再试。");
  } finally {
    ui.cloud.syncing = false;
    renderCloudSyncUi();
  }
}

async function handleCloudLogout() {
  if (!hasCloudSyncSupport()) {
    setCloudSyncStatus("本地模式", "info", getDefaultCloudSyncDetail());
    return;
  }

  if (!ui.cloud.token) {
    setCloudSyncStatus("未登录", "info", getDefaultCloudSyncDetail());
    return;
  }

  const currentAccount = ui.cloud.accountId;
  ui.cloud.syncing = true;
  renderCloudSyncUi();

  try {
    await requestCloudJson("/api/cloud-sync/auth", {
      method: "POST",
      body: JSON.stringify({
        action: "logout",
        token: ui.cloud.token,
      }),
    });
  } catch (error) {
    // If remote logout fails, we still clear the local session to avoid trapping the user.
  } finally {
    resetCloudSyncSession({
      message: "已退出",
      tone: "info",
      detail: currentAccount
        ? `已退出云端账号“${currentAccount}”。本地缓存还在，你之后重新登录就能继续同步。`
        : getDefaultCloudSyncDetail(),
    });
    announce("已退出云端同步账号");
  }
}

function saveState(options = {}) {
  const nextUpdatedAt = Number(options.updatedAt ?? Date.now()) || Date.now();
  state = normalizeState(
    {
      ...state,
      meta: {
        ...(state.meta || {}),
        updatedAt: nextUpdatedAt,
      },
    },
    { preserveMissingTimestamp: true },
  );
  persistStateLocally(state);
  if (!options.skipSharedSync) {
    scheduleSharedProgressSync();
  }
  if (!options.skipCloudSync) {
    scheduleCloudProgressSync();
  }
}

function ensureProgress(itemId) {
  if (!state.progress[itemId]) {
    state.progress[itemId] = {
      stage: -1,
      nextReviewAt: null,
      lastStudiedAt: null,
      reviews: 0,
      correct: 0,
      lapses: 0,
      firstSeenAt: null,
      lastRating: null,
      lastSource: null,
    };
  }
  return state.progress[itemId];
}

function getProgress(itemId) {
  return state.progress[itemId] || {
    stage: -1,
    nextReviewAt: null,
    lastStudiedAt: null,
    reviews: 0,
    correct: 0,
    lapses: 0,
    firstSeenAt: null,
    lastRating: null,
    lastSource: null,
  };
}

function ensureTodayLog() {
  const key = getDayKey();
  if (!state.logs[key]) {
    state.logs[key] = createEmptyDailyLog();
  } else {
    state.logs[key] = hydrateDailyLog(state.logs[key]);
  }
  return state.logs[key];
}

function recordTrainingAction(item, source, success) {
  if (!item) {
    return;
  }
  const log = ensureTodayLog();
  const sourceKey = source === "spelling" ? "spelling" : "study";
  log.categoryActions[item.category] = (log.categoryActions[item.category] || 0) + 1;
  log.kindActions[item.kind] = (log.kindActions[item.kind] || 0) + 1;
  log.sourceActions[sourceKey] = (log.sourceActions[sourceKey] || 0) + 1;
  if (success) {
    log.categorySuccesses[item.category] = (log.categorySuccesses[item.category] || 0) + 1;
  }
}

function getDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameCalendarDay(timestamp, referenceDate = new Date()) {
  if (!timestamp) {
    return false;
  }
  return getDayKey(new Date(timestamp)) === getDayKey(referenceDate);
}

function getDerivedTodayTrainingSnapshot(referenceDate = new Date()) {
  const categoryActions = createCategoryCounter();
  const categorySuccesses = createCategoryCounter();
  const kindActions = createKindCounter();
  const sourceActions = createSourceCounter();
  let attempts = 0;
  let successes = 0;
  let newLearned = 0;

  vocabularyBank.forEach((item) => {
    const progress = getProgress(item.id);
    if (isSameCalendarDay(progress.firstSeenAt, referenceDate)) {
      newLearned += 1;
    }
    if (!isSameCalendarDay(progress.lastStudiedAt, referenceDate)) {
      return;
    }

    attempts += 1;
    categoryActions[item.category] = (categoryActions[item.category] || 0) + 1;
    kindActions[item.kind] = (kindActions[item.kind] || 0) + 1;
    const sourceKey = progress.lastSource === "spelling" ? "spelling" : "study";
    sourceActions[sourceKey] = (sourceActions[sourceKey] || 0) + 1;

    if (progress.lastRating && progress.lastRating !== "again") {
      successes += 1;
      categorySuccesses[item.category] = (categorySuccesses[item.category] || 0) + 1;
    }
  });

  return {
    attempts,
    successes,
    newLearned,
    categoryActions,
    categorySuccesses,
    kindActions,
    sourceActions,
  };
}

function getTodayTrainingSnapshot() {
  const log = ensureTodayLog();
  const loggedAttempts = getAttemptCount(log);
  const loggedNewLearned = Number(log.newLearned || 0);
  const hasLoggedTraining =
    loggedAttempts > 0 ||
    loggedNewLearned > 0 ||
    Number(log.kindActions?.word || 0) > 0 ||
    Number(log.kindActions?.chunk || 0) > 0 ||
    Number(log.sourceActions?.study || 0) > 0 ||
    Number(log.sourceActions?.spelling || 0) > 0;

  if (!hasLoggedTraining) {
    return getDerivedTodayTrainingSnapshot();
  }

  return {
    attempts: loggedAttempts,
    successes: (log.reviewSuccesses || 0) + (log.spellingCorrect || 0),
    newLearned: loggedNewLearned,
    categoryActions: {
      ...createCategoryCounter(),
      ...(log.categoryActions || {}),
    },
    categorySuccesses: {
      ...createCategoryCounter(),
      ...(log.categorySuccesses || {}),
    },
    kindActions: {
      ...createKindCounter(),
      ...(log.kindActions || {}),
    },
    sourceActions: {
      ...createSourceCounter(),
      ...(log.sourceActions || {}),
    },
  };
}

function getPartOfSpeechText(item) {
  if (!item?.partOfSpeech) {
    return "";
  }
  return item.partOfSpeech;
}

function getIntervals() {
  return REVIEW_SCHEMES[state.settings.reviewScheme] || REVIEW_SCHEMES.standard;
}

function getItemById(itemId) {
  return vocabularyMap.get(itemId);
}

function isDue(item, now = Date.now()) {
  const progress = getProgress(item.id);
  return Boolean(progress.nextReviewAt && progress.nextReviewAt <= now);
}

function isNewItem(item) {
  return !getProgress(item.id).firstSeenAt;
}

function isMastered(item) {
  return (getProgress(item.id).stage || 0) >= 4;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatDurationShort(milliseconds) {
  if (milliseconds < HOUR) {
    return `${Math.round(milliseconds / MINUTE)} 分钟`;
  }
  if (milliseconds < DAY) {
    return `${Math.round(milliseconds / HOUR)} 小时`;
  }
  return `${Math.round(milliseconds / DAY)} 天`;
}

function formatSeconds(seconds) {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remain = totalSeconds % 60;
  if (minutes === 0) {
    return `${remain} 秒`;
  }
  return `${minutes} 分 ${remain.toString().padStart(2, "0")} 秒`;
}

function formatRelativeTime(timestamp) {
  if (!timestamp) {
    return "尚未进入复习";
  }
  const diff = timestamp - Date.now();
  if (diff <= 0) {
    return "已到期";
  }
  if (diff < HOUR) {
    return `${Math.max(1, Math.round(diff / MINUTE))} 分钟后`;
  }
  if (diff < DAY) {
    return `${Math.max(1, Math.round(diff / HOUR))} 小时后`;
  }
  return `${Math.max(1, Math.round(diff / DAY))} 天后`;
}

function formatCalendarDate(timestamp) {
  if (!timestamp) {
    return "--";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatDelta(value) {
  const rounded = Math.round(value * 10) / 10;
  if (rounded > 0) {
    return `+${rounded.toFixed(1)}`;
  }
  return rounded.toFixed(1);
}

function average(numbers) {
  if (!numbers.length) {
    return 0;
  }
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function normalizeAnswer(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countEssayWords(text) {
  const matches = text.trim().match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g);
  return matches ? matches.length : 0;
}

function splitEssayParagraphs(text) {
  return text
    .split(/\n\s*\n|\n+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function splitEssaySentences(text) {
  const matches = text.match(/[^.!?]+[.!?]?/g);
  return (matches || []).map((segment) => segment.trim()).filter(Boolean);
}

function normalizeEssayText(text) {
  return ` ${text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()} `;
}

function matchEssayPhrases(normalizedText, phrases) {
  return phrases.filter((phrase) => normalizedText.includes(` ${phrase.toLowerCase()} `));
}

function includesEssayPhrase(normalizedText, phrases) {
  return phrases.some((phrase) => normalizedText.includes(` ${phrase.toLowerCase()} `));
}

function countUniqueMeaningfulWords(text) {
  const words = (text.toLowerCase().match(/[a-z]+(?:['-][a-z]+)*/g) || []).filter((word) => !WRITING_STOP_WORDS.has(word));
  return new Set(words).size;
}

function getTopRepeatRatio(text) {
  const words = (text.toLowerCase().match(/[a-z]+(?:['-][a-z]+)*/g) || []).filter((word) => !WRITING_STOP_WORDS.has(word));
  if (!words.length) {
    return 0;
  }
  const counts = {};
  words.forEach((word) => {
    counts[word] = (counts[word] || 0) + 1;
  });
  return Math.max(...Object.values(counts)) / words.length;
}

function roundBandHalf(value) {
  return Math.round(value * 2) / 2;
}

function clampWritingBand(value) {
  return Math.min(9, Math.max(4, roundBandHalf(value)));
}

function extractPromptKeywords(text) {
  const words = text.toLowerCase().match(/[a-z]+(?:['-][a-z]+)*/g);
  if (!words) {
    return [];
  }
  return [...new Set(words.filter((word) => word.length > 4 && !WRITING_STOP_WORDS.has(word)))].slice(0, 8);
}

function createSpellingHint(term) {
  return term
    .split(" ")
    .map((word) => {
      const cleaned = word.replace(/[^a-z]/gi, "");
      if (!cleaned) {
        return word;
      }
      if (cleaned.length <= 2) {
        return `${cleaned[0] || ""}_`;
      }
      return `${cleaned[0]}${"_".repeat(Math.max(1, Math.min(cleaned.length - 2, 6)))}${cleaned[cleaned.length - 1]}`;
    })
    .join(" ");
}

function createMaskedExample(example, term) {
  if (!example || !term) {
    return example;
  }

  const normalizedTerm = term.trim();
  if (!normalizedTerm) {
    return example;
  }

  const mask = normalizedTerm
    .split(/\s+/)
    .map((part) => "_".repeat(Math.max(3, part.replace(/[^a-z]/gi, "").length || 3)))
    .join(" ");

  const exactPattern = new RegExp(escapeRegExp(normalizedTerm), "gi");
  let masked = example.replace(exactPattern, mask);

  if (masked !== example) {
    return masked;
  }

  const tokenPattern = new RegExp(
    normalizedTerm
      .split(/\s+/)
      .map((part) => escapeRegExp(part))
      .join("\\s+"),
    "gi",
  );
  masked = example.replace(tokenPattern, mask);
  return masked;
}

function resolveStudyKind(source, kind) {
  return source === "chunks" ? "chunk" : kind;
}

function getCategoryLabel(category) {
  return category === "all" ? "全部分类" : CATEGORY_META[category]?.label || "全部分类";
}

function getKindLabel(kind) {
  if (kind === "word") {
    return "只看单词";
  }
  if (kind === "chunk") {
    return "词块专练";
  }
  return "单词 + 词块";
}

function getStudySourceLabel(source) {
  const labels = {
    today: "分类混合任务",
    due: "只做复习",
    fresh: "只开新词",
    chunks: "词块专练",
  };
  return labels[source] || "今日任务";
}

function getSpellingSourceLabel(source) {
  const labels = {
    today: "跟随当前任务",
    due: "到期复习拼写",
    chunks: "词块拼写",
    category: "分类拼写",
  };
  return labels[source] || "拼写训练";
}

function formatStudySelection(context = ui.studyContext) {
  const kind = resolveStudyKind(context.source, context.kind);
  return `${getStudySourceLabel(context.source)} · ${getCategoryLabel(context.category)} · ${getKindLabel(kind)}`;
}

function formatSpellingSelection(context = ui.spellingContext) {
  return `${getSpellingSourceLabel(context.source)} · ${getCategoryLabel(context.category)}`;
}

function getStudyControlsContext() {
  return {
    source: elements.studySource.value,
    category: elements.studyCategory.value,
    kind: elements.studyKind.value,
  };
}

function getSpellingControlsContext() {
  return {
    source: elements.spellingSource.value,
    category: elements.spellingCategory.value,
  };
}

function getTodayCategorySnapshot(log = ensureTodayLog()) {
  const todayLog = ensureTodayLog();
  const snapshot =
    log === todayLog
      ? getTodayTrainingSnapshot()
      : {
          categoryActions: {
            ...createCategoryCounter(),
            ...(log.categoryActions || {}),
          },
          categorySuccesses: {
            ...createCategoryCounter(),
            ...(log.categorySuccesses || {}),
          },
        };
  return CATEGORY_ORDER.map((category) => {
    const actions = Number(snapshot.categoryActions?.[category] || 0);
    const successes = Number(snapshot.categorySuccesses?.[category] || 0);
    return {
      category,
      actions,
      successes,
      accuracy: actions ? Math.round((successes / actions) * 100) : 0,
    };
  }).sort((left, right) => {
    if (right.actions !== left.actions) {
      return right.actions - left.actions;
    }
    return CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category);
  });
}

function getCurrentStudySessionSnapshot() {
  const queueItems = ui.studyQueue.map((itemId) => getItemById(itemId)).filter(Boolean);
  const pendingItems = ui.studyQueue.slice(ui.studyIndex).map((itemId) => getItemById(itemId)).filter(Boolean);
  const categoryCounts = createCategoryCounter();

  pendingItems.forEach((item) => {
    categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
  });

  const dominantCategory = CATEGORY_ORDER.map((category) => ({
    category,
    count: categoryCounts[category] || 0,
  })).sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }
    return CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category);
  })[0];

  return {
    total: queueItems.length,
    remaining: pendingItems.length,
    due: pendingItems.filter((item) => isDue(item)).length,
    fresh: pendingItems.filter((item) => isNewItem(item)).length,
    chunks: pendingItems.filter((item) => item.kind === "chunk").length,
    dominantCategory: dominantCategory?.count ? dominantCategory.category : ui.studyContext.category,
  };
}

function syncLinkedPracticePanelsFromStudyContext(context = ui.studyContext) {
  const effectiveKind = resolveStudyKind(context.source, context.kind);

  if (elements.spellingCategory) {
    elements.spellingCategory.value = context.category;
  }
  if (elements.spellingSource) {
    elements.spellingSource.value = effectiveKind === "chunk" ? "chunks" : "today";
  }
  if (elements.bankCategory) {
    elements.bankCategory.value = context.category;
  }
  if (elements.bankKind) {
    elements.bankKind.value = effectiveKind === "all" ? "all" : effectiveKind;
  }
}

function getItemLearningProgress(itemId) {
  const progress = getProgress(itemId);
  if (!progress.firstSeenAt) {
    return 0;
  }

  const intervals = getIntervals();
  const stage = clamp(progress.stage, 0, intervals.length - 1);
  const normalized = intervals.length > 1 ? stage / (intervals.length - 1) : 1;
  return Math.min(1, 0.35 + normalized * 0.65);
}

function getFocusRank(category) {
  if (state.settings.focusCategory === "all") {
    return CATEGORY_ORDER.indexOf(category);
  }
  return category === state.settings.focusCategory ? -1 : CATEGORY_ORDER.indexOf(category) + 1;
}

function sortFreshItems(items) {
  return [...items].sort((left, right) => {
    const focusGap = getFocusRank(left.category) - getFocusRank(right.category);
    if (focusGap !== 0) {
      return focusGap;
    }
    if (left.kind !== right.kind) {
      return left.kind === "chunk" ? -1 : 1;
    }
    return left.term.localeCompare(right.term);
  });
}

function sortLearningItems(items) {
  return [...items].sort((left, right) => {
    const leftProgress = getProgress(left.id);
    const rightProgress = getProgress(right.id);
    const stageGap = (leftProgress.stage || 0) - (rightProgress.stage || 0);
    if (stageGap !== 0) {
      return stageGap;
    }
    const lastGap = (leftProgress.lastStudiedAt || 0) - (rightProgress.lastStudiedAt || 0);
    if (lastGap !== 0) {
      return lastGap;
    }
    const focusGap = getFocusRank(left.category) - getFocusRank(right.category);
    if (focusGap !== 0) {
      return focusGap;
    }
    if (left.kind !== right.kind) {
      return left.kind === "chunk" ? -1 : 1;
    }
    return left.term.localeCompare(right.term);
  });
}

function mergeUniqueItems(...groups) {
  const seen = new Set();
  const items = [];
  groups.flat().forEach((item) => {
    if (!item || seen.has(item.id)) {
      return;
    }
    seen.add(item.id);
    items.push(item);
  });
  return items;
}

function fillQueueToTarget(seedItems, fallbackItems, targetSize) {
  const queue = [...seedItems];
  const seen = new Set(queue.map((item) => item.id));

  for (const item of fallbackItems) {
    if (queue.length >= targetSize) {
      break;
    }
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    queue.push(item);
  }

  return queue;
}

function sortDueItems(items) {
  return [...items].sort((left, right) => {
    const leftDue = getProgress(left.id).nextReviewAt || 0;
    const rightDue = getProgress(right.id).nextReviewAt || 0;
    return leftDue - rightDue;
  });
}

function getFilteredItems(category = "all", kind = "all") {
  return vocabularyBank.filter((item) => {
    const categoryMatch = category === "all" || item.category === category;
    const kindMatch = kind === "all" || item.kind === kind;
    return categoryMatch && kindMatch;
  });
}

function getRemainingNewSlots() {
  return Math.max(0, state.settings.dailyLimit - getTodayTrainingSnapshot().newLearned);
}

function getAdaptiveQueueSize(category, allBase, allCap, categoryBase, categoryCap, allFactor, categoryFactor) {
  const isAllCategory = category === "all";
  const base = isAllCategory ? allBase : categoryBase;
  const cap = isAllCategory ? allCap : categoryCap;
  const factor = isAllCategory ? allFactor : categoryFactor;
  return Math.min(cap, Math.max(base, Math.ceil(state.settings.dailyLimit * factor)));
}

function buildStudyQueue(source, category, kind) {
  const effectiveKind = resolveStudyKind(source, kind);
  const filtered = getFilteredItems(category, effectiveKind);
  const dueItems = sortDueItems(filtered.filter((item) => isDue(item)));
  const freshItems = sortFreshItems(filtered.filter((item) => isNewItem(item)));
  const learningItems = sortLearningItems(filtered.filter((item) => !isDue(item) && !isNewItem(item)));
  const remainingNewSlots = getRemainingNewSlots();

  if (source === "due") {
    return dueItems.map((item) => item.id);
  }

  if (source === "fresh") {
    return freshItems.slice(0, remainingNewSlots).map((item) => item.id);
  }

  if (source === "chunks") {
    const freshSeedSize = Math.min(
      remainingNewSlots,
      freshItems.length,
      Math.max(8, Math.ceil(state.settings.dailyLimit * (category === "all" ? 0.4 : 0.3))),
    );
    const seedItems = mergeUniqueItems(dueItems, freshItems.slice(0, Math.max(freshSeedSize, 4)));
    const targetSize = Math.min(filtered.length, Math.max(seedItems.length, dueItems.length + freshSeedSize));
    return fillQueueToTarget(seedItems, learningItems, targetSize).map((item) => item.id);
  }

  const freshQuota = Math.min(remainingNewSlots, freshItems.length);
  const seedItems = mergeUniqueItems(dueItems, freshItems.slice(0, freshQuota));
  const targetSize = Math.min(filtered.length, dueItems.length + freshQuota);
  return fillQueueToTarget(seedItems, learningItems, targetSize).map((item) => item.id);
}

function buildSpellingQueue(source, category) {
  const filtered = getFilteredItems(category, source === "chunks" ? "chunk" : "all");
  const dueItems = sortDueItems(filtered.filter((item) => isDue(item)));
  const freshItems = sortFreshItems(filtered.filter((item) => isNewItem(item)));
  const mixed = sortLearningItems(filtered.filter((item) => !isDue(item) && !isNewItem(item)));

  if (source === "due") {
    return dueItems.map((item) => item.id);
  }

  if (source === "chunks") {
    const seedItems = mergeUniqueItems(
      dueItems,
      freshItems.slice(0, getAdaptiveQueueSize(category, 6, 10, 5, 8, 0.16, 0.1)),
      mixed.slice(0, 4),
    );
    const targetSize = Math.min(filtered.length, Math.max(seedItems.length, getAdaptiveQueueSize(category, 10, 18, 8, 14, 0.24, 0.18)));
    return fillQueueToTarget(seedItems, mixed, targetSize).map((item) => item.id);
  }

  if (source === "category") {
    const seedItems = mergeUniqueItems(
      dueItems,
      freshItems.slice(0, getAdaptiveQueueSize(category, 6, 10, 5, 8, 0.16, 0.1)),
      mixed.slice(0, 4),
    );
    const targetSize = Math.min(filtered.length, Math.max(seedItems.length, getAdaptiveQueueSize(category, 10, 18, 8, 14, 0.24, 0.18)));
    return fillQueueToTarget(seedItems, mixed, targetSize).map((item) => item.id);
  }

  if (source === "today" && ui.studyQueue.length) {
    const currentStudyItems = ui.studyQueue
      .map((itemId) => getItemById(itemId))
      .filter((item) => item && (category === "all" || item.category === category));
    if (currentStudyItems.length) {
      return currentStudyItems.map((item) => item.id);
    }
  }

  return buildStudyQueue("today", category, "all");
}

function getAttemptCount(log) {
  return (log.reviewActions || 0) + (log.spellingAttempts || 0);
}

function getTodayAccuracy() {
  const snapshot = getTodayTrainingSnapshot();
  const attempts = snapshot.attempts;
  if (!attempts) {
    return 0;
  }
  return Math.round((snapshot.successes / attempts) * 100);
}

function getStreak() {
  let streak = 0;
  const current = new Date();
  while (true) {
    const key = getDayKey(current);
    const log = state.logs[key];
    const hasAttempts =
      key === getDayKey() ? getTodayTrainingSnapshot().attempts > 0 : Boolean(log && getAttemptCount(log) > 0);
    if (!hasAttempts) {
      break;
    }
    streak += 1;
    current.setDate(current.getDate() - 1);
  }
  return streak;
}

function getMasteredCount() {
  return vocabularyBank.filter((item) => isMastered(item)).length;
}

function getDueCount() {
  return vocabularyBank.filter((item) => isDue(item)).length;
}

function getSpeakingArchive() {
  return Array.isArray(state.speakingArchive) ? state.speakingArchive : [];
}

function getSpeakingMockArchive() {
  return Array.isArray(state.speakingMockArchive) ? state.speakingMockArchive : [];
}

function getSpeakingPerformanceEntries() {
  const singleEntries = getSpeakingArchive().map((entry) => ({
    ...entry,
    entryType: entry.entryType || "single",
    coverageParts: entry.coverageParts || [entry.part],
  }));
  const mockEntries = getSpeakingMockArchive().map((entry) => ({
    ...entry,
    entryType: "full_mock",
    coverageParts: entry.coverageParts || [...SPEAKING_PART_ORDER],
  }));

  return [...mockEntries, ...singleEntries].sort((left, right) => (right.timestamp || 0) - (left.timestamp || 0));
}

function getLatestSpeakingPerformanceEntry() {
  return getSpeakingPerformanceEntries()[0] || null;
}

function getWritingArchive() {
  return Array.isArray(state.writingArchive) ? state.writingArchive : [];
}

function getAverageSpeakingBreakdown(entries) {
  const initial = {
    fluency_coherence: 0,
    lexical_resource: 0,
    grammatical_range_accuracy: 0,
    pronunciation: 0,
  };

  if (!entries.length) {
    return initial;
  }

  entries.forEach((entry) => {
    Object.keys(initial).forEach((key) => {
      initial[key] += Number(entry.bandBreakdown?.[key] || 0);
    });
  });

  Object.keys(initial).forEach((key) => {
    initial[key] = initial[key] / entries.length;
  });

  return initial;
}

function getSpeakingWeakestDimension(entries) {
  const labels = {
    fluency_coherence: "流利与连贯",
    lexical_resource: "词汇资源",
    grammatical_range_accuracy: "语法范围",
    pronunciation: "发音表现",
  };
  const averages = getAverageSpeakingBreakdown(entries);
  const weakestKey = Object.keys(averages).sort((left, right) => averages[left] - averages[right])[0];
  return {
    key: weakestKey,
    label: labels[weakestKey],
    score: averages[weakestKey] || 0,
  };
}

function getSpeakingCoverage(entries) {
  const parts = new Set(
    entries.flatMap((entry) => {
      if (Array.isArray(entry.coverageParts) && entry.coverageParts.length) {
        return entry.coverageParts;
      }
      return entry.part ? [entry.part] : [];
    }),
  );
  return `${parts.size}/3`;
}

function getSpeakingTrend(entries) {
  if (!entries.length) {
    return 0;
  }
  const recent = entries.slice(0, 3).map((entry) => entry.overallBand);
  const previous = entries.slice(3, 6).map((entry) => entry.overallBand);
  if (!previous.length) {
    return recent[0] - recent[recent.length - 1];
  }
  return average(recent) - average(previous);
}

function aggregateGrammarPatterns(entries) {
  const grouped = new Map();

  entries.forEach((entry) => {
    (entry.grammarPatterns || []).forEach((pattern) => {
      const rawLabel = (pattern.label || "").trim();
      const key = rawLabel.toLowerCase() || "其他";
      if (!grouped.has(key)) {
        grouped.set(key, {
          label: rawLabel || "其他语法问题",
          count: 0,
          symptom: pattern.symptom || "",
          advice: pattern.advice || "",
          evidence: pattern.evidence || "",
          lastSeenAt: entry.timestamp || 0,
        });
      }
      const current = grouped.get(key);
      current.count += 1;
      current.lastSeenAt = Math.max(current.lastSeenAt, entry.timestamp || 0);
      if (pattern.symptom) {
        current.symptom = pattern.symptom;
      }
      if (pattern.advice) {
        current.advice = pattern.advice;
      }
      if (pattern.evidence) {
        current.evidence = pattern.evidence;
      }
    });
  });

  return [...grouped.values()].sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }
    return right.lastSeenAt - left.lastSeenAt;
  });
}

function getCategoryStats(category) {
  const items = vocabularyBank.filter((item) => item.category === category);
  const studied = items.filter((item) => !isNewItem(item)).length;
  const learningProgress = items.reduce((sum, item) => sum + getItemLearningProgress(item.id), 0);
  return {
    total: items.length,
    words: items.filter((item) => item.kind === "word").length,
    chunks: items.filter((item) => item.kind === "chunk").length,
    due: items.filter((item) => isDue(item)).length,
    studied,
    mastered: items.filter((item) => isMastered(item)).length,
    progressRatio: items.length ? Math.round((learningProgress / items.length) * 100) : 0,
  };
}

function getMemoryLabel(item) {
  if (isDue(item)) {
    return "待复习";
  }
  if (isMastered(item)) {
    return "已掌握";
  }
  if (isNewItem(item)) {
    return "新词";
  }
  return "学习中";
}

function getStageLabel(itemId) {
  const progress = getProgress(itemId);
  if (!progress.firstSeenAt) {
    return "新词";
  }
  return `阶段 S${Math.max(0, progress.stage)}`;
}

function applyReviewResult(itemId, rating, source) {
  const progress = ensureProgress(itemId);
  const item = getItemById(itemId);
  const log = ensureTodayLog();
  const intervals = getIntervals();
  const now = Date.now();
  const wasNew = !progress.firstSeenAt;
  const currentStage = progress.stage;
  let nextStage = currentStage;
  let dueIn = intervals[0];

  if (rating === "again") {
    nextStage = 0;
    dueIn = intervals[0];
    progress.lapses += 1;
  } else if (rating === "hard") {
    nextStage = Math.max(0, currentStage);
    dueIn = nextStage <= 0 ? 12 * HOUR : Math.round(intervals[nextStage] * 0.75);
    progress.correct += 1;
  } else if (rating === "good") {
    nextStage = currentStage < 0 ? 1 : Math.min(intervals.length - 1, currentStage + 1);
    dueIn = intervals[nextStage];
    progress.correct += 1;
  } else {
    nextStage = currentStage < 0 ? 2 : Math.min(intervals.length - 1, currentStage + 2);
    dueIn = intervals[nextStage];
    progress.correct += 1;
  }

  if (wasNew) {
    progress.firstSeenAt = now;
    log.newLearned += 1;
  }

  progress.stage = nextStage;
  progress.nextReviewAt = now + dueIn;
  progress.lastStudiedAt = now;
  progress.reviews += 1;
  progress.lastRating = rating;
  progress.lastSource = source;
  recordTrainingAction(item, source, rating !== "again");

  if (source === "spelling") {
    log.spellingAttempts += 1;
    if (rating !== "again") {
      log.spellingCorrect += 1;
    }
  } else {
    log.reviewActions += 1;
    if (rating !== "again") {
      log.reviewSuccesses += 1;
    } else {
      log.reviewMistakes += 1;
    }
  }

  saveState();
}

function renderCurveStrip() {
  const intervals = getIntervals();
  elements.curveStrip.innerHTML = intervals
    .map(
      (interval, index) => `
        <div class="curve-step">
          <strong>第 ${index + 1} 轮</strong>
          <span>${formatDurationShort(interval)}</span>
        </div>
      `,
    )
    .join("");
}

function renderDashboard() {
  const dueCount = getDueCount();
  const masteredCount = getMasteredCount();
  const remainingNewSlots = getRemainingNewSlots();
  const log = ensureTodayLog();
  const todaySnapshot = getTodayTrainingSnapshot();
  const accuracy = getTodayAccuracy();
  const focusLabel =
    state.settings.focusCategory === "all" ? "平均推进" : CATEGORY_META[state.settings.focusCategory].label;
  const leadingCategory = getTodayCategorySnapshot(log)[0];
  const currentSessionLabel = formatStudySelection(ui.studyContext);

  elements.heroDueCount.textContent = String(dueCount);
  elements.heroNewLimit.textContent = String(state.settings.dailyLimit);
  elements.heroMasteredCount.textContent = String(masteredCount);
  elements.heroStreak.textContent = String(getStreak());
  elements.todayDueTotal.textContent = String(dueCount);
  elements.todayNewSlots.textContent = String(remainingNewSlots);
  elements.todayReviewedCount.textContent = String(todaySnapshot.attempts);
  elements.todayAccuracy.textContent = `${accuracy}%`;
  elements.planSummary.textContent =
    dueCount > 0
      ? `今天先处理 ${dueCount} 个到期复习，再新增 ${remainingNewSlots} 个词条；当前新词优先策略是“${focusLabel}”。`
      : `今天没有到期复习，可以开 ${remainingNewSlots} 个新词；当前新词优先策略是“${focusLabel}”。`;

  if (leadingCategory?.actions) {
    elements.planSummary.textContent += ` 今天你主要在练 ${CATEGORY_META[leadingCategory.category].label}，已完成 ${leadingCategory.actions} 次，当前命中率约 ${leadingCategory.accuracy}%。`;
  } else if (ui.studyQueue.length) {
    elements.planSummary.textContent += ` 当前已生成“${currentSessionLabel}”。`;
  }
}

function renderDecks() {
  elements.deckGrid.innerHTML = CATEGORY_ORDER.map((category) => {
    const meta = CATEGORY_META[category];
    const stats = getCategoryStats(category);
    return `
      <article class="deck-card" data-category="${category}">
        <div class="deck-card__top">
          <div>
            <p class="eyebrow eyebrow--compact">${meta.label}</p>
            <h3>${meta.headline}</h3>
          </div>
          <span class="badge">${stats.words} 单词 / ${stats.chunks} 词块</span>
        </div>
        <p>${meta.description}</p>
        <div class="deck-card__stats">
          <span>已学习 ${stats.studied}/${stats.total}</span>
          <span>已掌握 ${stats.mastered}</span>
          <span>待复习 ${stats.due}</span>
          <span>学习进度 ${stats.progressRatio}%</span>
        </div>
        <div class="progress-bar"><span style="width: ${stats.progressRatio}%"></span></div>
        <div class="inline-actions">
          <button class="button button--ghost button--tiny" data-action="quick-study" data-source="today" data-category="${category}" data-kind="all" type="button">练这一类</button>
          ${
            stats.chunks
              ? `<button class="button button--subtle button--tiny" data-action="quick-study" data-source="chunks" data-category="${category}" data-kind="chunk" type="button">词块专练</button>`
              : ""
          }
        </div>
      </article>
    `;
  }).join("");
}

function renderStudyMeta() {
  const queueItems = ui.studyQueue.map((itemId) => getItemById(itemId)).filter(Boolean);
  const chunkCount = queueItems.filter((item) => item.kind === "chunk").length;
  const dueCount = queueItems.filter((item) => isDue(item)).length;
  const freshCount = queueItems.filter((item) => isNewItem(item)).length;
  const currentIndex = Math.min(ui.studyIndex + 1, Math.max(1, queueItems.length));
  const sessionLabel = formatStudySelection();
  elements.studyQueueSize.textContent = `${queueItems.length} 张卡片`;
  elements.studyQueueMeta.textContent =
    queueItems.length > 0
      ? `${sessionLabel} · 当前第 ${currentIndex} 张 · 今日总量 ${queueItems.length} · 到期复习 ${dueCount} · 新词 ${freshCount} · 词块 ${chunkCount}`
      : `${sessionLabel} · 已按当前筛选重新生成`;
}

function renderStudyEmpty(message, hint) {
  elements.studyCard.innerHTML = `
    <div class="study-empty">
      <div>
        <h3>${message}</h3>
        <p>${hint}</p>
      </div>
    </div>
  `;
}

function renderStudyCard() {
  renderStudyMeta();

  if (!ui.studyQueue.length) {
    const message =
      elements.studySource.value === "fresh" && getRemainingNewSlots() === 0
        ? "今天的新词上限已经用完"
        : "当前条件下还没有可练的内容";
    const hint =
      elements.studySource.value === "fresh"
        ? "你可以去做复习、拼写，或者在右侧把每日新词上限调高一点。"
        : "试试切换分类、切换词块专练，或者先完成一轮口语/拼写练习。";
    renderStudyEmpty(message, hint);
    return;
  }

  if (ui.studyIndex >= ui.studyQueue.length) {
    renderStudyEmpty("这一轮背诵已经完成", "现在可以去做拼写训练，或者切到词块专练继续巩固。");
    return;
  }

  const item = getItemById(ui.studyQueue[ui.studyIndex]);
  const progress = getProgress(item.id);
  const categoryLabel = CATEGORY_META[item.category].label;
  const pronunciationText = item.phonetic || "词块建议跟读 2-3 次";
  const partOfSpeech = getPartOfSpeechText(item);

  elements.studyCard.innerHTML = `
    <div class="study-shell">
      <div class="study-shell__top">
        <div class="badge-row">
          <span class="badge">${categoryLabel}</span>
          <span class="badge">${item.kind === "chunk" ? "词块" : "单词"}</span>
          ${partOfSpeech ? `<span class="badge">${partOfSpeech}</span>` : ""}
          <span class="badge">${getStageLabel(item.id)}</span>
        </div>
        <div class="inline-actions">
          <button class="button button--subtle button--tiny" data-action="speak-item" data-id="${item.id}" data-mode="term" type="button">发音</button>
          <button class="button button--ghost button--tiny" data-action="speak-item" data-id="${item.id}" data-mode="example" type="button">例句发音</button>
        </div>
      </div>
      <p class="study-shell__prompt">
        ${ui.studyReveal ? "看完答案后，根据熟悉度选择一次反馈，系统会自动推进下次复习时间。" : "先尝试回忆意思、场景和例句，再展开答案。"}
      </p>
      <h3 class="study-shell__term">${item.term}</h3>
      <p class="study-shell__ipa">${pronunciationText}</p>
      ${
        ui.studyReveal
          ? `
            <div class="study-shell__answer">
              <strong>${item.translation}</strong>
              ${partOfSpeech ? `<p>${partOfSpeech}</p>` : ""}
              <p>${item.note}</p>
              <p class="study-shell__support">${item.example}</p>
            </div>
          `
          : ""
      }
      <div class="tag-row">
        ${item.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
      </div>
      <div class="session-foot">
        <span>下次复习：${formatRelativeTime(progress.nextReviewAt)}</span>
        <span>累计复习：${progress.reviews}</span>
      </div>
      ${
        ui.studyReveal
          ? `
            <div class="rating-grid">
              <button class="button button--ghost" data-action="rate-study" data-rating="again" type="button">没记住</button>
              <button class="button button--ghost" data-action="rate-study" data-rating="hard" type="button">有点卡</button>
              <button class="button button--subtle" data-action="rate-study" data-rating="good" type="button">基本记住</button>
              <button class="button button--primary" data-action="rate-study" data-rating="easy" type="button">非常熟</button>
            </div>
          `
          : `
            <div class="inline-actions">
              <button class="button button--primary" data-action="reveal-study" type="button">展开答案</button>
            </div>
          `
      }
    </div>
  `;
}

function renderSpellingEmpty(message, hint) {
  elements.spellingCard.innerHTML = `
    <div class="study-empty">
      <div>
        <h3>${message}</h3>
        <p>${hint}</p>
      </div>
    </div>
  `;
}

function renderSpellingCard() {
  if (!ui.spellingQueue.length) {
    renderSpellingEmpty("当前没有可做的拼写题", "换一个来源，或者先完成一轮普通背诵来生成今天的练习队列。");
    return;
  }

  if (ui.spellingIndex >= ui.spellingQueue.length) {
    renderSpellingEmpty("这轮拼写已经做完", "如果你想继续冲刺，可以切换到词块专练或重新生成一组分类题。");
    return;
  }

  const item = getItemById(ui.spellingQueue[ui.spellingIndex]);
  const feedback = ui.spellingFeedback;
  const maskedExample = createMaskedExample(item.example, item.term);
  const partOfSpeech = getPartOfSpeechText(item);

  elements.spellingCard.innerHTML = `
    <div class="spelling-shell">
      <div class="spelling-shell__top">
        <div class="badge-row">
          <span class="badge">${CATEGORY_META[item.category].label}</span>
          <span class="badge">${item.kind === "chunk" ? "词块默写" : "单词拼写"}</span>
          ${partOfSpeech ? `<span class="badge">${partOfSpeech}</span>` : ""}
          <span class="badge">第 ${ui.spellingIndex + 1} / ${ui.spellingQueue.length} 题</span>
        </div>
        <div class="inline-actions">
          <button class="button button--subtle button--tiny" data-action="speak-item" data-id="${item.id}" data-mode="term" type="button">播放发音</button>
          <button class="button button--ghost button--tiny" data-action="reveal-spelling" type="button">显示答案</button>
        </div>
      </div>
      <div class="spelling-shell__content">
        <strong class="spelling-shell__translation">${item.translation}</strong>
        ${partOfSpeech ? `<p class="spelling-shell__meta">词性：${partOfSpeech}</p>` : ""}
        <p class="spelling-shell__hint">提示：${createSpellingHint(item.term)} · ${item.kind === "chunk" ? `${item.term.split(" ").length} 词词块` : `${item.term.length} 个字母左右`}</p>
        <p class="spelling-shell__meta">${maskedExample}</p>
      </div>
      <form class="spelling-form" id="spelling-form">
        <div class="spelling-form__row">
          <input id="spelling-input" type="text" autocomplete="off" placeholder="请输入你拼出的英文" />
          <button class="button button--primary" type="submit">提交拼写</button>
        </div>
      </form>
      ${
        feedback
          ? `<div class="feedback feedback--${feedback.type}">
              <strong>${feedback.title}</strong>
              <p>${feedback.message}</p>
            </div>
            <div class="inline-actions">
              <button class="button button--ghost button--tiny" data-action="next-spelling" type="button">下一题</button>
            </div>`
          : ""
      }
    </div>
  `;
}

function renderWordBank() {
  const category = elements.bankCategory.value;
  const kind = elements.bankKind.value;
  const keyword = elements.bankSearch.value.trim().toLowerCase();
  const items = getFilteredItems(category, kind).filter((item) => {
    if (!keyword) {
      return true;
    }
    return [item.term, item.translation, item.partOfSpeech || "", item.note, item.example, item.tags.join(" ")]
      .join(" ")
      .toLowerCase()
      .includes(keyword);
  });

  if (!items.length) {
    elements.bankGrid.innerHTML = `
      <div class="study-empty">
        <div>
          <h3>没有找到匹配的词条</h3>
          <p>换一个关键词，或者把分类范围放宽到全部内容。</p>
        </div>
      </div>
    `;
    return;
  }

  elements.bankGrid.innerHTML = items
    .map((item) => {
      const partOfSpeech = getPartOfSpeechText(item);
      return `
        <article class="bank-card">
          <div class="bank-card__head">
            <div>
              <span class="badge">${CATEGORY_META[item.category].label}</span>
              <h3 class="bank-card__term">${item.term}</h3>
            </div>
            <span class="badge">${getMemoryLabel(item)}</span>
          </div>
          <p class="bank-card__ipa">${item.phonetic || "词块建议直接跟读模仿"}</p>
          ${partOfSpeech ? `<p class="bank-card__example">词性：${partOfSpeech}</p>` : ""}
          <p class="bank-card__translation">${item.translation}</p>
          <p class="bank-card__example">${item.note}</p>
          <p class="bank-card__example">${item.example}</p>
          <div class="tag-row">
            ${item.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
          </div>
          <div class="inline-actions">
            <button class="button button--subtle button--tiny" data-action="speak-item" data-id="${item.id}" data-mode="term" type="button">发音</button>
            <button class="button button--ghost button--tiny" data-action="quick-single" data-id="${item.id}" type="button">加入当前轮次</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderReviewTimeline() {
  const intervals = getIntervals();
  const stageCounts = new Array(intervals.length).fill(0);
  vocabularyBank.forEach((item) => {
    const stage = getProgress(item.id).stage;
    if (stage >= 0) {
      stageCounts[Math.min(stage, intervals.length - 1)] += 1;
    }
  });

  elements.timelineGrid.innerHTML = intervals
    .map(
      (interval, index) => `
        <article class="timeline-card">
          <span>阶段 S${index}</span>
          <strong>${stageCounts[index]}</strong>
          <p>${formatDurationShort(interval)}</p>
        </article>
      `,
    )
    .join("");

  const dueItems = sortDueItems(vocabularyBank.filter((item) => isDue(item)));
  elements.dueTotalChip.textContent = `${dueItems.length} 条待复习`;
  elements.dueList.innerHTML = dueItems.length
    ? dueItems
        .slice(0, 8)
        .map((item) => {
          return `
            <article class="due-item">
              <div>
                <strong>${item.term}</strong>
                <p>${CATEGORY_META[item.category].label} · ${item.translation}</p>
              </div>
              <span class="badge">${formatRelativeTime(getProgress(item.id).nextReviewAt)}</span>
            </article>
          `;
        })
        .join("")
    : `
        <div class="study-empty">
          <div>
            <h3>当前没有待复习内容</h3>
            <p>可以先去开一轮新词，系统会在后续自动安排回看时间。</p>
          </div>
        </div>
      `;
}

function renderCoachTips() {
  const log = ensureTodayLog();
  const todaySnapshot = getTodayTrainingSnapshot();
  const weakest = CATEGORY_ORDER.map((category) => {
    const stats = getCategoryStats(category);
    return {
      category,
      ratio: stats.total ? stats.mastered / stats.total : 0,
      ...stats,
    };
  }).sort((left, right) => left.ratio - right.ratio)[0];

  const session = getCurrentStudySessionSnapshot();
  const leadingCategory = getTodayCategorySnapshot(log)[0];
  const dueChunks = vocabularyBank.filter((item) => item.kind === "chunk" && isDue(item)).length;
  const latestAiSpeaking = getLatestSpeakingPerformanceEntry();
  const latestSpeaking = latestAiSpeaking || state.speakingHistory[0];
  const grammarHotspot = aggregateGrammarPatterns(getSpeakingPerformanceEntries())[0];
  const todayAttempts = todaySnapshot.attempts;
  const todayAccuracy = getTodayAccuracy();
  const chunkActions = Number(todaySnapshot.kindActions?.chunk || 0);
  const wordActions = Number(todaySnapshot.kindActions?.word || 0);
  const spellingActions = Number(todaySnapshot.sourceActions?.spelling || 0);
  const spellingRemaining = Math.max(0, ui.spellingQueue.length - ui.spellingIndex);

  let nextStepBody = "建议保持“背诵一轮 + 拼写一轮”的节奏，这样记忆会比只看卡片稳定得多。";
  if (!todayAttempts && session.total) {
    nextStepBody = `先把这组 ${formatStudySelection(ui.studyContext)} 做掉 4 到 6 张，再去拼写区接着练，系统会按这组内容继续出题。`;
  } else if (todayAccuracy > 0 && todayAccuracy < 70) {
    nextStepBody = `今天整体正确率约 ${todayAccuracy}%，建议先暂停开新词，优先做“只做复习”或当前分类的拼写巩固，把熟练度先稳住。`;
  } else if (getRemainingNewSlots() === 0) {
    nextStepBody = `今天的新词额度已经用完，下一步更适合继续做复习和拼写，不建议再切去开新词。`;
  } else if (leadingCategory?.actions && leadingCategory.category !== "reading" && chunkActions < Math.max(2, Math.ceil(wordActions / 3))) {
    nextStepBody = `你今天主要在练 ${CATEGORY_META[leadingCategory.category].label}，但词块练得还不够。下一轮建议切到这一类的“词块专练”，把可直接输出的表达补上。`;
  } else if (todayAttempts > 0 && spellingActions === 0 && session.total) {
    nextStepBody = `今天已经完成 ${todayAttempts} 次训练，但还没做拼写。当前拼写区已经切到“${formatSpellingSelection(ui.spellingContext)}”，可以直接接着巩固。`;
  } else if (session.total && spellingRemaining > 0) {
    nextStepBody = `当前拼写区还剩 ${spellingRemaining} 题，和这轮背诵内容是联动的，做完会更容易把“认识”变成“会写”。`;
  }

  const cards = [
    leadingCategory?.actions
      ? {
          title: "今日训练重心",
          body: `今天你主要在练 ${CATEGORY_META[leadingCategory.category].label}，已完成 ${leadingCategory.actions} 次，命中率约 ${leadingCategory.accuracy}%。${chunkActions ? ` 其中词块相关练习 ${chunkActions} 次。` : ""}`,
        }
      : {
          title: "今日训练重心",
          body: "今天还没开始训练。你切换到任一分类后点击“生成任务”，右侧提示会跟着这组任务一起刷新。",
        },
    session.total
      ? {
          title: "当前生成任务",
          body: `现在这轮是“${formatStudySelection(ui.studyContext)}”，共 ${session.total} 张，当前还剩 ${session.remaining} 张；其中待复习 ${session.due} 张，新词 ${session.fresh} 张，词块 ${session.chunks} 张。拼写区已联动成“${formatSpellingSelection(ui.spellingContext)}”。`,
        }
      : {
          title: "当前生成任务",
          body: "这轮任务还没生成出来。可以切到口语、写作或其他分类，再点一次“生成任务”来重建一组新的训练清单。",
        },
    {
      title: "下一步建议",
      body: nextStepBody,
    },
    {
      title: "长期薄弱项",
      body: `${CATEGORY_META[weakest.category].label} 目前已掌握 ${weakest.mastered}/${weakest.total}。${
        dueChunks
          ? `另外今天还有 ${dueChunks} 个词块已经到期，建议先把这些词块处理掉。`
          : "当前到期词块压力不大，可以继续补一组新的输出表达。"
      }`,
    },
    latestAiSpeaking
      ? {
          title: "最近一次口语模考",
          body: `${latestAiSpeaking.promptTitle}：当前预估 ${latestAiSpeaking.overallBand.toFixed(1)} 分，最需要先修的是“${latestAiSpeaking.primaryIssue}”。下次优先尝试 ${(latestAiSpeaking.recommendedMaterials || []).slice(0, 3).map((item) => item.content).join("、") || "更自然的连接、例子和主题词块"} 这些素材。`,
        }
      : latestSpeaking
        ? {
            title: "最近一次口语模考",
            body: `${latestSpeaking.promptTitle}：${latestSpeaking.primaryIssue}。下次优先尝试 ${latestSpeaking.materials.join("、")} 这些素材。`,
          }
      : {
          title: "口语模考建议",
          body: "建议每周至少录一轮 Part 2 或 Part 3，重点盯时长、停顿和观点展开，不要只看单词量。",
        },
    grammarHotspot
      ? {
          title: "高频语法提醒",
          body: `最近最常重复的是“${grammarHotspot.label}”。${grammarHotspot.advice}`,
        }
      : {
          title: "语法追踪建议",
          body: "做过几次 AI 口语批改后，这里会自动汇总你最常重复的语法问题。",
        },
  ];

  elements.coachTips.innerHTML = cards
    .map(
      (card) => `
        <article class="coach-card">
          <h3>${card.title}</h3>
          <p>${card.body}</p>
        </article>
      `,
    )
    .join("");
}

function syncSettingsUI() {
  elements.dailyLimit.value = String(state.settings.dailyLimit);
  elements.reviewScheme.value = state.settings.reviewScheme;
  elements.preferredFocus.value = state.settings.focusCategory;
  elements.preferredAccent.value = state.settings.accent;
  if (elements.writingTargetBand) {
    elements.writingTargetBand.value = state.settings.writingTargetBand;
  }
  if (elements.writingTask) {
    elements.writingTask.value = state.writingDraft.task;
  }
  if (elements.writingCustomPrompt) {
    elements.writingCustomPrompt.value = state.writingDraft.customPrompt;
  }
  if (elements.writingEssay) {
    elements.writingEssay.value = state.writingDraft.essay;
  }
  renderCloudSyncUi();
}

function updateSettings() {
  state.settings.dailyLimit = clamp(Number.parseInt(elements.dailyLimit.value, 10) || 12, 4, MAX_DAILY_LIMIT);
  state.settings.reviewScheme = elements.reviewScheme.value;
  state.settings.focusCategory = elements.preferredFocus.value;
  state.settings.accent = elements.preferredAccent.value;
  saveState();
  renderCurveStrip();
  startStudySession(false);
  startSpellingSession();
  renderStaticPanels();
}

function startStudySession(syncLinkedPanels = true) {
  ui.studyContext = getStudyControlsContext();
  ui.studyQueue = buildStudyQueue(ui.studyContext.source, ui.studyContext.category, ui.studyContext.kind);
  ui.studyIndex = 0;
  ui.studyReveal = false;
  ui.studyRecycle = {};
  renderStudyCard();
  if (syncLinkedPanels) {
    syncLinkedPracticePanelsFromStudyContext(ui.studyContext);
    startSpellingSession(true);
    renderWordBank();
  }
  renderDashboard();
  renderCoachTips();
}

function startSpellingSession(skipCoachRefresh = false) {
  ui.spellingContext = getSpellingControlsContext();
  ui.spellingQueue = buildSpellingQueue(ui.spellingContext.source, ui.spellingContext.category);
  ui.spellingIndex = 0;
  ui.spellingFeedback = null;
  ui.spellingRecycle = {};
  renderSpellingCard();
  if (!skipCoachRefresh) {
    renderCoachTips();
  }
}

function addCurrentStudyItemBackIfNeeded() {
  const currentId = ui.studyQueue[ui.studyIndex];
  ui.studyRecycle[currentId] = (ui.studyRecycle[currentId] || 0) + 1;
  if (ui.studyRecycle[currentId] <= 1) {
    ui.studyQueue.push(currentId);
  }
}

function handleStudyRating(rating) {
  const itemId = ui.studyQueue[ui.studyIndex];
  if (!itemId) {
    return;
  }
  applyReviewResult(itemId, rating, "study");
  if (rating === "again") {
    addCurrentStudyItemBackIfNeeded();
  }
  ui.studyIndex += 1;
  ui.studyReveal = false;
  renderStudyCard();
  renderStaticPanels();
}

function addCurrentSpellingItemBackIfNeeded() {
  const currentId = ui.spellingQueue[ui.spellingIndex];
  ui.spellingRecycle[currentId] = (ui.spellingRecycle[currentId] || 0) + 1;
  if (ui.spellingRecycle[currentId] <= 1) {
    ui.spellingQueue.push(currentId);
  }
}

function handleSpellingSubmit(answer) {
  const item = getItemById(ui.spellingQueue[ui.spellingIndex]);
  if (!item) {
    return;
  }

  const isCorrect = normalizeAnswer(answer) === normalizeAnswer(item.term);
  if (isCorrect) {
    applyReviewResult(item.id, ui.spellingFeedback?.revealed ? "hard" : "good", "spelling");
    ui.spellingFeedback = {
      type: "success",
      title: "拼写正确",
      message: `这题已经记住了。标准答案是 “${item.term}”。`,
    };
  } else {
    applyReviewResult(item.id, "again", "spelling");
    addCurrentSpellingItemBackIfNeeded();
    ui.spellingFeedback = {
      type: "danger",
      title: "这题需要再练一次",
      message: `标准答案是 “${item.term}”。建议再听一遍发音，再跟着拼一遍。`,
    };
  }

  renderSpellingCard();
  renderStaticPanels();
}

function moveToNextSpellingItem() {
  ui.spellingIndex += 1;
  ui.spellingFeedback = null;
  renderSpellingCard();
}

function quickAddSingleItem(itemId) {
  if (!ui.studyQueue.includes(itemId)) {
    ui.studyQueue.unshift(itemId);
    ui.studyIndex = 0;
    ui.studyReveal = false;
    renderStudyCard();
    announce("该词条已加入当前背诵轮次");
  }
}

function renderSpeakingProgress() {
  const entries = getSpeakingPerformanceEntries();

  if (!entries.length) {
    elements.speakingMetrics.innerHTML = `
      <article class="metric-card metric-card--accent">
        <span class="metric-card__label">AI 模考次数</span>
        <strong class="metric-card__value">0</strong>
        <p>做完第一次 AI 口语批改后，这里会开始生成提分轨迹。</p>
      </article>
      <article class="metric-card">
        <span class="metric-card__label">最近平均分</span>
        <strong class="metric-card__value">--</strong>
        <p>默认统计最近 3 次 AI 模考。</p>
      </article>
      <article class="metric-card">
        <span class="metric-card__label">趋势变化</span>
        <strong class="metric-card__value">--</strong>
        <p>会比较最近几次批改和更早几次的均值。</p>
      </article>
      <article class="metric-card">
        <span class="metric-card__label">当前薄弱维度</span>
        <strong class="metric-card__value">待生成</strong>
        <p>流利、词汇、语法和发音都会单独跟踪。</p>
      </article>
    `;
    elements.speakingGrammarChip.textContent = "0 个模式";
    elements.speakingHistoryChip.textContent = "0 次批改";
    elements.speakingGrammarList.innerHTML = `
      <div class="study-empty">
        <div>
          <h3>还没有语法热点</h3>
          <p>当你累计几次 AI 批改后，这里会自动归纳重复出现的语法问题。</p>
        </div>
      </div>
    `;
    elements.speakingHistoryList.innerHTML = `
      <div class="study-empty">
        <div>
          <h3>还没有 AI 模考档案</h3>
          <p>先完成一次 AI 深度批改，系统会把分数、问题、素材包和追问建议存到这里。</p>
        </div>
      </div>
    `;
    return;
  }

  const recentAverage = average(entries.slice(0, 3).map((entry) => entry.overallBand));
  const trend = getSpeakingTrend(entries);
  const weakestDimension = getSpeakingWeakestDimension(entries);
  const coverage = getSpeakingCoverage(entries);
  const grammarPatterns = aggregateGrammarPatterns(entries);

  elements.speakingMetrics.innerHTML = `
    <article class="metric-card metric-card--accent">
      <span class="metric-card__label">AI 模考次数</span>
      <strong class="metric-card__value">${entries.length}</strong>
      <p>当前已覆盖 ${coverage} 个口语题型。</p>
    </article>
    <article class="metric-card">
      <span class="metric-card__label">最近平均分</span>
      <strong class="metric-card__value">${recentAverage.toFixed(1)}</strong>
      <p>按最近 3 次 AI 复盘综合估算。</p>
    </article>
    <article class="metric-card">
      <span class="metric-card__label">趋势变化</span>
      <strong class="metric-card__value">${formatDelta(trend)}</strong>
      <p>正数说明最近表现比前几次更稳定。</p>
    </article>
    <article class="metric-card">
      <span class="metric-card__label">当前薄弱维度</span>
      <strong class="metric-card__value">${weakestDimension.label}</strong>
      <p>最近平均约 ${weakestDimension.score.toFixed(1)}，建议优先盯这一项。</p>
    </article>
  `;

  elements.speakingGrammarChip.textContent = `${grammarPatterns.length} 个模式`;
  elements.speakingHistoryChip.textContent = `${entries.length} 次记录`;
  elements.speakingGrammarList.innerHTML = grammarPatterns.length
    ? grammarPatterns.slice(0, 6).map((pattern) => {
        return `
          <article class="grammar-item">
            <div class="history-card__head">
              <strong>${pattern.label}</strong>
              <span class="badge">出现 ${pattern.count} 次</span>
            </div>
            <p class="grammar-item__meta">${pattern.symptom || "这个语法问题在多次录音里重复出现。"}</p>
            <p>${pattern.advice || "建议在下次练习时专门盯住这类句型。"}</p>
            ${pattern.evidence ? `<span class="tag">${pattern.evidence}</span>` : ""}
          </article>
        `;
      }).join("")
    : `
      <div class="study-empty">
        <div>
          <h3>还没有可聚合的语法模式</h3>
          <p>等你多积累几次 AI 批改，这里会自动开始收敛出高频问题。</p>
        </div>
      </div>
    `;

  elements.speakingHistoryList.innerHTML = entries.slice(0, 6).map((entry) => {
    const breakdown = entry.bandBreakdown || {
      fluency_coherence: 0,
      lexical_resource: 0,
      grammatical_range_accuracy: 0,
      pronunciation: 0,
    };

    if (entry.entryType === "full_mock") {
      const partReports = (entry.partReports || []).slice(0, 3);
      const materials = (entry.recommendedMaterials || []).slice(0, 4);
      return `
        <article class="history-card">
          <div class="history-card__head">
            <div>
              <strong>${escapeHtml(entry.promptTitle)}</strong>
              <p>完整模考 · ${formatCalendarDate(entry.timestamp)}</p>
            </div>
            <span class="badge badge--success">Band ${Number(entry.overallBand || 0).toFixed(1)}</span>
          </div>
          <div class="history-card__scores">
            <span class="badge">FC ${Number(breakdown.fluency_coherence || 0).toFixed(1)}</span>
            <span class="badge">LR ${Number(breakdown.lexical_resource || 0).toFixed(1)}</span>
            <span class="badge">GRA ${Number(breakdown.grammatical_range_accuracy || 0).toFixed(1)}</span>
            <span class="badge">PR ${Number(breakdown.pronunciation || 0).toFixed(1)}</span>
          </div>
          <p class="history-card__meta">${escapeHtml(entry.primaryIssue || entry.summary || "")}</p>
          <div class="history-card__block">
            <strong>分段回顾</strong>
            <ul>
              ${partReports.length
                ? partReports
                    .map(
                      (item) =>
                        `<li>${escapeHtml(SPEAKING_PART_LABELS[item.part] || item.part)}：${escapeHtml(item.main_issue)}；下一步先做 ${escapeHtml(item.next_focus)}</li>`,
                    )
                    .join("") 
                : "<li>这一轮已经生成整轮总评，建议优先回看四项评分分析和整轮转写趋势。</li>"}
            </ul>
          </div>
          <div class="history-card__block">
            <strong>推荐素材包</strong>
            ${
              materials.length
                ? `<div class="tag-row">
                    ${materials.map((item) => `<span class="tag">${escapeHtml(item.content)}</span>`).join("")}
                  </div>`
                : "<p>这轮先优先补通用连接、例子展开和更自然的句型切换。</p>"
            }
          </div>
        </article>
      `;
    }

    const followUps = (entry.followUpQuestions || []).slice(0, 2);
    const pack = entry.partMaterialPack || {};
    const phrases = (pack.reusable_phrases || []).slice(0, 3);
    const hooks = (pack.content_hooks || []).slice(0, 2);
    return `
      <article class="history-card">
        <div class="history-card__head">
          <div>
            <strong>${escapeHtml(entry.promptTitle)}</strong>
            <p>${escapeHtml((entry.part || "").toUpperCase())} · ${formatCalendarDate(entry.timestamp)}</p>
          </div>
          <span class="badge badge--success">Band ${Number(entry.overallBand || 0).toFixed(1)}</span>
        </div>
        <div class="history-card__scores">
          <span class="badge">FC ${Number(breakdown.fluency_coherence || 0).toFixed(1)}</span>
          <span class="badge">LR ${Number(breakdown.lexical_resource || 0).toFixed(1)}</span>
          <span class="badge">GRA ${Number(breakdown.grammatical_range_accuracy || 0).toFixed(1)}</span>
          <span class="badge">PR ${Number(breakdown.pronunciation || 0).toFixed(1)}</span>
        </div>
        <p class="history-card__meta">${escapeHtml(entry.primaryIssue || "")}</p>
        <div class="history-card__block">
          <strong>下轮追问建议</strong>
          <ul>
            ${followUps.length
              ? followUps.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
              : "<li>下次继续围绕同主题补原因、例子和对比。</li>"}
          </ul>
        </div>
        <div class="history-card__block">
          <strong>推荐素材包</strong>
          ${
            phrases.concat(hooks).length
              ? `<div class="tag-row">
                  ${phrases.concat(hooks).slice(0, 5).map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}
                </div>`
              : "<p>这次先优先围绕该题型补背景、原因和例子三层内容。</p>"
          }
        </div>
      </article>
    `;
  }).join("");
}

function getAverageWritingBreakdown(entries) {
  const initial = {
    task_response: 0,
    coherence_cohesion: 0,
    lexical_resource: 0,
    grammatical_range_accuracy: 0,
  };

  if (!entries.length) {
    return initial;
  }

  entries.forEach((entry) => {
    Object.keys(initial).forEach((key) => {
      initial[key] += Number(entry.bandBreakdown?.[key] || 0);
    });
  });

  Object.keys(initial).forEach((key) => {
    initial[key] = initial[key] / entries.length;
  });

  return initial;
}

function getWritingWeakestDimension(entries) {
  const labels = {
    task_response: "任务回应",
    coherence_cohesion: "衔接与结构",
    lexical_resource: "词汇资源",
    grammatical_range_accuracy: "语法范围",
  };
  const averages = getAverageWritingBreakdown(entries);
  const weakestKey = Object.keys(averages).sort((left, right) => averages[left] - averages[right])[0];
  return {
    key: weakestKey,
    label: labels[weakestKey],
    score: averages[weakestKey] || 0,
  };
}

function getWritingCoverage(entries) {
  return `${new Set(entries.map((entry) => entry.task)).size}/2`;
}

function getWritingTrend(entries) {
  if (!entries.length) {
    return 0;
  }
  const recent = entries.slice(0, 3).map((entry) => entry.overallBand);
  const previous = entries.slice(3, 6).map((entry) => entry.overallBand);
  if (!previous.length) {
    return recent[0] - recent[recent.length - 1];
  }
  return average(recent) - average(previous);
}

function aggregateWritingFocusAreas(entries) {
  const grouped = new Map();

  entries.forEach((entry) => {
    (entry.focusAreas || []).forEach((area) => {
      const rawLabel = (area || "").trim();
      const key = rawLabel.toLowerCase() || "其他";
      if (!grouped.has(key)) {
        grouped.set(key, {
          label: rawLabel || "其他",
          count: 0,
          lastSeenAt: entry.timestamp || 0,
          suggestion: entry.improvementActions?.[0] || entry.primaryIssue || "",
        });
      }
      const current = grouped.get(key);
      current.count += 1;
      current.lastSeenAt = Math.max(current.lastSeenAt, entry.timestamp || 0);
      if (!current.suggestion && (entry.improvementActions?.[0] || entry.primaryIssue)) {
        current.suggestion = entry.improvementActions?.[0] || entry.primaryIssue || "";
      }
    });
  });

  return [...grouped.values()].sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }
    return right.lastSeenAt - left.lastSeenAt;
  });
}

function buildWritingParagraphPlan(task, metrics, prompt) {
  if (task === "task1") {
    return [
      "第 1 段只做题目改写，不加入评价。",
      "第 2 段先写 overview，抓最大趋势和最明显对比。",
      `后面 ${metrics.paragraphs >= 4 ? "两段" : "一到两段"} 再按国家、类别或时间分组写细节。`,
      `重写时优先套用 ${prompt.materials.slice(0, 2).join(" / ")} 这类结构。`,
    ];
  }

  return [
    "引言段先改写题目并明确立场。",
    "主体段 1 放最强论点，写原因并补一个具体例子。",
    "主体段 2 写次论点或反方，再用 however / although 做平衡。",
    "结尾段重申判断，不再新增观点。",
  ];
}

function buildLocalWritingReview(prompt, essayText, targetBand) {
  const normalized = normalizeEssayText(essayText);
  const words = countEssayWords(essayText);
  const sentenceList = splitEssaySentences(essayText);
  const paragraphList = splitEssayParagraphs(essayText);
  const connectorHits = matchEssayPhrases(normalized, WRITING_CONNECTORS);
  const academicHits = matchEssayPhrases(normalized, WRITING_ACADEMIC_PHRASES);
  const subordinateHits = matchEssayPhrases(normalized, WRITING_SUBORDINATORS);
  const keywordHits = matchEssayPhrases(normalized, prompt.keywords || []);
  const keywordCoverage = prompt.keywords?.length ? Math.round((keywordHits.length / prompt.keywords.length) * 100) : 0;
  const lexicalDiversity = words ? countUniqueMeaningfulWords(essayText) / words : 0;
  const averageSentenceLength = sentenceList.length ? words / sentenceList.length : 0;
  const topRepeatRatio = getTopRepeatRatio(essayText);
  const hasOverview = includesEssayPhrase(normalized, ["overall", "it is clear that", "in general"]);
  const hasOpinion = includesEssayPhrase(normalized, ["i believe", "i think", "in my view", "from my perspective", "i would argue"]);
  const hasConclusion = includesEssayPhrase(normalized, ["in conclusion", "to conclude", "to sum up"]);
  const punctuationVariety = [",", ";", ":"].reduce((count, mark) => count + (essayText.includes(mark) ? 1 : 0), 0);
  const fragmentCount = sentenceList.filter((sentence) => countEssayWords(sentence) < 4).length;
  const paragraphCount = paragraphList.length || 1;
  const task = prompt.task;
  const minimumWords = prompt.minimumWords || (task === "task1" ? 150 : 250);
  const targetWords = task === "task1" ? Math.max(minimumWords, 180) : Math.max(minimumWords, 280);

  let taskResponse = 5;
  if (words >= targetWords) {
    taskResponse += 1.2;
  } else if (words >= minimumWords) {
    taskResponse += 0.5;
  } else if (words >= minimumWords * 0.85) {
    taskResponse -= 0.2;
  } else {
    taskResponse -= 1.4;
  }

  if (keywordCoverage >= 60) {
    taskResponse += 0.8;
  } else if (keywordCoverage >= 35) {
    taskResponse += 0.3;
  } else {
    taskResponse -= 0.6;
  }

  if (task === "task1") {
    if (hasOverview) {
      taskResponse += 0.6;
    } else {
      taskResponse -= 0.8;
    }
    if (hasOpinion) {
      taskResponse -= 0.8;
    }
  } else {
    if (hasOpinion) {
      taskResponse += 0.5;
    } else {
      taskResponse -= 0.4;
    }
    if (hasConclusion) {
      taskResponse += 0.4;
    } else {
      taskResponse -= 0.3;
    }
  }

  if (sentenceList.length < (task === "task1" ? 6 : 8)) {
    taskResponse -= 0.4;
  }
  taskResponse = clampWritingBand(taskResponse);

  let coherence = 5;
  const idealParagraphs = task === "task1" ? [3, 4] : [4, 5];
  if (paragraphCount >= idealParagraphs[0] && paragraphCount <= idealParagraphs[1]) {
    coherence += 1;
  } else if (paragraphCount === idealParagraphs[0] - 1) {
    coherence += 0.3;
  } else {
    coherence -= 0.9;
  }

  if (connectorHits.length >= (task === "task1" ? 3 : 4)) {
    coherence += 0.8;
  } else if (connectorHits.length >= 1) {
    coherence += 0.3;
  } else {
    coherence -= 0.6;
  }

  if (averageSentenceLength >= 12 && averageSentenceLength <= 24) {
    coherence += 0.3;
  }
  coherence = clampWritingBand(coherence);

  let lexical = 5;
  if (lexicalDiversity >= 0.48) {
    lexical += 0.9;
  } else if (lexicalDiversity >= 0.4) {
    lexical += 0.4;
  } else {
    lexical -= 0.5;
  }

  if (academicHits.length >= (task === "task1" ? 3 : 4)) {
    lexical += 0.8;
  } else if (academicHits.length >= 1) {
    lexical += 0.3;
  }

  if (topRepeatRatio > 0.1) {
    lexical -= 0.7;
  } else if (topRepeatRatio > 0.075) {
    lexical -= 0.3;
  }
  lexical = clampWritingBand(lexical);

  let grammar = 5;
  if (averageSentenceLength >= 10 && averageSentenceLength <= 28) {
    grammar += 0.8;
  } else if (averageSentenceLength >= 8 && averageSentenceLength <= 32) {
    grammar += 0.3;
  } else {
    grammar -= 0.5;
  }

  if (subordinateHits.length >= (task === "task1" ? 2 : 3)) {
    grammar += 0.7;
  } else {
    grammar -= 0.3;
  }

  if (punctuationVariety >= 2) {
    grammar += 0.3;
  }

  if (fragmentCount >= 2) {
    grammar -= 0.6;
  }
  grammar = clampWritingBand(grammar);

  const overallBand = roundBandHalf((taskResponse + coherence + lexical + grammar) / 4);
  const strengths = [];
  const keyIssues = [];
  const improvementActions = [];
  const focusAreas = [];

  if (taskResponse >= 6.5) {
    strengths.push(task === "task1" ? "题目回应比较到位，已经开始抓总趋势和关键对比。" : "题目回应较完整，立场和主线基本清楚。");
  }
  if (coherence >= 6.5) {
    strengths.push("段落划分和信息推进比较清楚，结构已经有考试作文的样子。");
  }
  if (lexical >= 6.5) {
    strengths.push("词汇不只停留在基础表达，已经开始有更自然的学术写作感。");
  }
  if (grammar >= 6.5) {
    strengths.push("句型有变化，复杂句和从句使用已经开始稳定。");
  }

  if (words < minimumWords) {
    keyIssues.push(`当前只有 ${words} 词，距离这类题的基本字数要求还有差距。`);
    improvementActions.push(`先把字数补到至少 ${minimumWords} 词以上，再看分数会更接近真实水平。`);
    focusAreas.push("补足字数");
  }
  if (task === "task1" && !hasOverview) {
    keyIssues.push("Task 1 还没有清晰 overview，考官会很难快速看到整体趋势。");
    improvementActions.push("用 Overall / It is clear that 先写 1 到 2 句总览，再去分组描述细节。");
    focusAreas.push("补写 overview");
  }
  if (task === "task2" && !hasOpinion) {
    keyIssues.push("Task 2 立场不够显眼，读者可能看不出你到底支持哪一边。");
    improvementActions.push("把 In my view / I would argue that 这类立场句放进引言或第一主体段。");
    focusAreas.push("立场更明确");
  }
  if (task === "task2" && !hasConclusion) {
    keyIssues.push("整篇作文还缺一个真正收束的结尾段。");
    improvementActions.push("用 In conclusion 重申你的判断，不要在结尾再开新观点。");
    focusAreas.push("补强结尾");
  }
  if (connectorHits.length < (task === "task1" ? 3 : 4)) {
    keyIssues.push("连接词和逻辑标记偏少，句子之间的推进感还不够明显。");
    improvementActions.push("下一轮主动加入 however, therefore, by contrast, as a result 这类衔接词。");
    focusAreas.push("增强衔接");
  }
  if (topRepeatRatio > 0.09) {
    keyIssues.push("有些核心词重复偏多，影响词汇资源这一项的上限。");
    improvementActions.push("给高频词准备 2 到 3 个同义或近义替换，减少整段重复。");
    focusAreas.push("减少重复");
  }
  if (paragraphCount < idealParagraphs[0] || paragraphCount > idealParagraphs[1]) {
    keyIssues.push(`当前是 ${paragraphCount} 段，段落功能还可以更贴近雅思常见结构。`);
    improvementActions.push(task === "task1" ? "建议重写成 3 到 4 段：改写、overview、细节 1、细节 2。" : "建议稳定成 4 到 5 段：引言、主体 1、主体 2、结尾。");
    focusAreas.push("重做段落结构");
  }
  if (subordinateHits.length < (task === "task1" ? 2 : 3)) {
    improvementActions.push("试着增加 because, while, which means, although 这类从句结构，让句型层次更丰富。");
    focusAreas.push("增加复杂句");
  }

  const uniqueFocusAreas = [...new Set(focusAreas)].slice(0, 4);
  const summary = overallBand >= Number(targetBand || state.settings.writingTargetBand)
    ? "这次已经达到你当前设定的目标带，下一步重点是把发挥稳定住。"
    : overallBand >= 6
      ? "这次已经有不错的基础，接下来最值得做的是把短板集中修两轮。"
      : "这次更适合拿来暴露问题，按重点逐项重写会更有效。";

  return {
    task,
    words,
    sentences: sentenceList.length,
    paragraphs: paragraphCount,
    connectorCount: connectorHits.length,
    keywordCoverage,
    overallBand,
    summary,
    strengths: strengths.length ? strengths.slice(0, 4) : ["已经完成了一篇可批改的完整作文，这本身就是有效训练。"],
    keyIssues: keyIssues.length ? keyIssues.slice(0, 4) : ["当前没有特别突出的结构性问题，可以开始追求更高阶的词汇和句法变化。"],
    improvementActions: improvementActions.slice(0, 4),
    focusAreas: uniqueFocusAreas,
    paragraphPlan: buildWritingParagraphPlan(task, { paragraphs: paragraphCount }, prompt).slice(0, 5),
    usefulPhrases: prompt.materials.slice(0, 5),
    bandBreakdown: {
      task_response: taskResponse,
      coherence_cohesion: coherence,
      lexical_resource: lexical,
      grammatical_range_accuracy: grammar,
    },
    signals: {
      hasOverview,
      hasOpinion,
      hasConclusion,
    },
  };
}

function renderWritingLoading(title, message) {
  if (!elements.writingResult) {
    return;
  }
  elements.writingResult.innerHTML = `
    <div class="study-empty">
      <div>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
      </div>
    </div>
  `;
}

function renderWritingMessage(type, title, message) {
  if (!elements.writingResult) {
    return;
  }
  elements.writingResult.innerHTML = `
    <div class="feedback feedback--${type}">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function renderLocalWritingReview(prompt, review) {
  if (!elements.writingResult) {
    return;
  }
  const targetGap = Math.max(0, Number(state.settings.writingTargetBand) - review.overallBand);
  const criterionLabel = review.task === "task1" ? "Task Achievement" : "Task Response";

  elements.writingResult.innerHTML = `
    <div class="analysis-shell">
      <div class="badge-row">
        <span class="badge badge--success">本地快评</span>
        <span class="badge">预估 ${review.overallBand.toFixed(1)}</span>
        <span class="badge">${review.words} 词</span>
        <span class="badge">${review.paragraphs} 段</span>
        <span class="badge">距离目标 ${targetGap.toFixed(1)}</span>
      </div>
      <div class="analysis-grid analysis-grid--five">
        <article class="analysis-card">
          <span>总分预估</span>
          <strong>${review.overallBand.toFixed(1)}</strong>
          <p>基于结构、长度和语言信号的本地估算</p>
        </article>
        <article class="analysis-card">
          <span>${criterionLabel}</span>
          <strong>${review.bandBreakdown.task_response.toFixed(1)}</strong>
          <p>${review.task === "task1" ? "看 overview、数据筛选和任务完成度" : "看回应题目、立场和展开完整度"}</p>
        </article>
        <article class="analysis-card">
          <span>衔接与结构</span>
          <strong>${review.bandBreakdown.coherence_cohesion.toFixed(1)}</strong>
          <p>看段落功能、逻辑推进和连接词</p>
        </article>
        <article class="analysis-card">
          <span>词汇资源</span>
          <strong>${review.bandBreakdown.lexical_resource.toFixed(1)}</strong>
          <p>看词汇层次、多样性和重复控制</p>
        </article>
        <article class="analysis-card">
          <span>语法范围</span>
          <strong>${review.bandBreakdown.grammatical_range_accuracy.toFixed(1)}</strong>
          <p>看句型变化、从句和标点控制</p>
        </article>
      </div>
      <div class="feedback-grid">
        <article class="feedback-card">
          <h3>本地判断</h3>
          <p>${escapeHtml(review.summary)}</p>
        </article>
        <article class="feedback-card">
          <h3>最主要的问题</h3>
          <p>${review.keyIssues.map((item) => escapeHtml(item)).join(" ")}</p>
        </article>
        <article class="feedback-card">
          <h3>下一轮先改什么</h3>
          <p>${review.improvementActions.map((item) => escapeHtml(item)).join(" ")}</p>
        </article>
      </div>
      <div class="material-card">
        <h3>结构信号</h3>
        <div class="tag-row">
          <span class="tag">关键词覆盖 ${review.keywordCoverage}%</span>
          <span class="tag">连接词 ${review.connectorCount} 个</span>
          <span class="tag">${review.signals.hasOverview ? "有 overview" : "缺 overview"}</span>
          <span class="tag">${review.signals.hasOpinion ? "有立场句" : "立场偏弱"}</span>
          <span class="tag">${review.signals.hasConclusion ? "有结尾" : "结尾偏弱"}</span>
        </div>
      </div>
      <div class="feedback-grid">
        <article class="feedback-card">
          <h3>这次的亮点</h3>
          <p>${review.strengths.map((item) => escapeHtml(item)).join(" ")}</p>
        </article>
        <article class="feedback-card">
          <h3>下一轮重写焦点</h3>
          <p>${review.focusAreas.length ? review.focusAreas.map((item) => escapeHtml(item)).join("、") : "当前没有特别突出的焦点项。"} </p>
        </article>
        <article class="feedback-card">
          <h3>当前题目</h3>
          <p>${escapeHtml(prompt.title)} · ${escapeHtml(prompt.genre)}</p>
        </article>
      </div>
      <div class="material-card">
        <h3>下一轮重写骨架</h3>
        <div class="prompt-list">
          ${review.paragraphPlan.map((item) => `<div class="prompt-item">${escapeHtml(item)}</div>`).join("")}
        </div>
      </div>
      <div class="material-card">
        <h3>建议主动套用的表达</h3>
        <div class="material-strip">
          ${review.usefulPhrases.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}
        </div>
      </div>
    </div>
  `;
}

function buildAiWritingArchiveEntry(prompt, localReview, aiPayload) {
  const review = aiPayload.review;
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    task: prompt.task,
    promptId: prompt.id,
    promptTitle: prompt.title,
    genre: prompt.genre,
    overallBand: review.overall_band,
    bandBreakdown: review.band_breakdown,
    primaryIssue: review.key_issues[0] || review.summary,
    summary: review.summary,
    strengths: review.strengths || [],
    keyIssues: review.key_issues || [],
    improvementActions: review.improvement_actions || [],
    focusAreas: review.focus_areas || [],
    sentenceUpgrades: review.sentence_upgrades || [],
    vocabularyUpgrades: review.vocabulary_upgrades || [],
    grammarPatterns: review.grammar_patterns || [],
    paragraphPlan: review.paragraph_plan || [],
    usefulPhrases: review.useful_phrases || [],
    localMetrics: {
      words: localReview.words,
      paragraphs: localReview.paragraphs,
      keywordCoverage: localReview.keywordCoverage,
      connectorCount: localReview.connectorCount,
    },
  };
}

function saveAiWritingArchive(prompt, localReview, aiPayload) {
  const archiveEntry = buildAiWritingArchiveEntry(prompt, localReview, aiPayload);
  state.writingArchive = [archiveEntry, ...getWritingArchive()].slice(0, 18);
  saveState();
}

function renderAiWritingReview(prompt, aiPayload) {
  const review = aiPayload.review;
  const criterionLabel = prompt.task === "task1" ? "Task Achievement" : "Task Response";
  const targetGap = Math.max(0, Number(state.settings.writingTargetBand) - review.overall_band);

  return `
    <div class="analysis-shell ai-review-shell">
      <div class="badge-row">
        <span class="badge badge--success">AI 精批</span>
        <span class="badge">整体预估 ${Number(review.overall_band || 0).toFixed(1)}</span>
        <span class="badge">模型 ${escapeHtml(aiPayload.review_model || ui.ai.writingReviewModel || ui.ai.reviewModel)}</span>
        <span class="badge">距离目标 ${targetGap.toFixed(1)}</span>
      </div>
      <div class="analysis-grid analysis-grid--five">
        <article class="analysis-card">
          <span>总分预估</span>
          <strong>${Number(review.overall_band || 0).toFixed(1)}</strong>
          <p>按 IELTS Writing 四项维度综合估算</p>
        </article>
        <article class="analysis-card">
          <span>${criterionLabel}</span>
          <strong>${Number(review.band_breakdown.task_response || 0).toFixed(1)}</strong>
          <p>${prompt.task === "task1" ? "概括、取舍和任务完成度" : "回应题目、立场和论证质量"}</p>
        </article>
        <article class="analysis-card">
          <span>衔接与结构</span>
          <strong>${Number(review.band_breakdown.coherence_cohesion || 0).toFixed(1)}</strong>
          <p>段落顺序、逻辑推进和 cohesion</p>
        </article>
        <article class="analysis-card">
          <span>词汇资源</span>
          <strong>${Number(review.band_breakdown.lexical_resource || 0).toFixed(1)}</strong>
          <p>词汇层次、准确度和搭配</p>
        </article>
        <article class="analysis-card">
          <span>语法范围</span>
          <strong>${Number(review.band_breakdown.grammatical_range_accuracy || 0).toFixed(1)}</strong>
          <p>句型变化、复杂句稳定性和错误控制</p>
        </article>
      </div>
      <div class="feedback-grid">
        <article class="feedback-card">
          <h3>AI 总评</h3>
          <p>${escapeHtml(review.summary)}</p>
        </article>
        <article class="feedback-card">
          <h3>关键问题</h3>
          <p>${(review.key_issues || []).map((item) => escapeHtml(item)).join(" ")}</p>
        </article>
        <article class="feedback-card">
          <h3>下一轮重点</h3>
          <p>${(review.improvement_actions || []).map((item) => escapeHtml(item)).join(" ")}</p>
        </article>
      </div>
      <div class="feedback-grid">
        <article class="feedback-card">
          <h3>这次的亮点</h3>
          <p>${(review.strengths || []).map((item) => escapeHtml(item)).join(" ")}</p>
        </article>
        <article class="feedback-card">
          <h3>焦点清单</h3>
          <p>${(review.focus_areas || []).length ? review.focus_areas.map((item) => escapeHtml(item)).join("、") : "这次没有返回额外焦点标签。"} </p>
        </article>
        <article class="feedback-card">
          <h3>适用题目</h3>
          <p>${escapeHtml(prompt.title)} · ${escapeHtml(prompt.genre)}</p>
        </article>
      </div>
      ${
        (review.sentence_upgrades || []).length
          ? `
            <div class="correction-list">
              ${review.sentence_upgrades
                .map(
                  (item) => `
                    <article class="correction-item">
                      <strong>原句</strong>
                      <p>${escapeHtml(item.source)}</p>
                      <strong>更优写法</strong>
                      <p>${escapeHtml(item.better_version)}</p>
                      <p>${escapeHtml(item.why)}</p>
                    </article>
                  `,
                )
                .join("")}
            </div>
          `
          : ""
      }
      ${
        (review.vocabulary_upgrades || []).length
          ? `
            <div class="correction-list">
              ${review.vocabulary_upgrades
                .map(
                  (item) => `
                    <article class="correction-item">
                      <strong>可替换表达</strong>
                      <p>${escapeHtml(item.original)} -> ${escapeHtml(item.improved)}</p>
                      <p>${escapeHtml(item.reason)}</p>
                    </article>
                  `,
                )
                .join("")}
            </div>
          `
          : ""
      }
      ${
        (review.grammar_patterns || []).length
          ? `
            <div class="correction-list">
              ${review.grammar_patterns
                .map(
                  (item) => `
                    <article class="correction-item">
                      <strong>${escapeHtml(item.label)}</strong>
                      <p>${escapeHtml(item.symptom)}</p>
                      <p>${escapeHtml(item.advice)}</p>
                      ${item.evidence ? `<p>${escapeHtml(item.evidence)}</p>` : ""}
                    </article>
                  `,
                )
                .join("")}
            </div>
          `
          : ""
      }
      <div class="material-card">
        <h3>下一轮重写提纲</h3>
        <div class="prompt-list">
          ${(review.paragraph_plan || []).map((item) => `<div class="prompt-item">${escapeHtml(item)}</div>`).join("")}
        </div>
      </div>
      <div class="material-card">
        <h3>建议反复调用的表达</h3>
        <div class="material-strip">
          ${(review.useful_phrases || []).map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}
        </div>
      </div>
    </div>
  `;
}

function requestAiWritingReview(prompt, localReview, essayText) {
  return fetch(getApiUrl("/api/ai/writing-review"), {
    method: "POST",
    headers: createAiRequestHeaders({
      "Content-Type": "application/json",
      Accept: "application/json",
    }),
    body: JSON.stringify({
      prompt_payload: prompt,
      essay_text: essayText,
      target_band: state.settings.writingTargetBand,
      local_metrics: {
        words: localReview.words,
        paragraphs: localReview.paragraphs,
        sentences: localReview.sentences,
        keywordCoverage: localReview.keywordCoverage,
        connectorCount: localReview.connectorCount,
        overallBand: localReview.overallBand,
        breakdown: localReview.bandBreakdown,
        signals: localReview.signals,
      },
    }),
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "AI 写作精批服务暂时不可用。");
    }
    return payload;
  });
}

async function handleWritingLocalAnalysis() {
  if (!elements.writingEssay) {
    return;
  }
  const essayText = elements.writingEssay.value.trim();
  if (!essayText) {
    renderWritingMessage("warning", "还没有作文内容", "先写完一篇 Task 1 或 Task 2，再点击本地快评。");
    return;
  }

  renderWritingLoading("正在做本地快评", "我在检查字数、段落、关键词覆盖、立场和 overview 等结构信号，请稍等一下。");
  const prompt = getActiveWritingPrompt();
  const localReview = buildLocalWritingReview(prompt, essayText, state.settings.writingTargetBand);
  renderLocalWritingReview(prompt, localReview);
  renderCoachTips();
  announce("本地写作快评已生成");
}

async function handleWritingAiAnalysis() {
  if (!elements.writingEssay || !elements.writingResult) {
    return;
  }
  const essayText = elements.writingEssay.value.trim();
  if (!essayText) {
    renderWritingMessage("warning", "还没有作文内容", "先写完一篇作文，再点击 AI 精批。");
    return;
  }

  if (!ui.ai.available) {
    renderWritingMessage(
      "warning",
      hasAiApiSupport() ? "AI 代理还没有连接上" : "AI 后端还没有配置",
      `${getUnavailableAiHint()} 如果你现在只想先看结构问题，可以先点“本地快评”。`,
    );
    return;
  }

  renderWritingLoading("正在进行 AI 精批", "我会先做一轮本地快评，再把题目和作文发给当前 AI 后端做四项维度点评，这会比本地分析多等一会儿。");

  let localReview = null;
  try {
    const prompt = getActiveWritingPrompt();
    localReview = buildLocalWritingReview(prompt, essayText, state.settings.writingTargetBand);
    renderLocalWritingReview(prompt, localReview);

    const aiPayload = await requestAiWritingReview(prompt, localReview, essayText);
    elements.writingResult.insertAdjacentHTML("beforeend", renderAiWritingReview(prompt, aiPayload));
    saveAiWritingArchive(prompt, localReview, aiPayload);
    renderWritingProgress();
    renderCoachTips();
    announce("AI 写作精批已生成");
  } catch (error) {
    if (localReview) {
      elements.writingResult.insertAdjacentHTML(
        "beforeend",
        `
          <div class="feedback feedback--danger">
            <strong>AI 精批失败</strong>
            <p>${escapeHtml(error.message || "AI 服务暂时无法处理这篇作文。当前已保留本地快评结果。")}</p>
          </div>
        `,
      );
    } else {
      renderWritingMessage(
        "danger",
        "AI 精批失败",
        error.message || "AI 服务暂时无法处理这篇作文。你可以先使用本地快评，或者检查代理服务是否已经启动。",
      );
    }
  }
}

function renderWritingProgress() {
  if (
    !elements.writingMetrics ||
    !elements.writingFocusChip ||
    !elements.writingFocusList ||
    !elements.writingHistoryChip ||
    !elements.writingHistoryList
  ) {
    return;
  }
  const archive = getWritingArchive();

  if (!archive.length) {
    elements.writingMetrics.innerHTML = `
      <article class="metric-card metric-card--accent">
        <span class="metric-card__label">AI 精批次数</span>
        <strong class="metric-card__value">0</strong>
        <p>做完第一次 AI 写作精批后，这里会开始生成提分轨迹。</p>
      </article>
      <article class="metric-card">
        <span class="metric-card__label">最近平均分</span>
        <strong class="metric-card__value">--</strong>
        <p>默认统计最近 3 次 AI 写作精批。</p>
      </article>
      <article class="metric-card">
        <span class="metric-card__label">趋势变化</span>
        <strong class="metric-card__value">--</strong>
        <p>会比较最近几次批改和更早几次的均值。</p>
      </article>
      <article class="metric-card">
        <span class="metric-card__label">当前薄弱维度</span>
        <strong class="metric-card__value">待生成</strong>
        <p>任务回应、结构、词汇和语法都会单独跟踪。</p>
      </article>
    `;
    elements.writingFocusChip.textContent = "0 个焦点";
    elements.writingHistoryChip.textContent = "0 次批改";
    elements.writingFocusList.innerHTML = `
      <div class="study-empty">
        <div>
          <h3>还没有高频焦点</h3>
          <p>当你累计几次 AI 精批后，这里会自动归纳重复出现的写作问题。</p>
        </div>
      </div>
    `;
    elements.writingHistoryList.innerHTML = `
      <div class="study-empty">
        <div>
          <h3>还没有 AI 写作档案</h3>
          <p>先完成一次 AI 精批，系统会把分数、焦点、改写建议和重写提纲存到这里。</p>
        </div>
      </div>
    `;
    return;
  }

  const recentAverage = average(archive.slice(0, 3).map((entry) => entry.overallBand));
  const trend = getWritingTrend(archive);
  const weakestDimension = getWritingWeakestDimension(archive);
  const coverage = getWritingCoverage(archive);
  const focusAreas = aggregateWritingFocusAreas(archive);

  elements.writingMetrics.innerHTML = `
    <article class="metric-card metric-card--accent">
      <span class="metric-card__label">AI 精批次数</span>
      <strong class="metric-card__value">${archive.length}</strong>
      <p>当前已覆盖 ${coverage} 个写作任务类型。</p>
    </article>
    <article class="metric-card">
      <span class="metric-card__label">最近平均分</span>
      <strong class="metric-card__value">${recentAverage.toFixed(1)}</strong>
      <p>按最近 3 次 AI 精批综合估算。</p>
    </article>
    <article class="metric-card">
      <span class="metric-card__label">趋势变化</span>
      <strong class="metric-card__value">${formatDelta(trend)}</strong>
      <p>正数说明最近表现比前几次更稳定。</p>
    </article>
    <article class="metric-card">
      <span class="metric-card__label">当前薄弱维度</span>
      <strong class="metric-card__value">${weakestDimension.label}</strong>
      <p>最近平均约 ${weakestDimension.score.toFixed(1)}，建议优先盯这一项。</p>
    </article>
  `;

  elements.writingFocusChip.textContent = `${focusAreas.length} 个焦点`;
  elements.writingHistoryChip.textContent = `${archive.length} 次批改`;
  elements.writingFocusList.innerHTML = focusAreas.length
    ? focusAreas.slice(0, 6).map((item) => {
        return `
          <article class="grammar-item">
            <div class="history-card__head">
              <strong>${escapeHtml(item.label)}</strong>
              <span class="badge">出现 ${item.count} 次</span>
            </div>
            <p>${escapeHtml(item.suggestion || "建议下次重写时优先盯住这一项。")}</p>
          </article>
        `;
      }).join("")
    : `
      <div class="study-empty">
        <div>
          <h3>还没有可聚合的写作焦点</h3>
          <p>等你多积累几次 AI 精批，这里会开始收敛出高频问题。</p>
        </div>
      </div>
    `;

  elements.writingHistoryList.innerHTML = archive.slice(0, 6).map((entry) => {
    const breakdown = entry.bandBreakdown || {
      task_response: 0,
      coherence_cohesion: 0,
      lexical_resource: 0,
      grammatical_range_accuracy: 0,
    };
    const plan = (entry.paragraphPlan || []).slice(0, 2);
    const phrases = (entry.usefulPhrases || []).slice(0, 3);
    return `
      <article class="history-card">
        <div class="history-card__head">
          <div>
            <strong>${escapeHtml(entry.promptTitle)}</strong>
            <p>${entry.task === "task1" ? "Task 1" : "Task 2"} · ${escapeHtml(entry.genre || "")} · ${formatCalendarDate(entry.timestamp)}</p>
          </div>
          <span class="badge badge--success">Band ${Number(entry.overallBand || 0).toFixed(1)}</span>
        </div>
        <div class="history-card__scores">
          <span class="badge">${entry.task === "task1" ? "TA" : "TR"} ${Number(breakdown.task_response || 0).toFixed(1)}</span>
          <span class="badge">CC ${Number(breakdown.coherence_cohesion || 0).toFixed(1)}</span>
          <span class="badge">LR ${Number(breakdown.lexical_resource || 0).toFixed(1)}</span>
          <span class="badge">GRA ${Number(breakdown.grammatical_range_accuracy || 0).toFixed(1)}</span>
        </div>
        <p class="history-card__meta">${escapeHtml(entry.primaryIssue)}</p>
        <div class="history-card__block">
          <strong>下轮重写重点</strong>
          <div class="tag-row">
            ${(entry.focusAreas || []).length
              ? entry.focusAreas.slice(0, 4).map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")
              : '<span class="tag">继续优化结构和展开</span>'}
          </div>
        </div>
        <div class="history-card__block">
          <strong>重写提纲</strong>
          <ul>
            ${plan.length ? plan.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : "<li>下次重写时先稳住引言、主体、结尾的基本骨架。</li>"}
          </ul>
        </div>
        <div class="history-card__block">
          <strong>可复用表达</strong>
          ${
            phrases.length
              ? `<div class="tag-row">${phrases.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}</div>`
              : "<p>这次先优先稳住任务回应和段落功能。</p>"
          }
        </div>
      </article>
    `;
  }).join("");
}

function renderStaticPanels() {
  renderDashboard();
  renderDecks();
  renderWordBank();
  renderReviewTimeline();
  renderSpeakingProgress();
  if (elements.writingMetrics) {
    renderWritingProgress();
  }
  renderCoachTips();
  renderCloudSyncUi();
}

function announce(message) {
  elements.liveRegion.textContent = message;
}

function setPronunciationStatus(message, tone = "info") {
  if (!elements.pronunciationStatus) {
    announce(message);
    return;
  }

  elements.pronunciationStatus.textContent = `发音状态：${message}`;
  elements.pronunciationStatus.className = `chip chip--${tone}`;
  announce(message);
}

function initVoices() {
  if (!("speechSynthesis" in window)) {
    return;
  }

  const updateVoices = () => {
    ui.voices = window.speechSynthesis.getVoices();
  };

  updateVoices();
  if (typeof window.speechSynthesis.onvoiceschanged !== "undefined") {
    window.speechSynthesis.onvoiceschanged = updateVoices;
  }
}

function pickVoice() {
  if (!ui.voices.length) {
    return null;
  }
  const preferredPrefix = state.settings.accent === "us" ? "en-US" : "en-GB";
  return (
    ui.voices.find((voice) => voice.lang === preferredPrefix || voice.lang.startsWith(preferredPrefix)) ||
    ui.voices.find((voice) => voice.lang.startsWith("en-")) ||
    null
  );
}

function getPronunciationProxyBase() {
  return hasConfiguredPronunciationProxy() ? RUNTIME_CONFIG.pronunciationApiBaseUrl : "";
}

function shouldUseHostedPronunciationProxy() {
  return Boolean(getPronunciationProxyBase()) || supportsSameOriginHostedApis();
}

function getPreferredTtsLocale() {
  return state.settings.accent === "us" ? "en-US" : "en-GB";
}

function splitTextForTts(text, maxLength = MAX_TTS_SEGMENT_LENGTH) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }

  if (normalized.length <= maxLength) {
    return [normalized];
  }

  const chunks = [];
  const clauses = normalized.split(/(?<=[,.;!?])\s+/).filter(Boolean);

  clauses.forEach((clause) => {
    if (clause.length <= maxLength) {
      const current = chunks[chunks.length - 1];
      if (current && current.length + clause.length + 1 <= maxLength) {
        chunks[chunks.length - 1] = `${current} ${clause}`;
      } else {
        chunks.push(clause);
      }
      return;
    }

    const words = clause.split(/\s+/).filter(Boolean);
    let current = "";
    words.forEach((word) => {
      if (!current) {
        current = word;
        return;
      }
      if (current.length + word.length + 1 <= maxLength) {
        current = `${current} ${word}`;
      } else {
        chunks.push(current);
        current = word;
      }
    });
    if (current) {
      chunks.push(current);
    }
  });

  return chunks.filter(Boolean);
}

function buildDirectTtsUrl(text) {
  const query = new URLSearchParams({
    ie: "UTF-8",
    client: "gtx",
    tl: getPreferredTtsLocale(),
    q: text,
  });
  return `${DIRECT_TTS_BASE_URL}?${query.toString()}`;
}

function buildHostedTtsUrl(text) {
  const query = new URLSearchParams({
    text,
    accent: state.settings.accent,
  });
  const base = getPronunciationProxyBase();
  return `${base}${ONLINE_TTS_PROXY_PATH}?${query.toString()}`;
}

function getOnlinePronunciationSources(text) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }

  const cacheKey = `${state.settings.accent}:${shouldUseHostedPronunciationProxy() ? "proxy" : "direct"}:${normalized}`;
  if (ui.pronunciationCache.has(cacheKey)) {
    return ui.pronunciationCache.get(cacheKey) || [];
  }

  const segments = splitTextForTts(normalized);
  const urls = segments.map((segment) => (shouldUseHostedPronunciationProxy() ? buildHostedTtsUrl(segment) : buildDirectTtsUrl(segment)));
  ui.pronunciationCache.set(cacheKey, urls);
  return urls;
}

function cleanupPronunciationAudioHandlers() {
  if (!ui.pronunciationAudio) {
    return;
  }
  ui.pronunciationAudio.onended = null;
  ui.pronunciationAudio.onerror = null;
}

function stopPronunciationPlayback() {
  ui.pronunciationQueue = [];
  if (ui.pronunciationAudio) {
    cleanupPronunciationAudioHandlers();
    ui.pronunciationAudio.pause();
    ui.pronunciationAudio.currentTime = 0;
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function playAudioSourceList(urls = []) {
  if (!urls.length) {
    return Promise.resolve({ ok: false, reason: "missing_source" });
  }

  if (!ui.pronunciationAudio) {
    ui.pronunciationAudio = new Audio();
    ui.pronunciationAudio.preload = "none";
  }

  stopPronunciationPlayback();
  ui.pronunciationQueue = [...urls];

  return new Promise((resolve) => {
    let started = false;

    const playNext = () => {
      const nextUrl = ui.pronunciationQueue.shift();
      if (!nextUrl) {
        cleanupPronunciationAudioHandlers();
        return;
      }

      ui.pronunciationAudio.src = nextUrl;
      const playback = ui.pronunciationAudio.play();
      if (playback && typeof playback.then === "function") {
        playback
          .then(() => {
            if (!started) {
              started = true;
              resolve({ ok: true, reason: "playing" });
            }
          })
          .catch((error) => {
            cleanupPronunciationAudioHandlers();
            if (!started) {
              const reason = error?.name === "NotAllowedError" ? "blocked" : "play_failed";
              resolve({ ok: false, reason });
            }
          });
      } else if (!started) {
        started = true;
        resolve({ ok: true, reason: "playing" });
      }
    };

    ui.pronunciationAudio.onended = () => {
      if (ui.pronunciationQueue.length) {
        playNext();
      } else {
        cleanupPronunciationAudioHandlers();
      }
    };

    ui.pronunciationAudio.onerror = () => {
      cleanupPronunciationAudioHandlers();
      if (!started) {
        resolve({ ok: false, reason: "audio_error" });
      }
    };

    playNext();
  });
}

function speakText(text, options = {}) {
  if (!("speechSynthesis" in window)) {
    if (!options.silent) {
      setPronunciationStatus("当前设备不支持系统朗读", "danger");
    }
    return false;
  }

  if (ui.pronunciationAudio) {
    ui.pronunciationAudio.pause();
    ui.pronunciationAudio.currentTime = 0;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = state.settings.accent === "us" ? "en-US" : "en-GB";
  const voice = pickVoice();
  if (voice) {
    utterance.voice = voice;
  }
  utterance.rate = 0.92;
  window.speechSynthesis.speak(utterance);
  return true;
}

async function playOnlinePronunciation(text) {
  const urls = getOnlinePronunciationSources(text);
  if (!urls.length) {
    return { ok: false, reason: "missing_source" };
  }
  const result = await playAudioSourceList(urls);
  if (result.ok) {
    setPronunciationStatus("正在播放在线语音", "success");
  }
  return result;
}

async function handleSpeakItem(itemId, mode) {
  const item = getItemById(itemId);
  if (!item) {
    return;
  }
  const text = mode === "example" ? item.example : item.term;
  setPronunciationStatus("正在请求在线语音...", "info");

  const onlineResult = await playOnlinePronunciation(text);
  if (onlineResult.ok) {
    return;
  }

  const playedLocally = speakText(text, { silent: true });
  if (playedLocally) {
    if (onlineResult.reason === "blocked") {
      setPronunciationStatus("浏览器拦了在线音频，已切到系统朗读", "warning");
    } else {
      setPronunciationStatus("在线语音暂不可用，已切到系统朗读", "warning");
    }
    return;
  }

  setPronunciationStatus("浏览器或网络可能阻止了音频。请检查标签页静音、网站声音权限，或换 Chrome / Safari 重试。", "danger");
}

function getSpeakingMode() {
  return elements.speakingMode?.value || ui.speakingMode || "full";
}

function isSpeakingFullMockMode() {
  return getSpeakingMode() === "full";
}

function getSpeakingPartIndex(part) {
  return SPEAKING_PART_ORDER.indexOf(part);
}

function getNextSpeakingPart(part) {
  const currentIndex = getSpeakingPartIndex(part);
  return currentIndex >= 0 && currentIndex < SPEAKING_PART_ORDER.length - 1 ? SPEAKING_PART_ORDER[currentIndex + 1] : null;
}

function clearSpeakingInput() {
  cleanupSpeakingAudioUrl();
  if (elements.speakingAudio) {
    elements.speakingAudio.value = "";
  }
  if (elements.speakingAudioPlayer) {
    elements.speakingAudioPlayer.removeAttribute("src");
    elements.speakingAudioPlayer.load();
  }
  if (elements.speakingTranscript) {
    elements.speakingTranscript.value = "";
  }
}

function updateSpeakingActionButtons() {
  if (elements.speakingPart) {
    elements.speakingPart.disabled = isSpeakingFullMockMode();
  }

  if (elements.speakingAnalyzeLocal) {
    elements.speakingAnalyzeLocal.textContent = isSpeakingFullMockMode() ? "先看当前段本地分析" : "本地分析";
  }

  if (elements.speakingAnalyzeAi) {
    if (!ui.ai.available) {
      elements.speakingAnalyzeAi.textContent = isSpeakingFullMockMode() ? "AI 未连接，暂时不能进入下一部分" : "AI 未连接";
      elements.speakingAnalyzeAi.disabled = true;
    } else if (!isSpeakingFullMockMode()) {
      elements.speakingAnalyzeAi.textContent = "AI 深度批改";
      elements.speakingAnalyzeAi.disabled = false;
    } else if (ui.speakingMockSession.summary) {
      elements.speakingAnalyzeAi.textContent = "本轮已完成，请先重置";
      elements.speakingAnalyzeAi.disabled = false;
    } else {
      const activePart = ui.speakingMockSession.activePart || SPEAKING_PART_ORDER[0];
      elements.speakingAnalyzeAi.textContent =
        activePart === "part3" ? "提交 Part 3 并生成总评" : `提交 ${SPEAKING_PART_LABELS[activePart]} 并进入下一部分`;
      elements.speakingAnalyzeAi.disabled = false;
    }
  }

  if (elements.speakingResetMock) {
    elements.speakingResetMock.textContent = isSpeakingFullMockMode() ? "重新开始模考" : "清空当前录音";
  }
}

function renderSpeakingSessionShell() {
  if (!elements.speakingSessionShell) {
    return;
  }

  if (!isSpeakingFullMockMode()) {
    elements.speakingSessionShell.innerHTML = `
      <div class="mock-session-shell">
        <div class="mock-session-shell__head">
          <div>
            <p class="eyebrow eyebrow--compact">单段复盘</p>
            <h3>聚焦当前这一段回答</h3>
          </div>
          <span class="badge">可单独训练任一 Part</span>
        </div>
        <p class="mock-session-shell__hint">适合单独练一个题目。提交音频后会直接返回这一段的 AI 转写、问题定位和素材建议。</p>
      </div>
    `;
    return;
  }

  const session = ui.speakingMockSession;
  const completedCount = SPEAKING_PART_ORDER.filter((part) => session.responses[part]).length;
  const activePart = session.summary ? null : session.activePart || SPEAKING_PART_ORDER[0];
  const partCards = SPEAKING_PART_ORDER.map((part) => {
    const response = session.responses[part];
    const status = response ? "done" : part === activePart ? "active" : "pending";
    const modifier = status === "done" ? " mock-stage-card--done" : status === "active" ? " mock-stage-card--active" : "";
    const promptTitle = response?.promptTitle || speakingMockBank[part]?.[0]?.title || "待选择题目";
    const meta = response
      ? `已完成 · Band ${Number(response.overallBand || 0).toFixed(1)}`
      : status === "active"
        ? "当前上传这一段录音"
        : "等待上一段完成后自动切换";
    return `
      <article class="mock-stage-card${modifier}">
        <span class="mock-stage-card__step">${SPEAKING_PART_LABELS[part]}</span>
        <strong>${promptTitle}</strong>
        <p>${meta}</p>
      </article>
    `;
  }).join("");

  const completedBands = SPEAKING_PART_ORDER
    .map((part) => {
      const response = session.responses[part];
      return response ? `<span class="tag">${SPEAKING_PART_LABELS[part]} ${Number(response.overallBand || 0).toFixed(1)}</span>` : "";
    })
    .filter(Boolean)
    .join("");

  elements.speakingSessionShell.innerHTML = `
    <div class="mock-session-shell">
      <div class="mock-session-shell__head">
        <div>
          <p class="eyebrow eyebrow--compact">全真三段模考</p>
          <h3>${session.summary ? "这一轮模考已完成" : `当前进行到 ${SPEAKING_PART_LABELS[activePart || "part3"]}`}</h3>
        </div>
        <span class="badge">${completedCount}/3 已完成</span>
      </div>
      <p class="mock-session-shell__hint">
        每段各上传一次录音。系统会先给当前段的 AI 转写和问题定位，再自动推进到下一段；第三段结束后会生成整轮总评。
      </p>
      <div class="mock-stage-grid">${partCards}</div>
      ${
        completedBands
          ? `
            <div class="material-card">
              <h4>本轮已完成段落</h4>
              <div class="tag-row">${completedBands}</div>
            </div>
          `
          : ""
      }
    </div>
  `;
}

function syncSpeakingControlsForPart(part) {
  if (elements.speakingPart) {
    elements.speakingPart.value = part;
  }
  populateSpeakingPrompts();
  renderSpeakingSessionShell();
  updateSpeakingActionButtons();
}

function resetSpeakingMockSession(options = {}) {
  const { keepResult = false, announceMessage = "" } = options;
  ui.speakingMockSession = createEmptySpeakingMockSession();
  clearSpeakingInput();
  syncSpeakingControlsForPart(SPEAKING_PART_ORDER[0]);
  if (!keepResult) {
    renderSpeakingPlaceholder();
  }
  if (announceMessage) {
    announce(announceMessage);
  }
}

function populateSpeakingPrompts() {
  const part = elements.speakingPart.value;
  const prompts = speakingMockBank[part];
  if (!prompts?.length) {
    elements.speakingPrompt.innerHTML = "";
    return;
  }
  const storedPromptId = ui.speakingPromptSelections[part];
  elements.speakingPrompt.innerHTML = prompts
    .map((prompt) => `<option value="${prompt.id}">${prompt.title}</option>`)
    .join("");
  elements.speakingPrompt.value = prompts.some((prompt) => prompt.id === storedPromptId) ? storedPromptId : prompts[0].id;
  ui.speakingPromptSelections[part] = elements.speakingPrompt.value;
  renderSpeakingPromptCard();
  renderSpeakingSessionShell();
  updateSpeakingActionButtons();
}

function getSelectedSpeakingPrompt() {
  const prompts = speakingMockBank[elements.speakingPart.value];
  return prompts.find((prompt) => prompt.id === elements.speakingPrompt.value) || prompts[0];
}

function renderSpeakingPromptCard() {
  const prompt = getSelectedSpeakingPrompt();
  if (!prompt) {
    return;
  }
  const target = `${formatSeconds(prompt.targetDuration.min)} - ${formatSeconds(prompt.targetDuration.max)}`;
  const modeHint = isSpeakingFullMockMode()
    ? `当前是全真三段模考，会在完成 ${SPEAKING_PART_LABELS[prompt.part]} 后自动进入下一段。`
    : "当前是单段复盘模式，可以单独练这一段。";
  elements.speakingPromptCard.innerHTML = `
    <div class="mock-shell">
      <div class="badge-row">
        <span class="badge">${prompt.part.toUpperCase()}</span>
        <span class="badge">建议时长 ${target}</span>
      </div>
      <h3>${prompt.title}</h3>
      <p class="mock-shell__meta">${prompt.intro}</p>
      <p class="mock-shell__meta">${modeHint}</p>
      <div class="prompt-list">
        ${prompt.questions.map((question) => `<div class="prompt-item">${question}</div>`).join("")}
      </div>
      <div class="material-card">
        <h4>建议先准备的素材</h4>
        <p>先把这些词块或展开角度背顺，录音时更容易自然展开。</p>
        <div class="material-strip">
          ${prompt.materials.map((material) => `<span class="tag">${material}</span>`).join("")}
        </div>
      </div>
    </div>
  `;
}

function populateWritingPrompts() {
  if (!elements.writingTask || !elements.writingPrompt || !elements.writingPromptCard) {
    return;
  }
  const prompts = writingPromptBank[elements.writingTask.value] || [];
  if (!prompts.length) {
    elements.writingPrompt.innerHTML = "";
    elements.writingPromptCard.innerHTML = "";
    return;
  }

  if (!prompts.some((prompt) => prompt.id === state.writingDraft.promptId)) {
    state.writingDraft.promptId = prompts[0].id;
  }

  elements.writingPrompt.innerHTML = prompts
    .map((prompt) => `<option value="${prompt.id}">${prompt.title} · ${prompt.genre}</option>`)
    .join("");
  elements.writingPrompt.value = state.writingDraft.promptId;
  renderWritingPromptCard();
}

function getSelectedWritingPrompt() {
  if (!elements.writingTask || !elements.writingPrompt) {
    return null;
  }
  const prompts = writingPromptBank[elements.writingTask.value] || [];
  return prompts.find((prompt) => prompt.id === elements.writingPrompt.value) || prompts[0];
}

function getActiveWritingPrompt() {
  const basePrompt = getSelectedWritingPrompt();
  if (!basePrompt) {
    return null;
  }
  const customPrompt = elements.writingCustomPrompt.value.trim();
  if (!customPrompt) {
    return basePrompt;
  }

  return {
    ...basePrompt,
    title: "自定义题目",
    source: "用户粘贴题目",
    prompt: customPrompt,
    keywords: extractPromptKeywords(customPrompt).length ? extractPromptKeywords(customPrompt) : basePrompt.keywords,
  };
}

function renderWritingPromptCard() {
  if (!elements.writingPromptCard) {
    return;
  }
  const prompt = getSelectedWritingPrompt();
  if (!prompt) {
    return;
  }

  const writingChunks = vocabularyBank
    .filter((item) => item.category === "writing" && item.kind === "chunk")
    .slice(0, 3)
    .map((item) => item.term);
  const materials = [...prompt.materials, ...writingChunks].slice(0, 6);

  elements.writingPromptCard.innerHTML = `
    <div class="mock-shell">
      <div class="badge-row">
        <span class="badge">${prompt.task === "task1" ? "Task 1 Academic" : "Task 2 Essay"}</span>
        <span class="badge">${prompt.genre}</span>
        <span class="badge">建议至少 ${prompt.minimumWords} 词</span>
      </div>
      <h3>${escapeHtml(prompt.title)}</h3>
      <p class="mock-shell__meta">${escapeHtml(prompt.intro)}</p>
      <div class="prompt-list">
        <div class="prompt-item">
          <strong>题目</strong>
          <p>${escapeHtml(prompt.prompt)}</p>
        </div>
        ${prompt.details.map((item) => `<div class="prompt-item">${escapeHtml(item)}</div>`).join("")}
      </div>
      <div class="material-card">
        <h4>写前检查清单</h4>
        <div class="tag-row">
          ${prompt.checklist.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}
        </div>
      </div>
      <div class="material-card">
        <h4>可先调用的写作表达</h4>
        <div class="material-strip">
          ${materials.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}
        </div>
      </div>
    </div>
  `;
}

function updateWritingCounts() {
  if (!elements.writingEssay || !elements.writingWordCount || !elements.writingParagraphCount) {
    return;
  }
  const essay = elements.writingEssay.value;
  elements.writingWordCount.textContent = `${countEssayWords(essay)} 词`;
  elements.writingParagraphCount.textContent = `${splitEssayParagraphs(essay).length || 0} 段`;
}

function renderSpeakingPlaceholder() {
  elements.speakingResult.innerHTML = `
    <div class="study-empty">
      <div>
        <h3>${isSpeakingFullMockMode() ? "从 Part 1 开始上传录音，就能进入整轮模考" : "上传一段口语录音后就能开始分析"}</h3>
        <p>${isSpeakingFullMockMode() ? "每段各上传一次音频，系统会自动推进到下一部分，并在 Part 3 结束后生成整轮总评。" : "你可以先做本地节奏分析；如果通过本地代理连上 AI，还能拿到 AI 转写和真正的口语批改结果。"}</p>
      </div>
    </div>
  `;
}

function renderWritingPlaceholder() {
  if (!elements.writingResult) {
    return;
  }
  elements.writingResult.innerHTML = `
    <div class="study-empty">
      <div>
        <h3>选一道写作题，写完后就能开始批改</h3>
        <p>你可以先做本地快评看结构短板；如果本地代理已经接好 AI，还能拿到更细的 AI 精批结果。</p>
      </div>
    </div>
  `;
}

function updateAiStatusUI() {
  const pairs = [
    [elements.aiStatusChip, elements.aiModelMeta],
    [elements.writingAiStatusChip, elements.writingAiModelMeta],
  ].filter(([chip, meta]) => chip && meta);

  const unavailableHint =
    ui.ai.statusHint ||
    "请用 server.py 启动本地代理，并设置 AI_API_KEY（或 OPENAI_API_KEY / OPENROUTER_API_KEY）";
  const unavailableLabel = !hasAiApiSupport() ? "AI 未配置" : "AI 未连接";

  pairs.forEach(([chip, meta]) => {
    chip.className = "badge";
    if (!ui.ai.checked) {
      chip.textContent = "AI 状态检测中";
      meta.textContent = "正在尝试连接本地代理服务";
      return;
    }

    if (ui.ai.available) {
      chip.classList.add("badge--success");
      chip.textContent = "AI 已连接";
      const providerLabel = ui.ai.providerLabel || ui.ai.provider || "AI";
      meta.textContent = `${providerLabel} · 转写 ${ui.ai.transcribeModel} · 批改 ${ui.ai.reviewModel}`;
      updateSpeakingActionButtons();
      return;
    }

    chip.classList.add("badge--warning");
    chip.textContent = unavailableLabel;
    meta.textContent = unavailableHint;
    updateSpeakingActionButtons();
  });

  if (elements.writingAnalyzeAi) {
    elements.writingAnalyzeAi.disabled = !ui.ai.available;
  }
}

function getUnavailableAiHint() {
  if (!hasAiApiSupport()) {
    if (isGitHubPagesHost()) {
      return "GitHub Pages 只能托管静态前端；如果要继续用 AI 口语和写作批改，请在 site-config.js 里配置 backendBaseUrl（或 aiApiBaseUrl）指向独立后端。";
    }
    return "当前入口还没有接上 AI 后端；请在 site-config.js 里配置 backendBaseUrl（或 aiApiBaseUrl），或者继续用本地 server.py。";
  }

  return "请用 server.py 启动本地代理，并设置 AI_API_KEY（或 OPENAI_API_KEY / OPENROUTER_API_KEY）";
}

async function checkAiStatus() {
  if (!hasAiApiSupport()) {
    ui.ai.checked = true;
    ui.ai.available = false;
    ui.ai.provider = "";
    ui.ai.providerLabel = "";
    ui.ai.baseUrl = "";
    ui.ai.transcribeModel = "";
    ui.ai.reviewModel = "";
    ui.ai.writingReviewModel = "";
    ui.ai.statusHint = getUnavailableAiHint();
    updateAiStatusUI();
    return;
  }

  try {
    const response = await fetch(getApiUrl("/api/ai/status"), {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error("status request failed");
    }
    const payload = await response.json();
    ui.ai.checked = true;
    ui.ai.available = Boolean(payload.available);
    ui.ai.provider = payload.provider || "";
    ui.ai.providerLabel = payload.provider_label || payload.provider || "";
    ui.ai.baseUrl = payload.base_url || "";
    ui.ai.transcribeModel = payload.transcribe_model || "";
    ui.ai.reviewModel = payload.review_model || "";
    ui.ai.writingReviewModel = payload.writing_review_model || payload.review_model || "";
    ui.ai.statusHint = "";
  } catch (error) {
    ui.ai.checked = true;
    ui.ai.available = false;
    ui.ai.provider = "";
    ui.ai.providerLabel = "";
    ui.ai.baseUrl = "";
    ui.ai.transcribeModel = "";
    ui.ai.reviewModel = "";
    ui.ai.writingReviewModel = "";
    ui.ai.statusHint = getUnavailableAiHint();
  }
  updateAiStatusUI();
}

function renderSpeakingMessage(type, title, message) {
  elements.speakingResult.innerHTML = `
    <div class="feedback feedback--${type}">
      <strong>${title}</strong>
      <p>${message}</p>
    </div>
  `;
}

function cleanupSpeakingAudioUrl() {
  if (ui.speakingAudioUrl) {
    URL.revokeObjectURL(ui.speakingAudioUrl);
    ui.speakingAudioUrl = "";
  }
}

function handleSpeakingAudioChange() {
  cleanupSpeakingAudioUrl();
  const file = elements.speakingAudio.files?.[0];
  if (!file) {
    elements.speakingAudioPlayer.removeAttribute("src");
    elements.speakingAudioPlayer.load();
    return;
  }
  ui.speakingAudioUrl = URL.createObjectURL(file);
  elements.speakingAudioPlayer.src = ui.speakingAudioUrl;
}

async function decodeAudio(file) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("当前浏览器不支持本地音频分析。");
  }

  const audioContext = new AudioContextClass();
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    return buffer;
  } finally {
    if (audioContext.close) {
      audioContext.close();
    }
  }
}

function analyseAudioBuffer(buffer) {
  const samples = buffer.getChannelData(0);
  const windowSize = Math.max(2048, Math.floor(buffer.sampleRate * 0.1));
  const windowDuration = windowSize / buffer.sampleRate;
  const rmsValues = [];
  let totalRms = 0;
  let peakRms = 0;

  for (let index = 0; index < samples.length; index += windowSize) {
    const end = Math.min(samples.length, index + windowSize);
    let sum = 0;
    for (let pointer = index; pointer < end; pointer += 1) {
      sum += samples[pointer] * samples[pointer];
    }
    const rms = Math.sqrt(sum / Math.max(1, end - index));
    rmsValues.push(rms);
    totalRms += rms;
    if (rms > peakRms) {
      peakRms = rms;
    }
  }

  const averageRms = rmsValues.length ? totalRms / rmsValues.length : 0;
  const silenceThreshold = Math.max(averageRms * 0.42, peakRms * 0.08, 0.005);
  let activeWindows = 0;
  let speechBursts = 0;
  let longestPause = 0;
  let longPauses = 0;
  let currentPause = 0;
  let inSpeech = false;

  rmsValues.forEach((rms) => {
    const isActive = rms > silenceThreshold;
    if (isActive) {
      activeWindows += 1;
      if (!inSpeech) {
        speechBursts += 1;
      }
      inSpeech = true;
      currentPause = 0;
      return;
    }

    currentPause += windowDuration;
    inSpeech = false;
    if (currentPause > longestPause) {
      longestPause = currentPause;
    }
    if (Math.abs(currentPause - 0.8) < windowDuration / 2 || currentPause > 0.8 && currentPause - windowDuration <= 0.8) {
      longPauses += 1;
    }
  });

  return {
    durationSeconds: buffer.duration,
    activeRatio: rmsValues.length ? activeWindows / rmsValues.length : 0,
    longPauses,
    longestPause,
    speechBursts,
  };
}

function termUsedInTranscript(transcript, term) {
  const normalizedTranscript = normalizeAnswer(transcript);
  const normalizedTerm = normalizeAnswer(term);
  if (!normalizedTerm) {
    return false;
  }
  if (normalizedTerm.includes(" ")) {
    return normalizedTranscript.includes(normalizedTerm);
  }
  return new RegExp(`\\b${normalizedTerm}\\b`, "i").test(normalizedTranscript);
}

function analyseTranscript(transcript, durationSeconds, prompt) {
  const lower = transcript.toLowerCase();
  const words = lower.match(/[a-z']+/g) || [];
  const uniqueWords = new Set(words).size;
  const sentenceCount = transcript
    .split(/[.!?]+/)
    .map((segment) => segment.trim())
    .filter(Boolean).length;
  const fillerPatterns = ["um", "uh", "like", "you know", "actually", "basically", "sort of", "kind of", "well"];
  const fillerCount = fillerPatterns.reduce((count, phrase) => {
    const regex = new RegExp(`\\b${phrase.replace(/\s+/g, "\\s+")}\\b`, "gi");
    return count + (lower.match(regex) || []).length;
  }, 0);
  const connectorPatterns = ["because", "for example", "however", "while", "as a result", "in addition"];
  const connectorCount = connectorPatterns.reduce((count, phrase) => {
    const regex = new RegExp(`\\b${phrase.replace(/\s+/g, "\\s+")}\\b`, "gi");
    return count + (lower.match(regex) || []).length;
  }, 0);
  const materialHits = prompt.materials.filter((material) => termUsedInTranscript(lower, material)).length;

  return {
    wordCount: words.length,
    uniqueRatio: words.length ? uniqueWords / words.length : 0,
    fillerCount,
    connectorCount,
    speechRate: durationSeconds > 0 ? Math.round(words.length / (durationSeconds / 60)) : 0,
    averageSentenceLength: sentenceCount ? Math.round(words.length / sentenceCount) : words.length,
    materialHits,
  };
}

function buildSpeakingAnalysis(prompt, audioMetrics, transcriptMetrics) {
  const issues = [];
  const strengths = [];
  const nextSteps = [];
  const materials = [...prompt.materials];

  if (audioMetrics.durationSeconds < prompt.targetDuration.min) {
    issues.push(`时长偏短，当前只有 ${formatSeconds(audioMetrics.durationSeconds)}，还没有撑满 ${prompt.part === "part2" ? "描述细节" : "观点展开"}。`);
    nextSteps.push(prompt.part === "part2" ? "下次按“背景 - 细节 - 感受 - 结果”四段式展开。" : "每个问题尽量做到“观点 + 原因 + 一个具体细节”。");
  } else if (audioMetrics.durationSeconds > prompt.targetDuration.max + 20) {
    issues.push("时长偏长，说明有些句子重复或跑题，可以把重点再收束一点。");
    nextSteps.push("先说核心观点，再补一个细节，不必反复改写同一个意思。");
  } else {
    strengths.push("回答长度基本落在合理区间，整体节奏框架是对的。");
  }

  if (audioMetrics.longPauses >= 5 || audioMetrics.longestPause > 1.6) {
    issues.push(`长停顿偏多，当前检测到 ${audioMetrics.longPauses} 次明显卡顿，最长停顿约 ${audioMetrics.longestPause.toFixed(1)} 秒。`);
    nextSteps.push("先把连接句和起承转合词块背顺，减少临场组织语言的压力。");
    materials.push(...SUPPORT_MATERIALS.fluency);
  } else {
    strengths.push("停顿控制还不错，没有出现特别多的长空白段。");
  }

  if (audioMetrics.activeRatio < 0.55) {
    issues.push("发声占比偏低，说明回答中间的空白和犹豫仍然比较明显。");
  } else {
    strengths.push("整体发声占比比较稳定，说明你不是一直在断断续续地讲。");
  }

  if (transcriptMetrics) {
    if (transcriptMetrics.fillerCount >= 4) {
      issues.push(`filler 词偏多，像 um / like / you know 这类缓冲词一共出现了 ${transcriptMetrics.fillerCount} 次。`);
      nextSteps.push("把思考用的停顿换成自然的过渡句，而不是重复 filler。");
      materials.push(...SUPPORT_MATERIALS.fluency);
    } else {
      strengths.push("转写里 filler 不算多，说明口头小习惯还算可控。");
    }

    if (transcriptMetrics.uniqueRatio < 0.45) {
      issues.push("词汇重复偏多，说明你在同一个意思上反复使用相近词。");
      nextSteps.push("下次录音前先准备 3-4 个同主题替换表达，再练复述。");
      materials.push(...SUPPORT_MATERIALS.opinion);
    } else {
      strengths.push("词汇重复率不高，表达层次比只会一两个词要好。");
    }

    if (transcriptMetrics.connectorCount < 2 && prompt.part !== "part1") {
      issues.push("连接和展开信号偏少，回答容易显得句子在堆叠，而不是在推进。");
      nextSteps.push("刻意加入 because、for example、as a result 这类推进线索。");
      materials.push(...SUPPORT_MATERIALS.development);
    }

    if (transcriptMetrics.materialHits >= 2) {
      strengths.push("你已经用到了一些目标素材，这对口语稳定输出很有帮助。");
    } else {
      nextSteps.push("下次至少主动塞进 2 个准备好的词块，让回答更像“熟练输出”而不是临场拼接。");
    }

    if (transcriptMetrics.speechRate > 170) {
      issues.push(`语速偏快，当前估算约 ${transcriptMetrics.speechRate} WPM，可能会影响清晰度。`);
    } else if (transcriptMetrics.speechRate && transcriptMetrics.speechRate < 105) {
      issues.push(`语速偏慢，当前估算约 ${transcriptMetrics.speechRate} WPM，容易显得犹豫。`);
    } else if (transcriptMetrics.speechRate) {
      strengths.push(`语速大体在可接受范围内，当前约 ${transcriptMetrics.speechRate} WPM。`);
    }
  } else {
    nextSteps.push("如果你愿意补一份转写，系统就能继续分析 filler、词汇重复和展开质量。");
  }

  const uniqueMaterials = [...new Set(materials)].slice(0, 8);
  const analysis = {
    issues: issues.length ? issues : ["这次录音没有出现特别突出的节奏问题，可以继续往素材质量和自然度发力。"],
    strengths: strengths.length ? strengths : ["这次回答的基本结构是完整的。"],
    nextSteps: nextSteps.length ? nextSteps : ["继续保持现在的节奏，再把题目相关素材背得更熟一点。"],
    materials: uniqueMaterials,
    primaryIssue: issues[0] || "整体节奏比较稳定",
  };

  return analysis;
}

function saveSpeakingSummary(prompt, analysis) {
  const entry = {
    timestamp: Date.now(),
    part: prompt.part,
    promptTitle: prompt.title,
    primaryIssue: analysis.primaryIssue,
    materials: analysis.materials.slice(0, 3),
  };
  state.speakingHistory = [entry, ...state.speakingHistory].slice(0, 6);
  saveState();
}

function getSpeakingCriterionMeta() {
  return {
    fluency_coherence: {
      label: "流利与连贯",
      note: "看节奏、连接和观点展开",
    },
    lexical_resource: {
      label: "词汇资源",
      note: "看词汇自然度、替换能力和素材质量",
    },
    grammatical_range_accuracy: {
      label: "语法范围与准确度",
      note: "看句式变化、时态和准确率",
    },
    pronunciation: {
      label: "发音表现",
      note: "看清晰度、重音、节奏和可理解性",
    },
  };
}

function renderSpeakingCriterionPanels(breakdown = {}, criterionAnalysis = {}) {
  const meta = getSpeakingCriterionMeta();
  return `
    <div class="criterion-grid">
      ${Object.entries(meta)
        .map(([key, item]) => {
          return `
            <article class="criterion-card">
              <div class="history-card__head">
                <strong>${item.label}</strong>
                <span class="badge">${Number(breakdown[key] || 0).toFixed(1)}</span>
              </div>
              <p class="criterion-card__meta">${item.note}</p>
              <p>${escapeHtml(criterionAnalysis[key] || "这一项还需要在更多录音里持续观察。")}</p>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function buildAiSpeakingArchiveEntry(prompt, localReview, aiPayload) {
  const review = aiPayload.review;
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    part: prompt.part,
    promptId: prompt.id,
    promptTitle: prompt.title,
    entryType: "single",
    overallBand: review.overall_band,
    bandBreakdown: review.band_breakdown,
    criterionAnalysis: review.criterion_analysis || {},
    primaryIssue: review.key_issues[0] || review.summary,
    summary: review.summary,
    strengths: review.strengths || [],
    keyIssues: review.key_issues || [],
    improvementActions: review.improvement_actions || [],
    corrections: review.corrections || [],
    recommendedMaterials: review.recommended_materials || [],
    grammarPatterns: review.grammar_patterns || [],
    followUpQuestions: review.follow_up_questions || [],
    partMaterialPack: review.part_material_pack || {
      topic_angles: [],
      reusable_phrases: [],
      content_hooks: [],
    },
    transcriptAnalysis: review.transcript_analysis || {
      summary: "",
      delivery_notes: [],
      language_notes: [],
      highlighted_snippets: [],
      next_focus: [],
    },
    transcript: aiPayload.transcript || "",
    localMetrics: {
      durationSeconds: localReview.audioMetrics.durationSeconds,
      activeRatio: localReview.audioMetrics.activeRatio,
      longPauses: localReview.audioMetrics.longPauses,
      longestPause: localReview.audioMetrics.longestPause,
    },
    coverageParts: [prompt.part],
  };
}

function saveAiSpeakingArchive(prompt, localReview, aiPayload) {
  const archiveEntry = buildAiSpeakingArchiveEntry(prompt, localReview, aiPayload);
  state.speakingArchive = [archiveEntry, ...getSpeakingArchive()].slice(0, 18);
  state.speakingHistory = [
    {
      timestamp: archiveEntry.timestamp,
      part: archiveEntry.part,
      promptTitle: archiveEntry.promptTitle,
      primaryIssue: archiveEntry.primaryIssue,
      materials: archiveEntry.recommendedMaterials.slice(0, 3).map((item) => item.content),
    },
    ...state.speakingHistory.filter((item) => item.timestamp !== archiveEntry.timestamp),
  ].slice(0, 6);
  saveState();
}

function buildSpeakingMockPartEntry(prompt, localReview, aiPayload) {
  const review = aiPayload.review;
  return {
    part: prompt.part,
    promptId: prompt.id,
    promptTitle: prompt.title,
    overallBand: review.overall_band,
    bandBreakdown: review.band_breakdown,
    criterionAnalysis: review.criterion_analysis || {},
    primaryIssue: review.key_issues[0] || review.summary,
    summary: review.summary,
    strengths: review.strengths || [],
    keyIssues: review.key_issues || [],
    improvementActions: review.improvement_actions || [],
    recommendedMaterials: review.recommended_materials || [],
    grammarPatterns: review.grammar_patterns || [],
    followUpQuestions: review.follow_up_questions || [],
    partMaterialPack: review.part_material_pack || {
      topic_angles: [],
      reusable_phrases: [],
      content_hooks: [],
    },
    transcript: aiPayload.transcript || "",
    transcriptAnalysis: review.transcript_analysis || {
      summary: "",
      delivery_notes: [],
      language_notes: [],
      highlighted_snippets: [],
      next_focus: [],
    },
    transcriptMetrics: aiPayload.transcript
      ? analyseTranscript(aiPayload.transcript, localReview.audioMetrics.durationSeconds, prompt)
      : null,
    localMetrics: {
      durationSeconds: localReview.audioMetrics.durationSeconds,
      activeRatio: localReview.audioMetrics.activeRatio,
      longPauses: localReview.audioMetrics.longPauses,
      longestPause: localReview.audioMetrics.longestPause,
      speechBursts: localReview.audioMetrics.speechBursts,
    },
  };
}

function buildAiSpeakingMockArchiveEntry(summaryPayload) {
  const review = summaryPayload.review;
  const parts = SPEAKING_PART_ORDER.map((part) => ui.speakingMockSession.responses[part]).filter(Boolean);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    entryType: "full_mock",
    promptTitle: "完整口语模考",
    overallBand: review.overall_band,
    bandBreakdown: review.band_breakdown,
    criterionAnalysis: review.criterion_analysis || {},
    primaryIssue: review.key_issues[0] || review.summary,
    summary: review.summary,
    strengths: review.strengths || [],
    keyIssues: review.key_issues || [],
    improvementActions: review.improvement_actions || [],
    recommendedMaterials: review.recommended_materials || [],
    grammarPatterns: review.grammar_patterns || [],
    partReports: review.part_reports || [],
    transcriptOverview: review.transcript_overview || {
      fluency_pattern: "",
      vocabulary_pattern: "",
      grammar_pattern: "",
      pronunciation_pattern: "",
    },
    parts,
    coverageParts: [...SPEAKING_PART_ORDER],
  };
}

function saveAiSpeakingMockArchive(summaryPayload) {
  const archiveEntry = buildAiSpeakingMockArchiveEntry(summaryPayload);
  state.speakingMockArchive = [archiveEntry, ...getSpeakingMockArchive()].slice(0, 12);
  state.speakingHistory = [
    {
      timestamp: archiveEntry.timestamp,
      part: "mock",
      promptTitle: archiveEntry.promptTitle,
      primaryIssue: archiveEntry.primaryIssue,
      materials: archiveEntry.recommendedMaterials.slice(0, 3).map((item) => item.content),
    },
    ...state.speakingHistory.filter((item) => item.timestamp !== archiveEntry.timestamp),
  ].slice(0, 6);
  saveState();
  return archiveEntry;
}

function renderSpeakingAnalysis(prompt, audioMetrics, transcriptMetrics, analysis) {
  const durationTarget = `${formatSeconds(prompt.targetDuration.min)} - ${formatSeconds(prompt.targetDuration.max)}`;
  const thirdMetricLabel = transcriptMetrics ? "估算语速" : "发声占比";
  const thirdMetricValue = transcriptMetrics ? `${transcriptMetrics.speechRate || 0} WPM` : `${Math.round(audioMetrics.activeRatio * 100)}%`;
  const thirdMetricNote = transcriptMetrics ? "结合录音时长与转写估算" : "越高通常说明空白段越少";
  const fourthMetricLabel = transcriptMetrics ? "素材命中" : "转写分析";
  const fourthMetricValue = transcriptMetrics ? `${transcriptMetrics.materialHits} 个` : "未提供";
  const fourthMetricNote = transcriptMetrics ? "命中的是当前题目建议素材" : "补转写后可分析 filler 和词汇层次";

  elements.speakingResult.innerHTML = `
    <div class="analysis-shell">
      <div class="analysis-grid">
        <article class="analysis-card">
          <span>录音时长</span>
          <strong>${formatSeconds(audioMetrics.durationSeconds)}</strong>
          <p>建议范围 ${durationTarget}</p>
        </article>
        <article class="analysis-card">
          <span>长停顿</span>
          <strong>${audioMetrics.longPauses} 次</strong>
          <p>最长停顿约 ${audioMetrics.longestPause.toFixed(1)} 秒</p>
        </article>
        <article class="analysis-card">
          <span>${thirdMetricLabel}</span>
          <strong>${thirdMetricValue}</strong>
          <p>${thirdMetricNote}</p>
        </article>
        <article class="analysis-card">
          <span>${fourthMetricLabel}</span>
          <strong>${fourthMetricValue}</strong>
          <p>${fourthMetricNote}</p>
        </article>
      </div>
      <div class="feedback-grid">
        <article class="feedback-card">
          <h3>主要问题</h3>
          <p>${analysis.issues.join(" ")}</p>
        </article>
        <article class="feedback-card">
          <h3>这次亮点</h3>
          <p>${analysis.strengths.join(" ")}</p>
        </article>
        <article class="feedback-card">
          <h3>下一轮怎么练</h3>
          <p>${analysis.nextSteps.join(" ")}</p>
        </article>
      </div>
      <div class="material-card">
        <h3>推荐积累素材</h3>
        <p>优先把这些表达和展开角度练熟，下次同题型录音时尽量主动用上。</p>
        <div class="material-strip">
          ${analysis.materials.map((material) => `<span class="tag">${material}</span>`).join("")}
        </div>
        <div class="prompt-list">
          ${prompt.angles.map((angle) => `<div class="prompt-item">${angle}</div>`).join("")}
        </div>
      </div>
    </div>
  `;
}

async function buildLocalSpeakingReview(file, prompt) {
  const buffer = await decodeAudio(file);
  const audioMetrics = analyseAudioBuffer(buffer);
  const transcript = elements.speakingTranscript.value.trim();
  const transcriptMetrics = transcript ? analyseTranscript(transcript, audioMetrics.durationSeconds, prompt) : null;
  const analysis = buildSpeakingAnalysis(prompt, audioMetrics, transcriptMetrics);
  return {
    audioMetrics,
    transcript,
    transcriptMetrics,
    analysis,
  };
}

function renderSpeakingLoading(title, message) {
  elements.speakingResult.innerHTML = `
    <div class="study-empty">
      <div>
        <h3>${title}</h3>
        <p>${message}</p>
      </div>
    </div>
  `;
}

function renderAiSpeakingReview(prompt, localReview, aiPayload) {
  const review = aiPayload.review;
  const transcript = aiPayload.transcript || "";
  const grammarPatterns = review.grammar_patterns || [];
  const materialPack = review.part_material_pack || {
    topic_angles: [],
    reusable_phrases: [],
    content_hooks: [],
  };
  const followUps = review.follow_up_questions || [];
  const criterionAnalysis = review.criterion_analysis || {};
  const transcriptAnalysis = review.transcript_analysis || {
    summary: "",
    delivery_notes: [],
    language_notes: [],
    highlighted_snippets: [],
    next_focus: [],
  };
  const transcriptMetrics = transcript ? analyseTranscript(transcript, localReview.audioMetrics.durationSeconds, prompt) : null;

  return `
    <div class="analysis-shell ai-review-shell">
      <div class="badge-row">
        <span class="badge badge--success">AI 深度批改</span>
        <span class="badge">整体预估 ${review.overall_band.toFixed(1)}</span>
        <span class="badge">转写 ${aiPayload.transcribe_model}</span>
        <span class="badge">评估 ${aiPayload.review_model}</span>
      </div>
      <div class="analysis-grid analysis-grid--five">
        <article class="analysis-card">
          <span>总分预估</span>
          <strong>${review.overall_band.toFixed(1)}</strong>
          <p>按 IELTS Speaking 四项维度综合估算</p>
        </article>
        <article class="analysis-card">
          <span>流利与连贯</span>
          <strong>${review.band_breakdown.fluency_coherence.toFixed(1)}</strong>
          <p>节奏、展开、停顿控制</p>
        </article>
        <article class="analysis-card">
          <span>词汇资源</span>
          <strong>${review.band_breakdown.lexical_resource.toFixed(1)}</strong>
          <p>词汇自然度与表达层次</p>
        </article>
        <article class="analysis-card">
          <span>语法范围</span>
          <strong>${review.band_breakdown.grammatical_range_accuracy.toFixed(1)}</strong>
          <p>句式变化与准确度</p>
        </article>
        <article class="analysis-card">
          <span>发音表现</span>
          <strong>${review.band_breakdown.pronunciation.toFixed(1)}</strong>
          <p>基于录音转写与清晰度做的综合估计</p>
        </article>
      </div>
      <div class="material-card">
        <h3>雅思口语四项评分分析</h3>
        <p>这里不只是给分数，还会把四个官方评分板块拆开说明你现在的主要问题和提升方向。</p>
        ${renderSpeakingCriterionPanels(review.band_breakdown, criterionAnalysis)}
      </div>
      <div class="feedback-grid">
        <article class="feedback-card">
          <h3>AI 总评</h3>
          <p>${escapeHtml(review.summary)}</p>
        </article>
        <article class="feedback-card">
          <h3>关键问题</h3>
          <p>${review.key_issues.map((item) => escapeHtml(item)).join(" ")}</p>
        </article>
        <article class="feedback-card">
          <h3>下一轮重点</h3>
          <p>${review.improvement_actions.map((item) => escapeHtml(item)).join(" ")}</p>
        </article>
      </div>
      <div class="material-card">
        <h3>AI 转写分析</h3>
        <div class="analysis-grid">
          <article class="analysis-card">
            <span>转写词数</span>
            <strong>${transcriptMetrics?.wordCount || 0}</strong>
            <p>基于 AI 转写文本估算</p>
          </article>
          <article class="analysis-card">
            <span>filler 次数</span>
            <strong>${transcriptMetrics?.fillerCount || 0}</strong>
            <p>um / like / you know 等缓冲词</p>
          </article>
          <article class="analysis-card">
            <span>连接词信号</span>
            <strong>${transcriptMetrics?.connectorCount || 0}</strong>
            <p>because / for example / however 等</p>
          </article>
          <article class="analysis-card">
            <span>素材命中</span>
            <strong>${transcriptMetrics?.materialHits || 0}</strong>
            <p>命中当前题型建议素材的数量</p>
          </article>
        </div>
        <div class="feedback-grid">
          <article class="feedback-card">
            <h3>转写总览</h3>
            <p>${escapeHtml(transcriptAnalysis.summary || "这次已经拿到 AI 转写，可以继续从用词、展开和停顿去拆问题。")}</p>
          </article>
          <article class="feedback-card">
            <h3>表达与节奏</h3>
            <p>${(transcriptAnalysis.delivery_notes || []).map((item) => escapeHtml(item)).join(" ") || "当前没有额外的节奏备注。"}</p>
          </article>
          <article class="feedback-card">
            <h3>语言使用</h3>
            <p>${(transcriptAnalysis.language_notes || []).map((item) => escapeHtml(item)).join(" ") || "当前没有额外的语言备注。"}</p>
          </article>
        </div>
        ${
          (transcriptAnalysis.highlighted_snippets || []).length
            ? `
              <div class="prompt-list">
                ${transcriptAnalysis.highlighted_snippets
                  .map(
                    (item) => `
                      <div class="prompt-item">
                        <strong>${escapeHtml(item.snippet)}</strong>
                        <p>${escapeHtml(item.comment)}</p>
                      </div>
                    `,
                  )
                  .join("")}
              </div>
            `
            : ""
        }
        <div class="prompt-list">
          <div class="prompt-item">
            <strong>AI 转写文本</strong>
            <p>${escapeHtml(transcript || "本次未返回转写文本。")}</p>
          </div>
          ${(transcriptAnalysis.next_focus || [])
            .map((item) => `<div class="prompt-item">${escapeHtml(item)}</div>`)
            .join("")}
        </div>
      </div>
      <div class="feedback-grid">
        <article class="feedback-card">
          <h3>高频语法问题</h3>
          <p>${grammarPatterns.length ? grammarPatterns.map((item) => `${escapeHtml(item.label)}：${escapeHtml(item.advice)}`).join(" ") : "这次没有识别出特别突出的重复语法错误。"} </p>
        </article>
        <article class="feedback-card">
          <h3>按题型追问建议</h3>
          <p>${followUps.length ? followUps.map((item) => escapeHtml(item)).join(" ") : "下次可以围绕原因、例子、对比和结果继续追问自己。"} </p>
        </article>
        <article class="feedback-card">
          <h3>题型素材包</h3>
          <p>${materialPack.topic_angles?.length ? materialPack.topic_angles.map((item) => escapeHtml(item)).join(" ") : "这次没有返回额外素材角度。"} </p>
        </article>
      </div>
      <div class="correction-list">
        ${review.corrections
          .map(
            (correction) => `
              <article class="correction-item">
                <strong>原表达</strong>
                <p>${escapeHtml(correction.source)}</p>
                <strong>更自然的说法</strong>
                <p>${escapeHtml(correction.better_version)}</p>
                <p>${escapeHtml(correction.why)}</p>
              </article>
            `,
          )
          .join("")}
      </div>
      ${
        grammarPatterns.length
          ? `
            <div class="correction-list">
              ${grammarPatterns
                .map(
                  (pattern) => `
                    <article class="correction-item">
                      <strong>${escapeHtml(pattern.label)}</strong>
                      <p>${escapeHtml(pattern.symptom)}</p>
                      <p>${escapeHtml(pattern.advice)}</p>
                      ${pattern.evidence ? `<p>${escapeHtml(pattern.evidence)}</p>` : ""}
                    </article>
                  `,
                )
                .join("")}
            </div>
          `
          : ""
      }
      <div class="material-card">
        <h3>推荐积累素材</h3>
        <div class="prompt-list">
          ${review.recommended_materials
            .map(
              (material) => `
                <div class="prompt-item">
                  <strong>${escapeHtml(material.content)}</strong>
                  <p>${escapeHtml(material.reason)}</p>
                </div>
              `,
            )
            .join("")}
        </div>
      </div>
      <div class="material-card">
        <h3>Part 定向素材包</h3>
        <div class="prompt-list">
          ${(materialPack.reusable_phrases || [])
            .map((item) => `<div class="prompt-item">${escapeHtml(item)}</div>`)
            .join("")}
          ${(materialPack.content_hooks || [])
            .map((item) => `<div class="prompt-item">${escapeHtml(item)}</div>`)
            .join("")}
        </div>
      </div>
      <div class="material-card">
        <h3>下轮可直接练的追问</h3>
        <div class="prompt-list">
          ${followUps
            .map((item) => `<div class="prompt-item">${escapeHtml(item)}</div>`)
            .join("")}
        </div>
      </div>
    </div>
  `;
}

function renderSpeakingMockTransition(partEntry, nextPart) {
  return `
    <div class="feedback feedback--success">
      <strong>${SPEAKING_PART_LABELS[partEntry.part]} 已提交</strong>
      <p>
        这一段当前预估 ${Number(partEntry.overallBand || 0).toFixed(1)} 分，最需要先修的是“${escapeHtml(partEntry.primaryIssue)}”。
        系统已经自动切到 ${SPEAKING_PART_LABELS[nextPart]}，现在上传下一段录音即可继续整轮模考。
      </p>
    </div>
  `;
}

function renderSpeakingMockSummary(summaryPayload) {
  const review = summaryPayload.review;
  const transcriptOverview = review.transcript_overview || {
    fluency_pattern: "",
    vocabulary_pattern: "",
    grammar_pattern: "",
    pronunciation_pattern: "",
  };
  const partReports = review.part_reports || [];
  const grammarPatterns = review.grammar_patterns || [];

  return `
    <div class="analysis-shell ai-review-shell mock-summary-shell">
      <div class="badge-row">
        <span class="badge badge--success">完整模考总评</span>
        <span class="badge">覆盖 Part 1 / 2 / 3</span>
        <span class="badge">整体预估 ${Number(review.overall_band || 0).toFixed(1)}</span>
      </div>
      <div class="analysis-grid analysis-grid--five">
        <article class="analysis-card">
          <span>总分预估</span>
          <strong>${Number(review.overall_band || 0).toFixed(1)}</strong>
          <p>按整轮口语模考综合估算</p>
        </article>
        <article class="analysis-card">
          <span>流利与连贯</span>
          <strong>${Number(review.band_breakdown?.fluency_coherence || 0).toFixed(1)}</strong>
          <p>整轮的节奏、展开和连贯度</p>
        </article>
        <article class="analysis-card">
          <span>词汇资源</span>
          <strong>${Number(review.band_breakdown?.lexical_resource || 0).toFixed(1)}</strong>
          <p>词汇灵活度与素材质量</p>
        </article>
        <article class="analysis-card">
          <span>语法范围</span>
          <strong>${Number(review.band_breakdown?.grammatical_range_accuracy || 0).toFixed(1)}</strong>
          <p>句式变化与准确率</p>
        </article>
        <article class="analysis-card">
          <span>发音表现</span>
          <strong>${Number(review.band_breakdown?.pronunciation || 0).toFixed(1)}</strong>
          <p>整体可理解度与稳定性</p>
        </article>
      </div>
      <div class="material-card">
        <h3>雅思口语四项评分总览</h3>
        ${renderSpeakingCriterionPanels(review.band_breakdown || {}, review.criterion_analysis || {})}
      </div>
      <div class="feedback-grid">
        <article class="feedback-card">
          <h3>整轮总评</h3>
          <p>${escapeHtml(review.summary || "")}</p>
        </article>
        <article class="feedback-card">
          <h3>本轮关键问题</h3>
          <p>${(review.key_issues || []).map((item) => escapeHtml(item)).join(" ")}</p>
        </article>
        <article class="feedback-card">
          <h3>下轮训练重点</h3>
          <p>${(review.improvement_actions || []).map((item) => escapeHtml(item)).join(" ")}</p>
        </article>
      </div>
      <div class="material-card">
        <h3>整轮转写趋势分析</h3>
        <div class="prompt-list">
          <div class="prompt-item">
            <strong>流利与连贯</strong>
            <p>${escapeHtml(transcriptOverview.fluency_pattern || "当前没有额外备注。")}</p>
          </div>
          <div class="prompt-item">
            <strong>词汇资源</strong>
            <p>${escapeHtml(transcriptOverview.vocabulary_pattern || "当前没有额外备注。")}</p>
          </div>
          <div class="prompt-item">
            <strong>语法范围</strong>
            <p>${escapeHtml(transcriptOverview.grammar_pattern || "当前没有额外备注。")}</p>
          </div>
          <div class="prompt-item">
            <strong>发音表现</strong>
            <p>${escapeHtml(transcriptOverview.pronunciation_pattern || "当前没有额外备注。")}</p>
          </div>
        </div>
      </div>
      <div class="correction-list">
        ${partReports
          .map(
            (item) => `
              <article class="correction-item">
                <strong>${escapeHtml(SPEAKING_PART_LABELS[item.part] || item.part)} · ${escapeHtml(item.prompt_title)}</strong>
                <p>该段预估 ${Number(item.estimated_band || 0).toFixed(1)} 分</p>
                <p>${escapeHtml(item.main_issue)}</p>
                <p>${escapeHtml(item.next_focus)}</p>
              </article>
            `,
          )
          .join("")}
      </div>
      ${
        grammarPatterns.length
          ? `
            <div class="correction-list">
              ${grammarPatterns
                .map(
                  (pattern) => `
                    <article class="correction-item">
                      <strong>${escapeHtml(pattern.label)}</strong>
                      <p>${escapeHtml(pattern.symptom)}</p>
                      <p>${escapeHtml(pattern.advice)}</p>
                      ${pattern.evidence ? `<p>${escapeHtml(pattern.evidence)}</p>` : ""}
                    </article>
                  `,
                )
                .join("")}
            </div>
          `
          : ""
      }
      <div class="material-card">
        <h3>整轮最值得补的素材</h3>
        <div class="prompt-list">
          ${(review.recommended_materials || [])
            .map(
              (item) => `
                <div class="prompt-item">
                  <strong>${escapeHtml(item.content)}</strong>
                  <p>${escapeHtml(item.reason)}</p>
                </div>
              `,
            )
            .join("")}
        </div>
      </div>
    </div>
  `;
}

async function requestAiSpeakingReview(file, prompt, localReview) {
  const formData = new FormData();
  formData.append("audio", file, file.name);
  formData.append("part", prompt.part);
  formData.append("prompt_payload", JSON.stringify(prompt));
  formData.append("transcript_hint", localReview.transcript || "");
  formData.append(
    "local_metrics",
    JSON.stringify({
      durationSeconds: Number(localReview.audioMetrics.durationSeconds.toFixed(2)),
      activeRatio: Number(localReview.audioMetrics.activeRatio.toFixed(3)),
      longPauses: localReview.audioMetrics.longPauses,
      longestPause: Number(localReview.audioMetrics.longestPause.toFixed(2)),
      speechBursts: localReview.audioMetrics.speechBursts,
    }),
  );

  const response = await fetch(getApiUrl("/api/ai/speaking-review"), {
    method: "POST",
    headers: createAiRequestHeaders(),
    body: formData,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "AI 批改服务暂时不可用。");
  }
  return payload;
}

async function requestAiSpeakingMockSummary(parts) {
  const response = await fetch(getApiUrl("/api/ai/speaking-mock-summary"), {
    method: "POST",
    headers: createAiRequestHeaders({
      "Content-Type": "application/json",
      Accept: "application/json",
    }),
    body: JSON.stringify({ parts }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "整轮模考总评暂时不可用。");
  }
  return payload;
}

async function handleSpeakingLocalAnalysis() {
  const file = elements.speakingAudio.files?.[0];
  const prompt = getSelectedSpeakingPrompt();
  if (isSpeakingFullMockMode() && ui.speakingMockSession.summary) {
    renderSpeakingMessage("warning", "这一轮模考已经完成", "如果你想开始下一轮全真模考，先点“重新开始模考”，系统会从 Part 1 重新计时。");
    return;
  }
  if (!file) {
    renderSpeakingMessage("warning", "还没有上传录音", "先选择一个音频文件，再点击分析。");
    return;
  }

  renderSpeakingLoading("正在做本地分析", "我在计算时长、停顿、发声占比，并结合题型给出节奏反馈，请稍等一下。");

  try {
    const localReview = await buildLocalSpeakingReview(file, prompt);
    saveSpeakingSummary(prompt, localReview.analysis);
    renderSpeakingAnalysis(prompt, localReview.audioMetrics, localReview.transcriptMetrics, localReview.analysis);
    renderCoachTips();
    announce("本地口语分析已生成");
  } catch (error) {
    renderSpeakingMessage("danger", "录音分析失败", error.message || "浏览器暂时无法读取这段音频，请换一个常见音频格式后再试。");
  }
}

async function handleSpeakingAiAnalysis() {
  const file = elements.speakingAudio.files?.[0];
  const prompt = getSelectedSpeakingPrompt();
  if (isSpeakingFullMockMode() && ui.speakingMockSession.summary) {
    renderSpeakingMessage("warning", "这一轮模考已经完成", "请先点“重新开始模考”，再从 Part 1 继续新的一轮三段仿真训练。");
    return;
  }
  if (!file) {
    renderSpeakingMessage("warning", "还没有上传录音", "先选择一个音频文件，再点击 AI 深度批改。");
    return;
  }

  if (!ui.ai.available) {
    renderSpeakingMessage(
      "warning",
      hasAiApiSupport() ? "AI 代理还没有连接上" : "AI 后端还没有配置",
      `${getUnavailableAiHint()} 如果你现在只想看节奏问题，可以先点“本地分析”。`,
    );
    return;
  }

  renderSpeakingLoading("正在进行 AI 深度批改", "我会先做本地节奏分析，再把音频发给当前 AI 后端做转写和口语评估，这会比本地分析多等一会儿。");

  let localReview = null;
  try {
    localReview = await buildLocalSpeakingReview(file, prompt);
    renderSpeakingAnalysis(prompt, localReview.audioMetrics, localReview.transcriptMetrics, localReview.analysis);

    const aiPayload = await requestAiSpeakingReview(file, prompt, localReview);
    elements.speakingResult.insertAdjacentHTML("beforeend", renderAiSpeakingReview(prompt, localReview, aiPayload));

    if (isSpeakingFullMockMode()) {
      const partEntry = buildSpeakingMockPartEntry(prompt, localReview, aiPayload);
      if (!ui.speakingMockSession.startedAt) {
        ui.speakingMockSession.startedAt = Date.now();
      }
      ui.speakingMockSession.responses[prompt.part] = partEntry;

      const nextPart = getNextSpeakingPart(prompt.part);
      if (nextPart) {
        ui.speakingMockSession.activePart = nextPart;
        elements.speakingResult.insertAdjacentHTML("beforeend", renderSpeakingMockTransition(partEntry, nextPart));
        clearSpeakingInput();
        syncSpeakingControlsForPart(nextPart);
        renderCoachTips();
        announce(`${SPEAKING_PART_LABELS[prompt.part]} 已完成，已切换到 ${SPEAKING_PART_LABELS[nextPart]}`);
        return;
      }

      try {
        const summaryPayload = await requestAiSpeakingMockSummary(
          SPEAKING_PART_ORDER.map((part) => ui.speakingMockSession.responses[part]).filter(Boolean),
        );
        const summaryEntry = saveAiSpeakingMockArchive(summaryPayload);
        ui.speakingMockSession.summary = summaryEntry;
        clearSpeakingInput();
        renderSpeakingSessionShell();
        updateSpeakingActionButtons();
        elements.speakingResult.innerHTML = renderSpeakingMockSummary(summaryPayload);
        renderCoachTips();
        renderSpeakingProgress();
        announce("完整口语模考总评已生成");
        return;
      } catch (summaryError) {
        elements.speakingResult.insertAdjacentHTML(
          "beforeend",
          `
            <div class="feedback feedback--danger">
              <strong>整轮总评暂时失败</strong>
              <p>${summaryError.message || "Part 3 已完成，但整轮模考汇总还没有成功生成。你可以稍后重新开始一轮，或先根据当前分段结果继续复盘。"}</p>
            </div>
          `,
        );
        renderSpeakingSessionShell();
        updateSpeakingActionButtons();
        return;
      }
    }

    saveAiSpeakingArchive(prompt, localReview, aiPayload);
    renderCoachTips();
    renderSpeakingProgress();
    announce("AI 口语批改已生成");
  } catch (error) {
    if (localReview) {
      elements.speakingResult.insertAdjacentHTML(
        "beforeend",
        `
          <div class="feedback feedback--danger">
            <strong>AI 批改失败</strong>
            <p>${error.message || "AI 服务暂时无法处理这段音频。当前已保留本地节奏分析结果。"}</p>
          </div>
        `,
      );
    } else {
      renderSpeakingMessage(
        "danger",
        "AI 批改失败",
        error.message || "AI 服务暂时无法处理这段音频。你可以先使用本地分析，或者检查代理服务是否已经启动。",
      );
    }
  }
}

function initializeSpeakingWorkflow() {
  ui.speakingMode = getSpeakingMode();
  ui.speakingMockSession = createEmptySpeakingMockSession();
  SPEAKING_PART_ORDER.forEach((part) => {
    if (!ui.speakingPromptSelections[part]) {
      ui.speakingPromptSelections[part] = speakingMockBank[part]?.[0]?.id || "";
    }
  });

  if (isSpeakingFullMockMode()) {
    resetSpeakingMockSession({ keepResult: true });
    return;
  }

  populateSpeakingPrompts();
  renderSpeakingSessionShell();
  updateSpeakingActionButtons();
}

function bindEvents() {
  document.querySelectorAll("[data-scroll-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.querySelector(`#${button.dataset.scrollTarget}`);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  elements.studyStart.addEventListener("click", startStudySession);
  elements.spellingStart.addEventListener("click", startSpellingSession);
  elements.bankCategory.addEventListener("change", renderWordBank);
  elements.bankKind.addEventListener("change", renderWordBank);
  elements.bankSearch.addEventListener("input", renderWordBank);
  elements.dailyLimit.addEventListener("change", updateSettings);
  elements.reviewScheme.addEventListener("change", updateSettings);
  elements.preferredFocus.addEventListener("change", updateSettings);
  elements.preferredAccent.addEventListener("change", updateSettings);
  if (elements.cloudAuthForm) {
    elements.cloudAuthForm.addEventListener("submit", (event) => {
      event.preventDefault();
      handleCloudAuth("login");
    });
  }
  if (elements.cloudRegister) {
    elements.cloudRegister.addEventListener("click", () => {
      handleCloudAuth("register");
    });
  }
  if (elements.cloudSyncNow) {
    elements.cloudSyncNow.addEventListener("click", () => {
      syncCloudProgressOnStartup({
        announceMessage: "云端进度已经同步完成。",
      });
    });
  }
  if (elements.cloudLogout) {
    elements.cloudLogout.addEventListener("click", handleCloudLogout);
  }
  elements.speakingPart.addEventListener("change", populateSpeakingPrompts);
  if (elements.speakingMode) {
    elements.speakingMode.addEventListener("change", () => {
      ui.speakingMode = getSpeakingMode();
      ui.speakingMockSession = createEmptySpeakingMockSession();
      clearSpeakingInput();
      if (isSpeakingFullMockMode()) {
        resetSpeakingMockSession({ announceMessage: "已切换到全真三段模考模式" });
      } else {
        populateSpeakingPrompts();
        renderSpeakingSessionShell();
        updateSpeakingActionButtons();
        renderSpeakingPlaceholder();
        announce("已切换到单段复盘模式");
      }
    });
  }
  elements.speakingPrompt.addEventListener("change", () => {
    const part = elements.speakingPart.value;
    ui.speakingPromptSelections[part] = elements.speakingPrompt.value;
    renderSpeakingPromptCard();
    renderSpeakingSessionShell();
  });
  if (elements.writingTask) {
    elements.writingTask.addEventListener("change", () => {
      state.writingDraft.task = elements.writingTask.value;
      state.writingDraft.promptId = (writingPromptBank[elements.writingTask.value] || [])[0]?.id || "";
      populateWritingPrompts();
      renderWritingPlaceholder();
      saveState();
    });
  }
  if (elements.writingPrompt) {
    elements.writingPrompt.addEventListener("change", () => {
      state.writingDraft.promptId = elements.writingPrompt.value;
      renderWritingPromptCard();
      renderWritingPlaceholder();
      saveState();
    });
  }
  if (elements.writingTargetBand) {
    elements.writingTargetBand.addEventListener("change", () => {
      state.settings.writingTargetBand = elements.writingTargetBand.value;
      saveState();
    });
  }
  if (elements.writingCustomPrompt) {
    elements.writingCustomPrompt.addEventListener("input", () => {
      state.writingDraft.customPrompt = elements.writingCustomPrompt.value;
      saveState();
    });
  }
  if (elements.writingEssay) {
    elements.writingEssay.addEventListener("input", () => {
      state.writingDraft.essay = elements.writingEssay.value;
      updateWritingCounts();
      saveState();
    });
  }
  if (elements.writingAnalyzeLocal) {
    elements.writingAnalyzeLocal.addEventListener("click", handleWritingLocalAnalysis);
  }
  if (elements.writingAnalyzeAi) {
    elements.writingAnalyzeAi.addEventListener("click", handleWritingAiAnalysis);
  }
  elements.speakingAudio.addEventListener("change", handleSpeakingAudioChange);
  elements.speakingAnalyzeLocal.addEventListener("click", handleSpeakingLocalAnalysis);
  elements.speakingAnalyzeAi.addEventListener("click", handleSpeakingAiAnalysis);
  if (elements.speakingResetMock) {
    elements.speakingResetMock.addEventListener("click", () => {
      if (isSpeakingFullMockMode()) {
        resetSpeakingMockSession({ announceMessage: "已重新开始新一轮口语模考" });
        return;
      }
      clearSpeakingInput();
      renderSpeakingPlaceholder();
      announce("已清空当前录音");
    });
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) {
      return;
    }

    const action = target.dataset.action;

    if (action === "quick-study") {
      elements.studySource.value = target.dataset.source;
      elements.studyCategory.value = target.dataset.category;
      elements.studyKind.value = target.dataset.kind;
      startStudySession();
      document.querySelector("#study-arena")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (action === "quick-single") {
      quickAddSingleItem(target.dataset.id);
      return;
    }

    if (action === "reveal-study") {
      ui.studyReveal = true;
      renderStudyCard();
      return;
    }

    if (action === "rate-study") {
      handleStudyRating(target.dataset.rating);
      return;
    }

    if (action === "speak-item") {
      handleSpeakItem(target.dataset.id, target.dataset.mode);
      return;
    }

    if (action === "reveal-spelling") {
      const item = getItemById(ui.spellingQueue[ui.spellingIndex]);
      if (!item) {
        return;
      }
      ui.spellingFeedback = {
        type: "warning",
        title: "答案已展开",
        message: `标准答案是 “${item.term}”。建议听一遍发音，再自己拼写一次。`,
        revealed: true,
      };
      renderSpellingCard();
      return;
    }

    if (action === "next-spelling") {
      moveToNextSpellingItem();
    }
  });

  document.addEventListener("submit", (event) => {
    if (event.target.id !== "spelling-form") {
      return;
    }
    event.preventDefault();
    const input = document.querySelector("#spelling-input");
    if (!input) {
      return;
    }
    const answer = input.value.trim();
    if (!answer) {
      ui.spellingFeedback = {
        type: "warning",
        title: "先写出你的答案",
        message: "空白提交不会记录练习结果，先试着自己拼一次。",
      };
      renderSpellingCard();
      return;
    }
    handleSpellingSubmit(answer);
  });
}

async function initialize() {
  renderCloudSyncUi();
  await syncSharedProgressOnStartup();
  await syncCloudProgressOnStartup();
  syncSettingsUI();
  initVoices();
  setPronunciationStatus("待命。点发音后，这里会提示是在线播放、系统朗读，还是浏览器/网络拦截。", "info");
  updateAiStatusUI();
  renderCurveStrip();
  initializeSpeakingWorkflow();
  if (elements.writingTask) {
    populateWritingPrompts();
  }
  renderStaticPanels();
  startStudySession();
  startSpellingSession();
  renderSpeakingPlaceholder();
  if (elements.writingResult) {
    renderWritingPlaceholder();
  }
  if (elements.writingEssay) {
    updateWritingCounts();
  }
  bindEvents();
  checkAiStatus();
}

initialize().catch(() => {
  // If shared sync or startup hydration fails, we still keep the local experience available.
});
