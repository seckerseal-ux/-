# IELTS 词汇冲刺舱

一个雅思备考网页，核心是分类背词，同时补上拼写训练、词块背诵、发音、基于遗忘曲线的复习，以及可选的 AI 口语批改。

## GitHub Pages 部署

这套前端现在可以直接部署到 GitHub Pages。

1. 把 `lexicon-sprint` 目录本身作为一个 GitHub 仓库根目录。
2. 推送后，在仓库 `Settings -> Pages` 里把 `Source` 设成 `GitHub Actions`。
3. 仓库里已经带了 [deploy-pages.yml](/Users/shyn/Documents/Playground/lexicon-sprint/.github/workflows/deploy-pages.yml)，后续 push 到 `main` 或 `master` 会自动发布。
4. GitHub Pages 版默认是纯静态站点：
   - 背词、拼写、复习、本地进度都能正常用
   - 发音会优先走浏览器可直接访问的在线 TTS
   - AI 批改和云端同步需要额外后端，不能直接跑在 GitHub Pages 上
5. 如果你后面给它单独配了 API 后端，可以在 [site-config.js](/Users/shyn/Documents/Playground/lexicon-sprint/site-config.js) 里填：

```js
window.__IELTS_LEXICON_CONFIG__ = {
  backendBaseUrl: "https://your-backend.example.com",
  aiApiBaseUrl: "https://your-api.example.com",
  cloudSyncBaseUrl: "https://your-cloud-sync.example.com",
  pronunciationApiBaseUrl: "https://your-pronunciation.example.com",
};
```

如果你用的是同一个独立后端域名，通常只填 `backendBaseUrl` 就够了，AI、云同步和发音会自动共用这一条地址。

## 怎么用

1. 当前新版离线页入口是 [lexicon-sprint/index.html](/Users/shyn/Documents/Playground/lexicon-sprint/index.html)。
2. 根目录的 [index.html](/Users/shyn/Documents/Playground/index.html) 是旧入口，不是这套最新版。
3. 如果要启用本地 AI 口语批改和本地代理共享进度，直接在当前项目目录启动 [server.py](/Users/shyn/Documents/Playground/lexicon-sprint/server.py)。

### 方式 A：直接用环境变量启动 OpenAI

```bash
cd /Users/shyn/Documents/Playground/lexicon-sprint
export AI_PROVIDER="openai"
export OPENAI_API_KEY="你的 OpenAI Key"
python3 server.py
```

### 方式 B：直接用环境变量启动 OpenRouter

```bash
cd /Users/shyn/Documents/Playground/lexicon-sprint
export AI_PROVIDER="openrouter"
export OPENROUTER_API_KEY="你的 OpenRouter Key"
export AI_TRANSCRIBE_MODEL="openrouter/auto"
export AI_REVIEW_MODEL="openrouter/auto"
export AI_WRITING_REVIEW_MODEL="openrouter/auto"
python3 server.py
```

### 方式 C：直接用环境变量启动 Gemini

```bash
cd /Users/shyn/Documents/Playground/lexicon-sprint
export AI_PROVIDER="gemini"
export GEMINI_API_KEY="你的 Gemini Key"
python3 server.py
```

如果你想让 Gemini 按“速度优先”自动回退，可以额外设：

```bash
export GEMINI_TRANSCRIBE_MODEL_PRIORITY="gemini-2.5-flash-lite,gemini-2.5-flash"
export GEMINI_REVIEW_MODEL_PRIORITY="gemini-2.5-flash-lite,gemini-2.5-flash"
export GEMINI_WRITING_MODEL_PRIORITY="gemini-2.5-flash-lite,gemini-2.5-flash"
```

### 方式 D：把配置写到 `.env`

