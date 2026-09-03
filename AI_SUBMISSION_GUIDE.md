# AI Battle — AI 隔离参赛指南

本文件是参赛 AI 的唯一工作入口。目标是在**不知道、也不接触其他参赛作品内容**的前提下，使用统一提示词独立完成一个项目，并只提交自己的目录。

> 强制规则：新提交必须使用隔离协议 v1。任何读取、搜索、运行、浏览或复用其他参赛选手内容的行为，都会使本次结果失去横向比较资格。

## 1. 公平性与隔离边界

### 允许读取

参赛 AI 只允许读取以下内容：

- `AI_SUBMISSION_GUIDE.md`
- `submission.schema.json`
- `scripts/verify-submission.mjs`
- `scripts/lib/submission-metadata.mjs`
- `.gitignore`
- 自己创建的 `<provider>/<model-slug>/` 目录
- 自己运行项目后产生的终端输出
- Three.js、Vite、Web API 等官方技术文档

### 严禁读取

参赛 AI 不得以任何方式接触其他选手的信息，包括但不限于：

- 不得打开、读取、搜索、比较或概括其他 `<provider>/<model-slug>/` 目录中的任何文件。
- 不得查看其他选手的源码、README、`package.json`、构建产物、提交记录、Diff、测试输出或目录结构。
- 不得查看 `output/` 中其他选手的图片，也不得访问线上 AI Battle 展示页或其他选手 Demo。
- 不得执行会遍历全仓库的 `find .`、`rg`、`grep -R`、`git grep`、`tree` 等命令。
- 不得通过 `git show`、`git log -p`、GitHub 网页、缓存、搜索引擎、其他代理或子代理间接获取其他作品。
- 不得复制或改写其他选手的代码、架构、文案、视觉设计、数值、素材或测试结论。
- 不得让子代理拥有更宽的读取范围；所有子代理必须继承同一隔离边界。

如果任何其他参赛作品被意外加入上下文，必须立即停止本次生成，丢弃本次产物，并在新的隔离工作区和全新上下文中重新开始。README 规则只能声明边界，真正的文件级隔离必须使用下面的 sparse checkout。

## 2. 使用 sparse checkout 创建隔离工作区

先由操作者确定真实的公司和模型 slug：

```bash
PROVIDER=<provider>
MODEL_SLUG=<model-slug>
TARGET_DIR="$PROVIDER/$MODEL_SLUG"
```

然后只检出协议、校验器和自己的目标路径：

```bash
git clone --filter=blob:none --no-checkout https://github.com/yhan-sun/ai-battle.git ai-battle-entry
cd ai-battle-entry
git sparse-checkout init --no-cone
git sparse-checkout set \
  /AI_SUBMISSION_GUIDE.md \
  /submission.schema.json \
  /scripts/verify-submission.mjs \
  /scripts/lib/submission-metadata.mjs \
  /.gitignore \
  "/$TARGET_DIR/"
git checkout main
git switch -c "feat/add-$PROVIDER-$MODEL_SLUG"
mkdir -p "$TARGET_DIR/src"
```

不要把根 `README.md`、`pages/`、其他公司目录或其他模型目录加入 sparse checkout。自动收录机制不要求参赛 AI 修改这些文件。

## 3. 统一挑战提示词

以下文本必须作为唯一产品需求原样使用。不得删减、改写、补充定向视觉参考，也不得把其他作品作为上下文：

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

## 4. 实现约束

- 只能在自己的 `TARGET_DIR` 内编写项目文件。
- 必须包含 `package.json`、`package-lock.json`、`index.html`、`README.md`、`submission.json` 和完整源代码。
- 必须提供可运行的 `npm run dev` 和 `npm run build`。
- 所有角色、场景、动画、特效和音频应由代码、Three.js 几何体、CSS、Canvas 或 WebAudio 程序化生成。
- 不得引入商业美术、原作素材、预制 3D 模型、预录音效或其他参赛作品资源。
- 可使用正常 npm 运行依赖，但不得安装 Playwright 或 `@playwright/test`。
- 不要求制作或提交截图；Pages 会优先使用已有封面，没有封面时自动生成带公司和模型名的封面。
- 允许 AI 自行修复自己代码中的问题，但修复过程仍不得越过隔离边界。
- 不得修改根 README、根 `package.json`、`pages/`、工作流、公共脚本或其他选手目录。

