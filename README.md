# ⚔️ AI Battle:《天天酷跑》Web 3D/2.5D 极限编程竞技场

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Three.js](https://img.shields.io/badge/Three.js-r160%2B-black?logo=three.js)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x%2F7.x-646CFF?logo=vite)](https://vitejs.dev/)
[![Deploy GitHub Pages](https://github.com/yhan-sun/ai-battle/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/yhan-sun/ai-battle/actions/workflows/deploy-pages.yml)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#-怎么提交-pr--参赛指南-how-to-contribute)

> **AI 大模型极限前端全栈编程能力大比拼 (AI Benchmark Arena)**  
> 在完全相同、极其严苛的单一 Prompt 约束下，让各大前沿 AI 模型（如 Gemini、GPT、Claude 等）自主从零生成完整可玩的 **3D/2.5D《天天酷跑》风格网页游戏**。不使用任何外部预制模型或音效文件，全靠代码（Three.js 几何体、程序化动画、WebAudio 音频合成）独立完成！

---

## 🌐 在线体验 (GitHub Pages)

仓库已配置 GitHub Actions：每次 `main` 分支更新后，自动构建所有模型项目和体验入口页，并发布到 GitHub Pages。

- [打开在线体验入口](https://yhan-sun.github.io/ai-battle/)
- [OpenAI · GPT-5.6 Luna Max](https://yhan-sun.github.io/ai-battle/openai/gpt-5.6-luna-max/)
- [Google · Gemini 3.8 Flash High](https://yhan-sun.github.io/ai-battle/google/gemini-3.8-flash-high/)
- [Meta · Muse · Star Dash Runner](https://yhan-sun.github.io/ai-battle/meta/muse/)

如果是 Fork 后首次部署，请在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。之后不需要手工上传 `dist`，工作流会根据仓库名自动设置 Pages 子路径，Fork 后的链接也能正常工作。

---

## 📜 统一考验提示词 (The Challenge Prompt)

所有参赛模型均须使用以下**完全一致**的提示词生成，不可删改要求，不可预置私货资源：

```text
使用 Three.js + HTML/CSS/JavaScript（可用 Vite），从零制作一个完整可玩的网页版《天天酷跑》风格 3D/2.5D 横版跑酷游戏。

要求高度还原其核心玩法和节奏，但不要直接使用原作商标、角色或美术资源。

必须实现：自动奔跑、跳跃/二段跳、下蹲、障碍物、怪物踩踏、金币、表现分、距离、速度递增、死亡复活、角色动画、坐骑/宠物机制、技能、冲刺、磁铁、护盾，以及完整的 超级奖励、穿越奖励、奖励关卡切换与结束返回机制。

地图必须无限程序化生成，包含多种地形、天空/地下/特殊奖励场景，并保证随机地图可通过。超级奖励需要有独立场景、金币阵列、倍率和时间限制；穿越奖励需要真正切换到特殊高速场景，而不是简单换背景。

加入完整 HUD、开始界面、暂停、结算、最高分、本地存档、音效反馈、粒子、镜头震动、视差背景和流畅动画。

重点考验：
游戏架构、状态机、碰撞系统、程序化关卡、奖励模式切换、动画表现、Three.js 性能优化和整体完成度。

不要只做 Demo。直接生成完整项目代码，要求 npm install && npm run dev 即可运行，并自行检查和修复明显 Bug。
```

---

## 🤖 AI Agent 参赛流程 (AI Submission Workflow)

本节是一份可以直接交给 coding agent 执行的操作契约，覆盖从 clone 仓库、创建模型目录、使用统一提示词，到自检、补充文档和提交 PR 的完整流程。AI 不应只输出方案；应在工作区实际完成代码、文档和测试。

### 给 AI 的任务指令（可直接复制）

```text
你是 AI Battle 的参赛项目实现代理。请在当前仓库中完成一个全新的、可运行的《天天酷跑》风格 3D/2.5D 横版跑酷项目。

执行前先读取根目录 README.md，必须完整、原样使用“统一考验提示词”章节中的提示词，不得删改、改写或替换为另一套需求。

请把以下信息替换成真实值：
- PROVIDER：模型提供方的小写 slug，例如 openai、google、anthropic
- MODEL_SLUG：模型名称的小写版本 slug，例如 gpt-5.6-luna-max、gemini-3.8-flash-high
- MODEL_DISPLAY：模型的完整展示名
- TARGET_DIR：PROVIDER/MODEL_SLUG

请严格按以下顺序完成：
1. 如果当前还不是本仓库，先 clone 并进入仓库；如果已经在仓库中，先检查 git status，不要覆盖已有未提交改动。
2. 创建 TARGET_DIR；不得覆盖已有参赛目录，也不得直接修改其他选手的核心代码。
3. 将“统一考验提示词”原文作为本次生成任务的唯一产品需求，在 TARGET_DIR 中生成完整项目。项目必须包含 package.json、index.html、源代码和可运行的 npm run dev / npm run build。
4. 使用程序化 Three.js 几何体、CSS、Canvas 和 WebAudio 生成素材；不要引入外部商业美术、角色、模型或音效资源。
5. 完成后补充 TARGET_DIR/README.md，记录模型全名、生成环境、提示词使用说明、玩法、操作、架构和测试结果。
6. 更新根 README 的参赛矩阵、启动命令和截图展示；截图保存为 output/playwright/PROVIDER-MODEL_SLUG.png，并使用相对路径引用；同时把新项目加入 pages/index.html 的在线体验卡片。
7. 在根 package.json 中加入 dev:<provider> 快捷命令，并把新项目加入 build:all 覆盖范围；Pages 构建脚本会自动发现两级模型目录。
8. 执行 TARGET_DIR 的 npm install、npm run build，以及根目录的 npm test、npm run build:all、npm run build:pages、git diff --check。
9. 启动 TARGET_DIR 的开发服务器并进行浏览器冒烟测试：打开首页、点击开始、确认画布/HUD/角色可见，测试跳跃、下蹲、技能、暂停/恢复和结算流程；确认没有致命的 JavaScript 或资源加载错误，然后截取实际运行画面。
10. 任一检查失败都必须先修复并重新执行，不能在未通过时声称完成。
11. 最后汇报修改文件、测试命令及结果、截图路径和 git commit；只有获得明确授权并具备远程权限时才执行 push。
```

### 目录命名约定

新参赛项目必须使用「模型提供方 / 具体模型名」两级目录，模型名直接使用带版本的 slug，不使用泛化目录名：

```text
<provider>/<model-slug>/
├── package.json
├── index.html
├── README.md
└── src/
```

例如：`openai/gpt-5.6-luna-max/`、`google/gemini-3.8-flash-high/`、`anthropic/claude-3-7-sonnet/`。这些只是目录格式示例，不代表当前项目的模型归属；当前第三个项目真实目录是 `meta/muse/`，提供方为 Meta，作品/模型标识为 Muse。目录名使用小写字母、数字、连字符和点号；如果目标目录已经存在，应停止覆盖并选择唯一的模型版本 slug。

### 从 clone 到新分支

```bash
git clone https://github.com/yhan-sun/ai-battle.git
cd ai-battle
git checkout -b feat/add-<provider>-<model-slug>
mkdir -p <provider>/<model-slug>
```

如果当前已经位于该仓库，跳过 `git clone`，先执行 `git status --short --branch`，保留已有用户改动。

### 子项目 README 最低内容

每个模型目录都必须有自己的 README，至少包含以下信息：

```markdown
# <Provider> · <Model Display> — <作品名称>

> 参赛目录：`<provider>/<model-slug>`

## 参赛信息
- 模型：<Model Display>
- 统一提示词：使用根目录 README 的原文，未修改
- 生成环境：<IDE / CLI / Web>
- 生成轮次与修复记录：<简述>

## 运行
`npm install && npm run dev`

## 操作与玩法
<键位、奖励关卡、道具、复活和存档说明>

## 架构
<核心模块说明>

## 自检记录
- `npm run build`：通过
- 浏览器冒烟测试：通过
- 截图：`../../output/playwright/<provider>-<model-slug>.png`
```

### 提交前的自检顺序

从仓库根目录执行：

```bash
TARGET_DIR=<provider>/<model-slug>
npm --prefix "$TARGET_DIR" install
npm --prefix "$TARGET_DIR" run build
npm test
npm run build:all
npm run build:pages
git diff --check
```

浏览器冒烟测试使用独立端口启动：

```bash
npm --prefix "$TARGET_DIR" run dev -- --host 127.0.0.1 --port 5176
```

验收标准是：首页能打开；开始界面能进入游戏；角色、场景和 HUD 正常渲染；跳跃/下蹲/技能/暂停等输入有反馈；游戏能进入结算或复活流程；控制台没有阻断游戏的异常；截图展示的是实际运行画面而不是空白页面。

### 提交和 PR

```bash
git status --short
git add <provider>/<model-slug> README.md package.json output/playwright/<provider>-<model-slug>.png
git commit -m "feat: add <provider> <model-slug> competitor"
git push -u origin feat/add-<provider>-<model-slug>
```

不要提交 `node_modules`、构建缓存、调试日志、密钥或个人配置。没有远程写权限时，完成本地 commit 后提供 commit hash，由仓库维护者创建或合并 PR。

---

## 🏆 目前参赛选手矩阵 (Current Competitors)

| 选手 / 目录 | 参赛 AI 模型 | 作品名称 | 架构风格 | 坐骑 / 宠物机制 | 特色亮点 | 快速启动命令 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| [`openai/gpt-5.6-luna-max`](./openai/gpt-5.6-luna-max) | **OpenAI · GPT-5.6 Luna Max** | 《星轨冲刺 · NEON SPRINT》 | 极简集成单文件架构 (`main.js`) | 悬浮滑板 / 伙伴浮游炮 | 几何霓虹美学；低空闸门/阶梯生成；星核复活与独立奖励关卡 | `npm run dev:openai` |
| [`google/gemini-3.8-flash-high`](./google/gemini-3.8-flash-high) | **Google · Gemini 3.8 Flash High** | 《天天炫跑 · CYBER DASH 3D》 | 深度面向对象 / 多子系统解耦 (Entities / VFX / World / Audio) | 机械炎豹、极速战车、糖果飞龙 / 炽焰幼龙、波波精灵、小飞碟 | 独立云端乐园与赛博虫洞场景；三段跳与俯冲；玻璃拟态 UI 与主动技能爆发 | `npm run dev:google` |
| [`meta/muse`](./meta/muse) | **Meta · Muse** | 《星尘酷跑 · Star Dash Runner》 | 游戏引擎级分层架构 (`game`, `level`, `player`, `audio`, `ui`) | 星角兽骑乘 / 悬浮小宠跟随 | WebAudio 合成音效与 BGM；土狼时间与跳跃预输入；零 GC 粒子池；FOV 冲刺拉伸与视差远山 | `npm run dev:meta` |

---

## 🖼️ 实机截图 (Gameplay Screenshots)

以下截图均来自本地 Vite 开发服务器启动后的实际运行画面，统一使用 1600 × 1000 视口截取。

<table>
  <tr>
    <td align="center">
      <a href="./output/playwright/openai-gpt-5.6-luna-max.png">
        <img src="./output/playwright/openai-gpt-5.6-luna-max.png" alt="OpenAI GPT-5.6 Luna Max gameplay screenshot" width="100%" />
      </a>
      <br /><sub><code>openai/gpt-5.6-luna-max</code> · NEON SPRINT</sub>
    </td>
    <td align="center">
      <a href="./output/playwright/google-gemini-3.8-flash-high.png">
        <img src="./output/playwright/google-gemini-3.8-flash-high.png" alt="Google Gemini 3.8 Flash High gameplay screenshot" width="100%" />
      </a>
      <br /><sub><code>google/gemini-3.8-flash-high</code> · CYBER DASH 3D</sub>
    </td>
    <td align="center">
      <a href="./output/playwright/meta-muse.png">
        <img src="./output/playwright/meta-muse.png" alt="Meta Muse gameplay screenshot" width="100%" />
      </a>
      <br /><sub><code>meta/muse</code> · Star Dash Runner</sub>
    </td>
  </tr>
</table>

---

## 🚀 怎么启动 (How to Run)

本项目内每个选手的作品均为**独立开箱即用的前端工程**。目录按「模型提供方 / 模型名称」组织；第三个项目为 Meta · Muse，路径是 `meta/muse/`。你可以通过根目录快捷命令启动，也可以进入对应选手的子目录独立运行。

### 方式一：在根目录一键启动（推荐）

确保已安装 [Node.js](https://nodejs.org/)（v18+ 推荐）：

```bash
# 启动 OpenAI · GPT-5.6 Luna Max 作品
npm run dev:openai

# 启动 Google · Gemini 3.8 Flash High 作品
npm run dev:google

# 启动 Meta · Muse 作品
npm run dev:meta
```

### 方式二：进入各选手独立目录运行

```bash
# 1. 启动 OpenAI · GPT-5.6 Luna Max 作品
cd openai/gpt-5.6-luna-max
npm install
npm run dev

# 2. 启动 Google · Gemini 作品
cd google/gemini-3.8-flash-high
npm install
npm run dev

# 3. 启动 Meta · Muse 作品
cd meta/muse
npm install
npm run dev
```

启动成功后，浏览器打开终端输出的本地地址（通常为 `http://localhost:5173`）即可试玩。

---

## ✅ 测试与自检 (Test & Self-check)

仓库根目录提供 `npm test`，用于检查所有 `<provider>/<model>` 项目的标准文件、根 README 链接、根启动脚本、`build:all` 覆盖范围和对应实机截图。它不替代浏览器冒烟测试，但会在提交前尽早发现目录或文档遗漏。

```bash
# 检查目录、入口、README、脚本和截图
npm test

# 构建全部参赛项目
npm run build:all

# 检查空白字符和常见补丁问题
git diff --check
```

新增选手必须同时通过 `npm test`、该子项目的 `npm run build`、根目录的 `npm run build:all` 和浏览器冒烟测试，才可以提交 PR。

---

## 🎮 通用操作方式

大部分选手的键位设计均贴合经典横版操作，并支持移动端触屏：

| 动作 | 键盘按键 | 移动端操作 | 说明 |
| :--- | :--- | :--- | :--- |
| **跳跃** | `空格 (Space)` / `W` / `↑` | 点击屏幕右侧 / 跳跃按钮 | 支持二段跳；部分坐骑可触发三段跳 |
| **下蹲 / 滑行** | `S` / `↓` | 点击屏幕左侧 / 下滑按钮 | 贴地滑行通过低空障碍；空中可触发俯冲速降 |
| **角色技能** | `F` / `Shift` / `E` | 点击技能图标 | 触发全速冲刺、摧毁障碍或磁铁吸附 |
| **暂停 / 静音** | `Esc` / `P` / `M` | 点击右上角按钮 | 随时暂停、继续游戏或静音 |

---

## 🤝 怎么提交 PR / 参赛指南 (How to Contribute)

欢迎提交新的 AI 大模型参赛作品（如 Claude、DeepSeek、Qwen、Grok 等）！

### 1. 参赛规范

1. **统一提示词**：必须完整复制上述 [统一考验提示词](#-统一考验提示词-the-challenge-prompt)，**不得修改、删减或人工追加定制提示**。
2. **零外部美术依赖**：模型必须自行通过 Three.js 几何体、着色、材质、CSS 或程序化 Canvas 生成所有画面，不引用商业侵权或预置的外部模型文件。
3. **开箱即用**：提交的工程必须包含完整的 `package.json`、`index.html` 和源代码，确保执行 `npm install && npm run dev` 能够无错误直接运行。
4. **真实无魔改**：代码必须由该 AI 模型真实独立生成，允许由 AI 自行修复自身 Bug，但严禁人类工程师大量重写核心玩法。

### 2. 提交步骤

1. **Fork 本仓库** 到你的个人 GitHub 账号。
2. 在本地拉取你的 Fork 仓库并创建新的工作分支：
   ```bash
   git checkout -b feat/add-<model-name>
   ```
3. 在根目录下按「模型提供方 / 模型名称」新建独立目录（例如 `deepseek/deepseek-v3/`、`anthropic/claude-3-7-sonnet/`、`xai/grok-3/` 等）。
4. 将该 AI 生成的项目完整拷贝进该目录。
5. 在该子目录下创建 `README.md`，记录：
   - 参赛模型全称与版本号
   - 系统提示词与温度参数（如有）
   - 代码生成环境（IDE、CLI 或 Web 端）与生成轮次
   - 作品的特色玩法与操作说明
6. 在根目录 `package.json` 中追加该选手的快捷脚本（如 `"dev:<provider>": "npm --prefix <provider>/<model> run dev"`）。
7. 在根目录 `README.md` 的【目前参赛选手矩阵】表格和 `pages/index.html` 在线体验入口中填入新增选手信息。
8. 运行 `npm test`、`npm run build:all`、`npm run build:pages` 和浏览器冒烟测试。
9. 提交 Commit 并向本仓库发起 **Pull Request**！

---

## 🎯 重点评审维度 (Evaluation Benchmark)

在体验和评审各 AI 的实现时，可以重点关注以下维度：

1. **架构与工程度**：
   - 代码是单文件糊成一团，还是合理的模块化（物理、关卡、实体、音频、UI 分层）？
   - 是否包含对象池（Object Pool）以优化垃圾回收（GC）与长跑掉帧问题？
2. **玩法手感与还原度**：
   - 跳跃与下蹲的弧线、手感，是否存在土狼时间（Coyote Time）与跳跃预输入？
   - 踩怪判定、受击反馈、无敌帧与金币吸附手感。
3. **奖励关卡真正切换**：
   - 超级奖励与穿越奖励是否真正切换了独立的 3D 关卡与背景，还是仅仅做了简单的滤镜或背景贴图替换？
   - 进出奖励关卡的过渡动画与无敌返场保护机制是否完善？
4. **视听与特效表现**：
   - 是否实现了纯程序化生成的 WebAudio 合成音效与背景音乐？
   - 是否包含镜头震动（Screen Shake）、动态 FOV 拉伸、粒子火花与视差背景？
5. **健壮性与随机关卡合理性**：
   - 程序化生成的地图是否必定可通过（不出现无法逾越的深渊或死局）？
   - 是否有完善的死亡结算与 `localStorage` 最高分存档？

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 开源。
各 AI 选手生成的代码著作权归属各自模型生成产物，仅供技术研究、横向横评与学术交流。
