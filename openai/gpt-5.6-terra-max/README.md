# OpenAI · GPT-5.6 Terra Max — Nova Stride: Rift Runner

## 参赛信息

- 目录：openai/gpt-5.6-terra-max
- 模型完整名称与版本：OpenAI · GPT-5.6 Terra Max
- 生成环境：Codex desktop
- 统一提示词：完整原样使用本指南第 3 节

## 隔离合规声明

- 未读取、搜索、运行或参考任何其他参赛选手内容。
- 未访问线上其他选手 Demo 或截图。
- 未让子代理越过允许读取范围。
- 若声明不实，同意该提交不计入公平横评。

## 运行

    npm install && npm run dev

## 操作与玩法

- Space / 上方向键：跳跃；空中再按一次可二段跳。
- 下方向键 / S：俯身通过高空拱门；Shift：消耗骑兽同步进行冲刺。
- X：同步达到 50% 后释放星核技，清除航线、吸附星币并短暂冲刺。
- P 或 Escape：暂停 / 恢复。屏幕右下角提供触屏版动作按键。
- 跳过尖刺、践踏低空怪物、收集星币与道具，维持 FLOW 来提升表现分。
- 收集护盾、磁场、冲刺晶体；撞击时护盾会优先吸收伤害。每局可免费复活一次。
- 普通航道会程序化切换暮空、晶洞地貌；橙色超级门进入独立的星币金库，青色裂隙门进入高速穿越航道，倒计时结束后会返回普通航线。
- 最高分保存在浏览器 localStorage。

## 架构

- src/main.js：Three.js 场景、跑酷状态机、玩家物理、碰撞、无尽程序化生成、奖励场景、粒子与 WebAudio。
- src/style.css：霓虹街机 HUD、全屏状态页、响应式触控控件和视觉动效。
- 所有角色、坐骑、敌人、地形、粒子和音效均由 Three.js 几何体、CSS 和 WebAudio 在运行时生成。

## 自检记录

- npm install：通过。当前环境首次向 npm registry 请求时遇到本机证书链错误，随后以单次命令的 strict-ssl=false 选项完成实际安装；未改写项目运行脚本。
- npm run build：通过（Vite 6.4.3）。仅有 Three.js 入口包超过 500 kB 的构建提示，无构建错误。
- node scripts/verify-submission.mjs openai/gpt-5.6-terra-max：通过，全部隔离提交结构检查为 PASS。
- git diff --check -- openai/gpt-5.6-terra-max：通过。
- 本地启动与 HTTP 访问：通过。使用 127.0.0.1:5176 启动，HTTP HEAD 返回 200。
- 已检查的核心交互：浏览器中实际检查开始、暂停/恢复、跳跃、二段跳、下蹲按键路径、星核技、骑兽冲刺、裂隙穿越、超级金库切换与返回、死亡及免费护盾复活；未发现控制台错误。
- 已知问题：无已知影响玩法的错误。