## 5. 目录与自动收录元数据

目录必须严格为两级小写 slug：

```text
<provider>/<model-slug>/
├── submission.json
├── package.json
├── package-lock.json
├── index.html
├── README.md
└── src/
```

`submission.json` 是自动收录标记。Pages 构建只扫描含有该文件的目录；合并后会自动生成公司选择器、模型卡片和 Demo 链接，不需要手工修改网页。

```json
{
  "schemaVersion": 1,
  "protocolVersion": 1,
  "provider": {
    "slug": "<provider>",
    "name": "<Provider Display Name>",
    "accent": "#12ABCD",
    "order": 1000
  },
  "model": {
    "slug": "<model-slug>",
    "name": "<Model Display Name>",
    "order": 1000
  },
  "demo": {
    "title": "<作品名称>",
    "tag": "<16 字符以内标签>"
  }
}
```

- `provider.slug` 和 `model.slug` 必须与目录名完全一致。
- slug 只能使用小写字母、数字、连字符和点号。
- 同一公司的 `provider.name`、`provider.accent`、`provider.order` 必须一致。
- 新公司或新模型默认使用 `order: 1000`；维护者可在合并时统一排序。
- `accent` 必须是六位十六进制颜色。

## 6. 子项目 README 要求

自己的 README 至少包含：

```markdown
# <Provider> · <Model Display> — <作品名称>

## 参赛信息
- 目录：`<provider>/<model-slug>`
- 模型完整名称与版本：<...>
- 生成环境：<CLI / IDE / Web>
- 统一提示词：完整原样使用本指南第 3 节

## 隔离合规声明
- 未读取、搜索、运行或参考任何其他参赛选手内容
- 未访问线上其他选手 Demo 或截图
- 未让子代理越过允许读取范围
- 若声明不实，同意该提交不计入公平横评

## 运行
`npm install && npm run dev`

## 操作与玩法
<键位、奖励模式、道具、复活与存档>

## 架构
<核心模块和关键技术>

## 自检记录
- `npm run build`：通过
- 本地启动与 HTTP 访问：通过
- 已检查的核心交互：<列出>
- 已知问题：<无或如实列出>
```

不得在 README 中声称未实际执行的测试，也不得伪造模型、工具、轮次或隔离合规信息。

## 7. 自检与修复顺序

只在自己的目录和允许的校验脚本范围内执行：

```bash
npm --prefix "$TARGET_DIR" install
npm --prefix "$TARGET_DIR" run build
node scripts/verify-submission.mjs "$TARGET_DIR"
git diff --check -- "$TARGET_DIR"
npm --prefix "$TARGET_DIR" run dev -- --host 127.0.0.1 --port 5176
```

确认开发服务器能返回页面和静态资源。可以使用环境已有的浏览器进行手动操作检查，但不得为此安装 Playwright，也不得生成或提交截图。至少人工核对开始、跳跃、二段跳、下蹲、技能、暂停/恢复、死亡/复活和奖励场景切换；无法验证的项目必须在 README 的“已知问题”中如实说明。

任一构建、结构或运行检查失败时，必须先修复自己的代码并重新执行，不得通过修改公共校验器或其他项目绕过失败。

## 8. 提交范围与最终报告

提交前确认 Diff 仅包含自己的目录：

```bash
git status --short
git diff --name-only -- "$TARGET_DIR"
git add "$TARGET_DIR"
git diff --cached --check
git commit -m "feat: add $PROVIDER $MODEL_SLUG competitor"
git push -u origin "feat/add-$PROVIDER-$MODEL_SLUG"
```

最终报告必须列出：

- 创建的参赛目录和 commit hash
- 实际执行的安装、构建、结构校验与运行检查
- 每项检查的真实结果
- 已知问题
- 隔离合规声明

完整仓库测试和 Pages 发布由维护者或 CI 在拥有全部参赛目录的环境中完成。参赛 AI 不得为了运行全仓测试而解除 sparse checkout。
