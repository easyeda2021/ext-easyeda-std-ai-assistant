# AI 助手 · EasyEDA 标准版扩展

把大模型接进 **EasyEDA 标准版（Std / v6）** 的原理图与 PCB 编辑器：
原理图审查、PCB 审查、BOM 分析、截图评审、批量改值、AI 生成原理图、图片识别生成符号。

> 本扩展使用 **EasyEDA 标准版**独有的 `api(...)` 扩展接口，与 **专业版（Pro）** 的
> `.eext` / `eda.dmt_*` 体系完全不通用。

---

## 目录结构

```
extension/                 ← 扩展本体
  manifest.json            ← 清单（Std 必需）
  locale.txt               ← 中英文案
  icon.svg / icon*.png     ← 图标（tools/make-icons.js 生成 PNG）
  core.js                  ← 命名空间 / 配置存储 / 扩展 ID 探测 / 日志诊断
  llm.js                   ← OpenAI + Anthropic 客户端（对话 / 视觉 / 工具调用）
  eda.js                   ← 数据层：元件、网表、BOM、PCB、截图、定位
  actions.js               ← 写回文档：改值、改位号、画线、网络标签、建符号
  tools.js                 ← 给模型用的工具（JSON Schema + 实现）
  agent.js                 ← Agent 循环 + 胶囊按钮提示词
  ui.js                    ← AI 面板 / 设置 / 关于（Markdown 渲染、日志）
  main.js                  ← 引导：菜单、工具栏按钮、命令
tools/
  make-icons.js            ← 纯 Node 生成 PNG 图标（自带 PNG 编码器）
  pack.js                  ← 生成扩展 ID 并打包到 dist/
dist/<id>/                 ← 可分发的安装包（含《安装说明.txt》）
tmp/                       ← 分析脚本与离线测试（不参与打包）
```

---

## 安装

### 1. 生成安装包（含扩展 ID）

```bash
node tools/pack.js            # 输出 dist/aiaXXXXXXXX，并打印扩展 ID
node tools/pack.js --new-id   # 需要换一个 ID 时
```

ID 使用 `\w+`（标准版安装器只接受这个格式），并且保存在 `tools/.extension-id.json`，
重新打包不会变——**命令名依赖这个 ID（`extension-<id>-<cmd>`），安装后不要改**。

### 2. 在编辑器里安装

1. EasyEDA 标准版 → 菜单 **高级 → 扩展 → 扩展配置** → **加载扩展**。
2. **一次性全选** `dist/<id>/` 下的全部文件（`manifest.json`、`locale.txt`、`icon*.*`、所有 `.js`）。
   加载器按**文件名**匹配 `manifest.json` 的 `scripts`，所以必须全选、不能放子目录。
3. **扩展 ID** 填 `pack.js` 打印的那个（例如 `aia07c14821`）。
4. 确认后脚本被加载，工具栏出现 **「AI助手」** 按钮，菜单出现 **高级 ▸ AI 助手 ▸ …**。

### 3. 配置模型

**高级 ▸ AI 助手 ▸ 设置…**（或面板右上角 ⚙）：
接口协议下拉（OpenAI / Anthropic）、**可完全自定义的 Base URL**、API Key、模型名。
可点「测试连接」验证；「复制诊断信息」可一键复制运行环境与最近日志。

---

## 菜单结构

标准版会把扩展菜单**平铺**进「高级」一级菜单，所以本扩展只注册**一个**带子菜单的条目：

```
高级
└─ AI 助手              ← 唯一入口
   ├─ AI 助手…          打开对话面板
   ├─ 设置…             模型接入设置
   └─ 关于…             富文本介绍页
```

工具栏按钮文字为 **AI助手**（由 `createToolbarButton` 的 `text` 决定；
不传 `text` 时会退回 `manifest.name`）。

---

## 使用

点击「AI 助手」打开面板。顶部是一排**胶囊按钮**，点一下只做一件事：
**把对应的提示词填进输入框**，你可以先改再点「发送」。

