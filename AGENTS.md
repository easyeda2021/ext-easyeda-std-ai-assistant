# AGENTS.md · 给 AI 编码助手的仓库约定

本文件面向在本仓库工作的 AI 编码助手（以及人类贡献者）。先读完再动手。

## 1. 这是什么

EasyEDA **标准版**（Std / v6，嘉立创EDA 标准版）的第三方扩展「AI 助手」：
把大模型接进原理图与 PCB 编辑器，提供审查、BOM 分析、器件标准化、生成原理图、
图片生成符号等能力。扩展通过宿主提供的 `api('...')` 与编辑器交互。

**硬约束**

- 只支持标准版。**不要**引入专业版（Pro）的 `.eext`、`eda.dmt_*` 体系，两者不通用。
- 扩展以**本地文件**方式加载（不是 `.eext` 包），宿主会 `eval` 每个脚本，按
  `manifest.json` 的 `scripts` 顺序执行。
- 扩展 ID 由用户安装时自行填写，运行时通过 `EAI.discoverExtId()` 探测；
  构建产物里**不包含** ID，也不要用 ID 作为目录名。

## 2. 目录与数据流

```
extension/core.js        EAI 命名空间、配置（多供应商/多模型）、日志、自绘弹窗 EAI.dlg、ID 识别
extension/prompts.js     所有系统提示词：P.system / P.tasks / P.nudges（改提示词只改这里）
extension/i18n.js        渲染期把中文文案替换成英文（字典 + 正则规则 + MutationObserver）
extension/llm.js         OpenAI / Anthropic 客户端：endpoint 归一化、listModels、chat、chatTools
extension/eda.js         文档模型：元件、BOM、PCB、截图、定位
extension/eda-netlist.js 连通性引擎 + 编辑器网络名校核
extension/parts.js       常用器件原始 LIB 模板（18 种，一行一个），place_part 解码后放置
extension/actions.js     写回文档：改值、改属性、画线、放标签、建符号
extension/tools.js       暴露给模型的工具（JSON Schema + 实现），按文档类型裁剪
extension/agent.js       Agent 循环 + 快捷胶囊定义（只含一句需求 prompt）
extension/ui-base.js     设计变量、st() 内联样式、图标、Markdown 渲染
extension/ui.js          面板：header / 输入框 / 消息 / 运行工具卡片 / 发送与 Agent 接线
extension/ui-report.js   报告卡片、报告预览、日志窗口
extension/ui-settings.js 设置弹窗（供应商与模型 / 生成参数 / 诊断）
extension/ui-about.js    关于弹窗（含项目地址）
extension/main.js        引导：菜单、工具栏按钮、命令
tools/pack.js            构建：版本自增 → dist/<project>-v<ver>/ + .zip（自带 zip 实现，无依赖）
.github/workflows/       手动触发的构建与 Release
```

一次对话的路径：`ui.js` 组装 system prompt（`prompts.js` + 胶囊任务要求）→
`agent.run()` 循环调用 `llm.chatTools()` → 工具在 `tools.js` 执行、经 `eda*.js` 读、
`actions.js` 写 → 结果回填 → 最终文本进对话 / 报告卡片。

## 3. 代码约定

- **ES5 风格**：宿主环境是老内核，只用 `var` / `function`，不要箭头函数、`let/const`、
  模板字符串、可选链。
- **单个 JS 文件 ≤ 800 行**，超了就拆文件并同步 `manifest.json` 的 `scripts`。
- **样式全部内联**：用 `st({...})` 生成，它会把 camelCase 转 kebab 并转义 `"`。
  不要依赖外部 CSS，也不要在内联样式里用双引号包字体名。
- **自绘弹窗**：用 `EAI.dlg({title,width,height,modal,content})`，不要用平台
  `api('createDialog')`（默认关闭、不加载我们的样式）。`height: 'auto'` 可按内容自适应。
- **扩展 ID**：新增命令必须走 `EAI.cmd('name')`，它会拼上探测到的真实 ID。
- 用户可见文案：中文写在代码里，需在 `extension/i18n.js` 的 `I.map` / `I.rules`
  补英文词条；宿主菜单与弹窗标题的文案放在 `extension/locale.txt`（由 `U.t()` 读取）。
- 日志：用 `EAI.log(msg, 'info'|'warn'|'error')`，会进独立日志窗口与诊断信息。

## 4. 提示词

**所有发给模型的提示词都在 `extension/prompts.js`**：

| 位置 | 用途 |
|---|---|
| `P.system(ctx)` | 角色 + 全局规则 |
| `P.tasks[id]` | 某个胶囊的任务流程（发送时并入 system prompt 的「【当前任务要求】」） |
| `P.nudges` | 循环控制语：步数上限、空回复追问、工具收敛、截图附注 |

- 胶囊的 `prompt`（用户看到的输入框内容）只写一句需求，**不要把流程写进去**。
- 工具描述在 `tools.js` 的 schema 里，改工具行为时同时检查提示词是否要跟着改。

## 5. 构建与测试

```bash
node tools/pack.js                  # 版本末位 +1，产出目录与 zip
node tools/pack.js --version 0.1.0  # 指定版本
node tools/pack.js --no-zip         # 只产出目录
```

- 版本唯一来源是 `extension/manifest.json` 的 `version`，关于页与诊断都读它。
- `dist/`、`tmp/` 不入库。临时脚本、截图、测试一律放 `tmp/`。
- 离线测试脚本（不在仓库内，本地 `tmp/`）：`test-extension.js`（端到端）、
  `test-llm.js`（端点/请求体）、`test-toolcalls.js`、`test-eda.js`、`markup-check.js`。
  改动后至少跑 `node --check` 与被改动模块相关的测试。
- 真机验证：在 EasyEDA 里以「加载扩展」安装 `dist/<project>-v<ver>/` 下的全部文件，
  刷新页面后从菜单 / 工具栏打开面板；设置里可用任意 OpenAI 兼容地址（含本地 mock）。

## 6. 已知坑

- `bc.pin` 序列化要求引脚 JSON 含 `dot` / `clock` / `configure.locked`，缺一个就抛错。
- 网表：导线是一条电气节点，引脚只连在导线端点；跨图纸按 `sheetIndex * 1e6` 偏移。
- 消息 `content` 既可能是分段数组也可能是字符串（工具回执），整形必须两者都兼容。
- 非模态弹窗拖动时，遮罩必须临时 `pointer-events:auto`，否则指针进入编辑器 iframe
  会丢 `mouseup`，拖拽卡死。
- 编辑器会在加载时清掉不匹配 `extension-<真实ID>-` 前缀的 command key，所以 ID 探测
  必须先探针再兜底。

## 7. 提交与发布

- 文档三件套同步：`README.md` / `README.en.md`（关键）、`PRD.md`（细节）、
  `CHANGELOG.md`（按天，版本号取当天最新构建）。
- 提交信息用中文，标题一句话概括，正文按模块分点。
- 发布：GitHub Actions → **Release → Run workflow**（版本可选），
  工作流构建并创建 tag 为 `<version>`（不带 v）的 Release，附
  `ext-easyeda-std-ai-assistant-v<version>.zip`；在 GitHub 上发布 Release 也会自动挂包。
