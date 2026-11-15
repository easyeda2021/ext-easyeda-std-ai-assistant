# AI 助手 · 嘉立创EDA标准版扩展

[English](README.en.md) · 项目地址：<https://github.com/easyeda2021/ext-easyeda-std-ai-assistant>

把大模型接进 **嘉立创EDA标准版** 的原理图与 PCB 编辑器：
原理图审查、BOM 分析与器件标准化、PCB / 画布视觉评审、按需求生成原理图、图片生成符号。

> 仅支持 **嘉立创EDA标准版（Std / v6）**；专业版（Pro）的 `.eext` 与 `eda.dmt_*` 体系不通用。

---

## 特性

- **原理图审查**：整工程网表（元件→引脚→网络），检查悬空脚、命名冲突、未命名网络
- **器件标准化**：找出缺封装 / 型号 / 供应商 / 料号的元件，并用系统库与模型知识补全属性
- **BOM 分析**：缺值、缺封装、重复物料与采购建议
- **PCB / 截图评审**：板框、布局、网络统计 + 画布截图交给视觉模型
- **生成原理图**：优先用 EDA 系统库的真实器件，查不到才现场生成符号
- **符号生成**：一次画出矩形框 + 独立引脚 + 完整属性（含 Manufacturer Part）
- **Agent 循环**：模型可读网表 / BOM / 截图，也能直接改元件、连线与属性；
  工具调用合并为一张可展开的过程卡片（运行中动态刷新，结束折叠汇总）
- **多供应商 / 多模型**：同时保存多个供应商与模型，设置里可增删、拉取模型列表；
  面板发送键左侧下拉可随时切换
- **中英双语界面**：菜单、工具栏、弹窗与正文均按编辑器语言自动切换

## 安装

从 [Releases](https://github.com/easyeda2021/ext-easyeda-std-ai-assistant/releases)
下载最新的 `ext-easyeda-std-ai-assistant-v<版本>.zip` 并解压。
包内附中文 `安装说明.txt` 与英文 `INSTALL.en.txt`。

1. 嘉立创EDA → **高级 → 扩展 → 扩展配置 → 加载扩展**
2. **一次性全选**解压出来的**全部文件**（manifest.json、locale.txt、icon.svg、所有 .js）
3. 扩展 ID 自行填写一个英文标识（例如 `aiassistant`），记住它

> ID 会拼进命令名、本地配置也以它为键，**安装后不要改**；升级时先移除旧扩展，
> 再用同一 ID 加载。ID 不需要体现在打包产物里——填入任意合法标识都能工作。

本地构建：

```bash
node tools/pack.js     # → dist/ext-easyeda-std-ai-assistant-v<版本>.zip
```

## 快速使用

- **高级 ▸ AI 助手 ▸ AI 助手…** 打开面板（旧版客户端另有工具栏按钮）
- 首次使用先点 **设置**：选协议、填接口地址 / API Key / 模型，可「测试连接」
- 点胶囊（原理图审查 / BOM 分析 / 器件标准化 / 生成原理图 / 识别符号 …）填入需求，
  确认后 **发送**（`Ctrl + Enter`）
- 审查类功能结束后出现**报告卡片**：可预览或下载 Markdown / HTML
- header 的**日志**图标打开独立日志窗口，可「复制全部」反馈问题
- 输入框支持 **粘贴 / 拖入图片**；运行中点红色方形按钮可停止

## 目录结构

```
extension/              扩展本体
  manifest.json         清单（name / version / icons / scripts）
  locale.txt            宿主菜单与标题的本地化词条（编辑器 Locale 直接读取）
  icon.svg              扩展图标（只用 SVG）
  core.js               命名空间 / 配置 / 扩展 ID 识别 / 日志诊断
  prompts.js            全部系统提示词（角色规则 / 胶囊任务要求 / 循环催办）
  i18n.js               界面全量本地化（中文 → 英文，渲染时按字典替换）
  llm.js                OpenAI + Anthropic 客户端（对话 / 视觉 / 工具调用）
  eda.js                文档模型：元件、BOM、PCB、截图、定位
  eda-netlist.js        连通性引擎（导线/引脚/网络标签 + 编辑器网络名校核）
  actions.js            写回文档：改值、改属性、画线、放标签、建符号
  tools.js              给模型的工具（JSON Schema + 实现）
  agent.js              Agent 循环 + 快捷胶囊
  ui-base.js            UI 基础：设计变量 / 内联样式 / 图标 / Markdown
  ui.js                 面板：header、输入框、消息、发送与 Agent 接线
  ui-report.js          报告卡片 + 报告预览 + 日志窗口
  ui-settings.js        设置弹窗
  ui-about.js           关于弹窗
  main.js               引导：菜单、工具栏按钮、命令
tools/pack.js           打包：版本自增 → 目录 + zip 产物
.github/workflows/      手动触发构建并发布 Release
```

## 构建与测试

```bash
node tools/pack.js                  # 版本末位 +1
node tools/pack.js --version 0.1.0  # 指定版本
node tools/pack.js --no-zip         # 只生成解压目录
```

产物都在 `dist/`（不入库）：

- `dist/ext-easyeda-std-ai-assistant-v<版本>/` —— 解压目录，本地加载用
- `dist/ext-easyeda-std-ai-assistant-v<版本>.zip` —— Release 附件，文件位于 zip 根目录

离线测试脚本放在 `tmp/`（不入库），本仓库不包含。

## 发布

GitHub Actions → **Release → Run workflow**，可选填版本号；留空则按
`manifest.json` 末位 +1。工作流会构建并创建同名 tag 的 Release，附上 zip。

- 版本唯一来源：`extension/manifest.json` 的 `version`（关于页与诊断显示的就是它）
- `dist/`、`tmp/` 不入库（见 `.gitignore`）

## 疑难排查

打开面板 → 设置 → **复制诊断信息**（含扩展 ID、API/对话框可用性、文档类型、模型配置、最近日志）。
常见原因：扩展 ID 填错（命令不触发）、接口地址被 CORS 拦截、模型不支持 function calling。

## 文档

| 文档 | 内容 |
|---|---|
| [README.en.md](README.en.md) | English README |
| [easyeda-std-extension-api.md](easyeda-std-extension-api.md) | 标准版扩展开发指南：API、文档模型、UI、网络、配置、坑与建议 |
| [PRD.md](PRD.md) | 完整需求、功能细节、工具规范、数据模型、接口附录 |
| [CHANGELOG.md](CHANGELOG.md) | 按天的版本变更与关键描述 |
| [AGENTS.md](AGENTS.md) | 给 AI 编码助手的仓库约定与工作流 |

> 约定：任何新增需求或修改，需同步更新 **README（关键）**、**PRD（细节）**、**CHANGELOG（按天）**。

## 许可证

本项目基于 [Apache License 2.0](LICENSE) 开源。

## 已知限制

- 网表跨图纸连接依赖网络标签；极端 bus / 无 junction 交叠可能与编辑器略有出入
- 系统库检索依赖登录态，失败时自动退回模型知识生成符号
- 界面英文由字典逐条映射，新增文案若未加词条会显示中文
