# ⚔️ AI Battle:《天天酷跑》Web 3D/2.5D 极限编程竞技场

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Three.js](https://img.shields.io/badge/Three.js-r160%2B-black?logo=three.js)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x%2F7.x-646CFF?logo=vite)](https://vitejs.dev/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#-怎么提交-pr--参赛指南-how-to-contribute)

> **AI 大模型极限前端全栈编程能力大比拼 (AI Benchmark Arena)**  
> 在完全相同、极其严苛的单一 Prompt 约束下，让各大前沿 AI 模型（如 Gemini、GPT、Claude 等）自主从零生成完整可玩的 **3D/2.5D《天天酷跑》风格网页游戏**。不使用任何外部预制模型或音效文件，全靠代码（Three.js 几何体、程序化动画、WebAudio 音频合成）独立完成！

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

## 🏆 目前参赛选手矩阵 (Current Competitors)

| 选手 / 目录 | 参赛 AI 模型 | 作品名称 | 架构风格 | 坐骑 / 宠物机制 | 特色亮点 | 快速启动命令 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| [`/gemini`](./gemini) | **Gemini** | 《天天炫跑 · CYBER DASH 3D》 | 深度面向对象 / 多子系统解耦 (Entities / VFX / World / Audio) | 机械炎豹、极速战车、糖果飞龙 / 炽焰幼龙、波波精灵、小飞碟 | 独立云端乐园与赛博虫洞场景；三段跳与俯冲；玻璃拟态 UI 与主动技能爆发 | `npm run dev:gemini` |
| [`/gpt`](./gpt) | **GPT** | 《星轨冲刺 · NEON SPRINT》 | 极简集成单文件架构 (`main.js`) | 悬浮滑板 / 伙伴浮游炮 | 几何霓虹美学；低空闸门/阶梯生成；星核复活与独立奖励关卡 | `npm run dev:gpt` |
| [`/muse`](./muse) | **Muse** | 《星尘酷跑 · Star Dash Runner》 | 游戏引擎级分层架构 (`game`, `level`, `player`, `audio`, `ui`) | 星角兽骑乘 / 悬浮小宠跟随 | WebAudio 合成音效与 BGM；土狼时间与跳跃预输入；零 GC 粒子池；FOV 冲刺拉伸与视差远山 | `npm run dev:muse` |

---

## 🚀 怎么启动 (How to Run)

本项目内每个选手的作品均为**独立开箱即用的前端工程**。你可以通过根目录快捷命令启动，也可以进入对应选手的子目录独立运行。

### 方式一：在根目录一键启动（推荐）

确保已安装 [Node.js](https://nodejs.org/)（v18+ 推荐）：

```bash
# 启动 Gemini 作品
npm run dev:gemini

# 启动 GPT 作品
npm run dev:gpt

# 启动 Muse 作品
npm run dev:muse
```

### 方式二：进入各选手独立目录运行

```bash
# 1. 启动 Gemini 选手作品
cd gemini
npm install
npm run dev

# 2. 启动 GPT 选手作品
cd gpt
npm install
npm run dev

# 3. 启动 Muse 选手作品
cd muse
npm install
npm run dev
```

启动成功后，浏览器打开终端输出的本地地址（通常为 `http://localhost:5173`）即可试玩。

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
3. 在根目录下以模型名称新建独立目录（例如 `deepseek-v3/`、`claude-3-7-sonnet/`、`grok-3/` 等）。
4. 将该 AI 生成的项目完整拷贝进该目录。
5. 在该子目录下创建 `README.md`，记录：
   - 参赛模型全称与版本号
   - 系统提示词与温度参数（如有）
   - 代码生成环境（IDE、CLI 或 Web 端）与生成轮次
   - 作品的特色玩法与操作说明
6. 在根目录 `package.json` 中追加该选手的快捷脚本（如 `"dev:<model>": "npm --prefix <model> run dev"`）。
7. 在根目录 `README.md` 的【目前参赛选手矩阵】表格中填入新增选手信息。
8. 提交 Commit 并向本仓库发起 **Pull Request**！

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