| 胶囊 | 会做什么 |
|---|---|
| 📐 原理图审查 | 报告 ERC 风险：悬空脚、单脚网络、去耦缺失、上下拉、网络命名冲突 |
| 📦 BOM 分析 | 缺值 / 缺封装 / 重复物料 / 采购与贴片建议 |
| ✨ AI 生成原理图 | 按自然语言需求放置器件、连导线、放网络标签 |
| 🧩 图片识别符号 | 上传符号图片 → 生成带引脚的符号 |
| 🔧 PCB 审查 | 板框、器件布局、网络、布线工艺评审 |
| 🖼 截图评审 | 导出画布 → 栅格化 → 作为图片交给模型 |
| 💬 自由提问 | 空提示词，直接问 |

面板 header 右侧有三个按钮：**🗑 清空会话**、**⚙ 设置**、**📷 附加图片**。
点「清空会话」会同时清掉对话记录、报告与已附图片，避免上下文无限增长。

面板顶部只有两个页签：**对话** 和 **日志**（工具调用全过程）。

「报告」不再是一个独立页签：**只有审查 / 分析类功能**（原理图审查、BOM 分析、PCB 审查、截图评审）跑完后，
对话流里会出现一张**报告卡片**，上面有三个按钮：

* **预览报告** → 单独弹窗，正文渲染 Markdown
* **下载 Markdown** / **下载 HTML**

普通提问只会在对话里回答，不会产生报告卡片。报告里的位号可点击，点击即在编辑器里选中并高亮该元件。

---

## Agent 循环

```
用户输入 → [system + 历史 + 本回合]
             ↓
        模型（带 tools 定义）
             ↓  有 tool_calls
      扩展执行工具（读网表 / 截图 / 放器件 / 改值…）
             ↓  工具结果回填成 tool 消息
        模型 …… 直到给出最终回答
```

* 扩展会根据**当前文档类型**（原理图 / PCB / 符号库）只暴露匹配的工具，避免模型乱调。
* 工具调用在对话里以绿色小条实时显示，全部记录到「日志」页。
* 若模型/网关不支持 `tools` 字段（返回 400/404/422 且报文提到 tool），会自动降级成普通对话重试一次。
* 最大步数可在设置里调（默认 12），也可随时点「停止」。

### 工具清单

| 工具 | 作用 |
|---|---|
| `get_document_info` | 当前文档类型 / 标题 / 规模 |
| `get_components` | 元件或封装列表 |
| `get_netlist` | 全工程网表 |
| `get_bom` | 物料清单 |
| `get_pcb_info` | 板框、封装位置、网络、过孔数 |
| `capture_image` | 截图并附到下一条消息 |
| `locate_component` | 选中并高亮位号 |
| `set_component_value` | 改参数值 |
| `set_component_designator` | 改位号 |
| `place_part` | 放置 R/C/L/D/LED/SW/通用 N 脚器件 |
| `create_wire` | 画导线 |
| `create_net_label` | 放网络标签 |
| `create_symbol` | 建带引脚的符号 |

---

## 实现要点（逆向自 `resources/editor/6.5.61.asar`）

| 能力 | 用到的 API |
|---|---|
| 菜单 | `api('createExtensionMenu', [{text, submenu:[…]}])` |
| 工具栏 | `api('createToolbarButton', {icon, text, fordoctype, cmd, menu})` |
| 命令 | `api('createCommand', {'extension-<id>-<name>': fn})` |
| 读文档 | `api('getActiveJson')` / `api('getSource','json')` / `api('getActiveProjectAllSchJson')` |
| 读写图元 | `api('getShape' / 'updateShape' / 'createShape')` |
| 编辑器命令 | `api('editorCall',{cmd,args})`（帧内命令总线） |
| 跨窗口命令 | `window.callByEditor({func,args,uuid})`（顶层窗口命令总线） |
| 截图 | `api('getSource','svg')` → canvas → PNG dataURL |
| 持久化 | `api('readConfig' / 'saveConfig')` + `localStorage` |
| 对话框 | `api('createDialog', opts)`（EasyUI dialog） |

### 三个踩过的坑（也是这次的修复点）

1. **弹窗打不开**
   `api('createDialog')` 返回的是内容元素，而对话框是**关闭**状态的；
   官方 sample 里显式调用了 `$dlg.dialog('open')`。当初漏了这一行，
   表现就是"点了没反应"。现在统一走 `EAI.dlg()`，创建后立即 `dialog('open')` 并写日志。