可以在 [server.py](/Users/shyn/Documents/Playground/lexicon-sprint/server.py) 同目录新建 `.env`，例如：

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=你的OpenAIKey
```

或者：

```bash
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=你的OpenRouterKey
AI_TRANSCRIBE_MODEL=openrouter/auto
AI_REVIEW_MODEL=openrouter/auto
AI_WRITING_REVIEW_MODEL=openrouter/auto
```

或者：

```bash
AI_PROVIDER=gemini
GEMINI_API_KEY=你的GeminiKey
GEMINI_TRANSCRIBE_MODEL=gemini-2.5-flash-lite
GEMINI_REVIEW_MODEL=gemini-2.5-flash-lite
GEMINI_WRITING_REVIEW_MODEL=gemini-2.5-flash-lite
GEMINI_TRANSCRIBE_MODEL_PRIORITY=gemini-2.5-flash-lite,gemini-2.5-flash
GEMINI_REVIEW_MODEL_PRIORITY=gemini-2.5-flash-lite,gemini-2.5-flash
GEMINI_WRITING_MODEL_PRIORITY=gemini-2.5-flash-lite,gemini-2.5-flash
```

然后直接运行：

```bash
cd /Users/shyn/Documents/Playground/lexicon-sprint
python3 server.py
```

4. 浏览器里有两种打开方式：
   - 打开 `http://127.0.0.1:8000`
   - 或继续打开离线页 [lexicon-sprint/index.html](/Users/shyn/Documents/Playground/lexicon-sprint/index.html)
5. 只要本地代理开着，离线页和 `127.0.0.1:8000` 会优先同步同一份本地学习进度，不再因为切入口就像“清零”。
6. 如果你想跨浏览器、跨设备、跨入口同步：
   - 需要先给站点配置一个可用的云同步后端地址，也就是 [site-config.js](/Users/shyn/Documents/Playground/lexicon-sprint/site-config.js) 里的 `backendBaseUrl` 或 `cloudSyncBaseUrl`。
   - 配好以后，在右侧“云端同步”里注册或登录同一个同步账号。
   - 登录后，所有连到同一云同步接口的入口都会自动对比本地与云端的更新时间。
   - 系统会优先保留更新时间更近的一份进度，并继续把新改动自动推回云端。
7. 在右侧设置里调整：
   - 每日新词上限
   - 复习节奏
   - 新词优先分类
   - 发音偏好
8. 按顺序使用：
   - 分类词库
   - 普通背诵
   - 拼写训练
   - 口语模考辅助

## 已包含功能

- 听力、阅读、写作、口语四类词库
- 约 4400+ 条扩展词库，覆盖 IELTS / CET4 / CET6 / TOEFL 互通高频词
- 听力 / 写作 / 口语词块专区
- 浏览器内置发音播放
- 拼写训练与词块默写
- 每日新词上限设置
- 基于遗忘曲线的本地复习调度
- 本地学习进度统计和连续学习记录
- Speaking Part 1 / 2 / 3 题型化口语模考区
- 全真三段模考流程：提交完 Part 1 后自动进入 Part 2、Part 3
- 上传录音后的本地时长 / 停顿 / 节奏分析
- OpenAI / OpenRouter / Gemini 三后端 AI 口语批改
- AI 转写分析模块
- AI 四项评分分析：流利连贯、词汇资源、语法范围与准确度、发音表现
- AI 维度评分、问题定位、改写建议和推荐积累素材
- 高频语法问题自动汇总
- Part 1 / 2 / 3 定向素材包与追问建议
- 完整模考总评、分段诊断与口语提分轨迹页
- 可选转写文本辅助校对
- 离线页与本地代理页共享进度同步
- 可选云端同步账号：跨浏览器、跨设备、跨入口共享一份进度
- 浏览器本地缓存保底，即使云端暂时断开也不会立刻丢记录

## 口语模考说明

- 本地分析模式不需要 API Key，适合先看时长、停顿和节奏问题。
- AI 模式会把音频上传给当前配置的 AI 后端做英文转写，再结合题型和本地节奏指标生成口语反馈。
- 全真三段模式下，每一段都会先返回当前 Part 的 AI 转写和四项评分分析；第三段结束后会额外生成整轮口语总评。
- 出于安全考虑，API Key 只放在本地代理服务的环境变量中，不会暴露在浏览器里。
- 每次 AI 批改都会保留一份本地记录，用来汇总高频语法问题、分数趋势和最近的提分重点。
- 当前 AI 版已经能做“基于音频的转写 + 口语批改”，但还不是严格的音素级发音测评；如果后面你要更细的发音诊断，可以继续叠加更专门的语音评分链路。

## 可选模型配置