2. **扩展 ID 拿不到**
   加载器不会把扩展自己的 id 传给脚本（id 是安装时用户填的），但命令名必须带它。
   `core.js` 两路探测：
   ① 找 `manifest.scripts` 含 `core.js` 的实例；
   ② 对每个候选 id 注册 `extension-<候选>-__eai_probe__`，
   因为 `createCommand` 会丢弃所有不以 `extension-<真id>-` 开头的键，**唯一存活的就是我们**。

3. **`editorCall` 到不了顶层命令**
   `getWireNetName` 只存在于**顶层窗口**的 `callByEditor` 里，不在编辑器 iframe 的命令表中。
   必须 `window.callByEditor({func:'getWireNetName', args:[pts], uuid: 当前 tabid})`。

### 网表是怎么来的（能不能直接劫持编辑器菜单命令？）

结论：**不能直接劫持菜单命令拿到网表，但可以劫持它底层的网络名查询。**

* 编辑器真正的网表构造器（`L.init / L.mergerSubPart / L.createNet / L.buildNetlist`）
  在 `main.min.js` 的模块作用域里，扩展拿不到。
* 菜单里的 `Netlist / export_bom` 会弹窗或直接触发下载，不适合程序化取值。
* 但顶层命令总线暴露了 **`getWireNetName`**：给它一批坐标，它返回每个点所属的**权威网络名**。
  这正是编辑器内部 `L.nodes[point] → L.netNames[...]` 的查询。

所以 `eda.js` 的做法是：

1. 按与编辑器一致的规则做**本地连通性重建**（导线=一个节点、引脚只接端点、
   交点需要 junction、网络标签/电源端口命名节点），多图纸按 `sheetIndex × 1e6` 偏移合并；
2. 对**当前图纸**用 `getWireNetName` 取权威网络名，**覆盖命名**并按同名**合并分组**
   （这样连本地算法算错的连接也能被编辑器纠正）；
3. 最终网表里每个 net 都带 `pins[]`（位号.引脚）、`labels[]`、`sheets[]` 和冲突标记。

> 坐标单位：原理图 1 单位 = 10 mil（0.01 inch）；PCB 1 单位 = 1 mil。

---

## 离线测试

```bash
node tmp/test-extension.js   # 端到端：加载脚本 → 命令/菜单/工具栏 → 弹窗 → 工具 → Agent 循环
node tmp/test-toolcalls.js   # OpenAI / Anthropic 的工具调用请求与响应格式
node tmp/test-eda.js         # 元件 / 网表 / BOM / c_para
node tmp/test-llm.js         # 接口地址拼接、请求体
node tools/make-icons.js     # 重新生成 PNG 图标
```

`test-extension.js` 模拟宿主（`api`、jQuery、扩展加载器）和模型接口，
用脚本化的 tool_calls 跑完整条 Agent 链路，**不需要打开 EasyEDA**。

---

## 排查

面板 → 日志页，或 设置 → 「复制诊断信息」，能看到：

```
AI Assistant v2.0.0
extension id : aiaXXXXXXXX
instances    : ...
api available: true
jQuery       : 3.x
dialog fn    : function
dialogsContainer: true
doc kind     : sch
provider     : openai
model        : gpt-4o
base url     : https://api.openai.com/v1
api key      : set (51 chars)
```

常见问题：

| 现象 | 原因 / 处理 |
|---|---|
| 按钮出现但点了不动 | 扩展 ID 猜错了 → 看日志 `extension id = ... (not detected)`，用 `pack.js` 打印的 ID 重装 |
| 菜单平铺在「高级」下 | 旧版本残留，删除后重装；本版只注册一个带 submenu 的条目 |
| 发送后报 CORS | Electron `webSecurity: true`，换用允许跨域的接口地址 |
| 提示没有工具调用 | 模型不支持 function calling，换模型（如 gpt-4o / claude / deepseek-chat） |

---

## 已知限制

* 网表中的跨图纸连接依赖网络标签；极复杂的 bus / 无 junction 交叠仍可能与编辑器有出入
  （当前图纸会用编辑器自己的网络名校核并合并）。
* 内置符号库只有 R/C/L/D/LED/SW + 通用 N 脚器件，不检索立创器件库。
* AI 生成的布局由模型给坐标，落地后建议人工微调。