- 通用 provider：`AI_PROVIDER`
- 通用 Key：`AI_API_KEY`
- OpenAI Key：`OPENAI_API_KEY`
- OpenRouter Key：`OPENROUTER_API_KEY`
- Gemini Key：`GEMINI_API_KEY`
- 通用转写模型：`AI_TRANSCRIBE_MODEL`
- 通用口语批改模型：`AI_REVIEW_MODEL`
- 通用写作批改模型：`AI_WRITING_REVIEW_MODEL`
- OpenAI 兼容旧变量：`OPENAI_TRANSCRIBE_MODEL`、`OPENAI_REVIEW_MODEL`、`OPENAI_WRITING_REVIEW_MODEL`
- Gemini 专用变量：`GEMINI_TRANSCRIBE_MODEL`、`GEMINI_REVIEW_MODEL`、`GEMINI_WRITING_REVIEW_MODEL`
- Gemini 速度优先候选：`GEMINI_TRANSCRIBE_MODEL_PRIORITY`、`GEMINI_REVIEW_MODEL_PRIORITY`、`GEMINI_WRITING_MODEL_PRIORITY`

如果你不额外设置：

- `openai` 默认使用 `gpt-4o-mini-transcribe` 做转写，`gpt-5-mini` 做口语 / 写作批改。
- `openrouter` 默认使用 `openrouter/auto`，你也可以手动改成自己想试的免费或低价模型。
- `gemini` 默认使用 `gemini-2.5-flash-lite`，并支持用 `GEMINI_*_MODEL_PRIORITY` 设定低延迟优先的候选顺序。
- 现在仓库默认的 Gemini 候选顺序已经调成 `gemini-2.5-flash-lite -> gemini-2.5-flash`，优先兼顾响应速度。

## 说明

- 当前内置的是一套适合雅思备考的分类词表示例，可以继续按现有数据结构扩充。
- 浏览器本地依然会保留 `localStorage` 作为兜底；只要本地代理可用，离线页和本地代理页会同步一份共享进度；如果再配置了云同步后端，线上、离线和本地 AI 版也能继续共享同一份进度。
- 站点不依赖构建工具；AI 版只额外需要 Python 3 和对应 provider 的 API Key。
- `netlify/` 目录里的函数仍然可以继续当作一个现成后端样例，但 GitHub Pages 本身只负责静态托管，不会直接运行这些函数。
- 如果你要继续维护 `netlify/` 目录里的函数，可以在项目目录运行一次 `npm install` 安装依赖。
- GitHub Pages 线上版如果要自动连 AI，需要把独立后端地址填进 [site-config.js](/Users/shyn/Documents/Playground/lexicon-sprint/site-config.js) 的 `backendBaseUrl`（或 `aiApiBaseUrl`），不要把 API Key 直接写进前端。
- 这次更推荐直接在 [site-config.js](/Users/shyn/Documents/Playground/lexicon-sprint/site-config.js) 里填 `backendBaseUrl`，统一接一个独立后端域名，不要再连回旧的 Netlify 函数。
- OpenRouter 是否能稳定使用免费模型，取决于你选择的具体模型是否同时支持音频输入和结构化输出；如果某个免费模型不兼容，优先改成 `openrouter/auto` 或你自己指定的兼容模型。
- 大词库生成文件是 [vocabulary-generated.js](/Users/shyn/Documents/Playground/lexicon-sprint/vocabulary-generated.js)，由 [scripts/build_large_vocabulary.py](/Users/shyn/Documents/Playground/lexicon-sprint/scripts/build_large_vocabulary.py) 基于 ECDICT（MIT License）筛选生成。

## 独立后端部署

仓库现在已经把独立后端合并到 [server.py](/Users/shyn/Documents/Playground/lexicon-sprint/server.py) 里了，包含：

- `/api/ai/*`：口语/写作 AI 批改
- `/api/cloud-sync/*`：云端账号注册、登录、进度同步
- `/api/pronunciation`：在线发音代理

推荐把它部署到一个单独的 Python Web Service，然后把前端的 `backendBaseUrl` 指向它。仓库里已经附带了 [render.yaml](/Users/shyn/Documents/Playground/lexicon-sprint/render.yaml) 作为独立后端样例，而且默认不会再接到旧的 Netlify 站点上。
