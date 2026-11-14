# AI Assistant for EasyEDA Std (嘉立创EDA 标准版)

一个面向 **EasyEDA 标准版（Std / v6）** 的扩展，把大模型能力接进原理图与 PCB 编辑器：
网表审查、BOM 分析、截图评审、批量改值/改位号、AI 生成原理图、图片识别生成符号。

> ⚠️ 本扩展针对 **EasyEDA 标准版**，使用 Std 独有的 `api(...)` 扩展接口，
> 与 **EasyEDA 专业版（Pro）** 的 `.eext` / `eda.dmt_*` 体系完全不通用，两者不能混用。

---

## 目录结构

```
extension/                 ← 这个目录就是扩展本体
  manifest.json            ← 扩展清单（Std 必需）
  locale.txt               ← 中英文案
  icon.svg  icon16.png icon24.png icon32.png
  core.js                  ← 命名空间 / 工具 / 配置存储 / 扩展 ID 探测
  llm.js                   ← OpenAI 与 Anthropic 两种协议的客户端（流式 + 视觉）
  eda.js                   ← EasyEDA 数据层：元件 / 网表 / BOM / PCB / SVG→PNG / 定位
  actions.js               ← 回写文档：改值、改位号、画导线、网络标签、放置符号
  ui.js                    ← 设置对话框、AI 面板、Markdown 报告渲染、各 AI 功能
  main.js                  ← 引导：注册菜单、工具栏按钮与命令
tools/make-icons.js        ← 用纯 Node 生成 PNG 图标（自带 PNG 编码器）
tmp/                       ← 临时文件（分析用的脚本、离线测试）
```

---

## 安装（Windows 桌面版 `C:\Program Files\lceda`）

### 方式一：编辑器内加载（推荐，升级方便）

1. 打开 EasyEDA 标准版 → 菜单 **高级 → 扩展 → 扩展配置**（Advanced → Extension → Extension configuration）。
2. 点 **加载扩展 / Load extension**。
3. **一次性全选** `extension/` 目录下的这些文件（按住 Ctrl 多选）：

   ```
   manifest.json   locale.txt
   icon.svg   icon16.png   icon24.png   icon32.png
   core.js   llm.js   eda.js   actions.js   ui.js   main.js
   ```

   > Std 的加载器按**文件名**匹配 `manifest.json` 里的 `scripts` 数组，
   > 所以文件必须选全、且不能放在子目录里。

4. 在弹窗里填写 **扩展 ID**（Extension ID），只能用字母/数字/下划线，例如 `eai`。
   这个 ID 会拼进命令名（`extension-eai-review`），**安装后不要改**。
5. 确认后编辑器会重新加载脚本，工具栏会出现 AI 图标。

### 方式二：直接投放到安装目录

把 `extension/` 整个文件夹复制到

```
C:\Program Files\lceda\resources\editor\extensions\aiassistant\
```

（`editor` 目录在 `resources` 下的 asar 包中，需要用 asar 工具解包/重打包，
或把扩展放到已解包的 `resources/editor/6.5.61.asar` 对应位置后重启客户端。）

再在 `extensions/list.json` 中登记：

```json
{"path": "aiassistant", "enabled": true}
```

### 方式三：在线版

`https://easyeda.com/editor` 是同一套 Std 前端，**方式一**同样适用。

---

## 使用

### 入口

- **工具栏**：AI 图标（原理图 / PCB 可见），点击打开 AI 面板，下拉菜单为快捷操作。
- **菜单**：**高级** 菜单下有 `AI 设置… / AI 原理图审查 / AI BOM 分析 / AI 截图评审 /
  AI 批量修改 / AI 生成原理图 / AI 图片生成符号库 / 关于 AI 助手`。

### 配置（AI 设置）

| 项 | 说明 |
|---|---|
| API protocol | `OpenAI (compatible)` 或 `Anthropic (Claude)`，下拉切换 |
| Base URL | 接口地址。OpenAI 会拼成 `<base>/v1/chat/completions`，Anthropic 拼成 `<base>/v1/messages`；若已带 `/v1` 或完整路径则不重复追加 |
| API Key | `Authorization: Bearer …`（OpenAI）或 `x-api-key: …`（Anthropic） |
| Model | 模型名，如 `gpt-4o`、`claude-sonnet-4-5` |
| Temperature / Max tokens / Timeout | 生成参数 |
| Answer language | 回答语言（中文 / English） |
| Extra headers | 额外请求头，一行一个 `Key: Value` |

配置保存在**扩展数据**里（`api('saveConfig')` → 编辑器的 `extensionConfig`，
并会 `saveToServer()` 同步到账号），同时在本地 `localStorage` 留一份副本。

> **关于 CORS**：客户端是 Electron（`webSecurity: true`），`fetch` 受浏览器跨域策略约束。
> OpenAI / Anthropic 官方接口返回 `Access-Control-Allow-Origin: *`，可以直接用；
> 如果你用自建中转/代理，请确认它允许跨域，否则面板会给出明确提示。

### 功能

| 功能 | 做什么 |
|---|---|
| **原理图审查（网表）** | 读取当前工程所有图纸的 JSON，按编辑器同样的连通性规则算出网表（导线/引脚/网络标签/节点），再叠加编辑器自己的 `getWireNetName` 结果校核网络名，交给模型做 ERC 风险评审 |
| **BOM 分析** | 按封装+值分组统计 BOM，附带每个元件的完整参数，模型给出缺值/封装错误/可合并项/采购建议 |
| **截图评审** | 导出当前画布 SVG → 内存中栅格化成 PNG → 作为图片发给模型，做布局/可读性/布线评审 |
| **批量修改** | 模型给出 `{"designator","value","parameter"}` 列表，报告页点 **Apply suggested changes** 写回文档 |
| **AI 生成原理图** | 模型输出 JSON 计划（器件/导线/网络标签/节点），直接落到画布上 |
| **图片生成符号库** | 上传符号图片 → 视觉模型识别出引脚编号/坐标/方向 → 生成真正的符号（含引脚）放到画布 |

报告里的**位号可点击**，点击即在编辑器里选中并高亮对应元件。

---

## 实现要点（逆向自客户端 `resources/editor/6.5.61.asar`）

Std 扩展只有约 50 个公开 API，本扩展的用法全部基于它们：

| 能力 | 用到的 API |
|---|---|
| 菜单 / 工具栏 | `api('createExtensionMenu', items)`、`api('createToolbarButton', {...})` |
| 命令 | `api('createCommand', {'extension-<id>-<name>': fn})` |
| 读文档 | `api('getSource','json')`、`api('getActiveJson')`、`api('getActiveProjectAllSchJson')` |
| 读写图元 | `api('getShape',{id,cmdKey})`、`api('updateShape',{shapeType,jsonCache})`、`api('createShape',{shapeType,…})` |
| 任意编辑器命令 | `api('editorCall',{cmd,args})`（例如 `getWireNetName`、`select`、`highlightItems`） |
| 截图 | `api('getSource','svg')` → canvas → PNG dataURL |
| 持久化 | `api('readConfig'|'saveConfig', …)` + `localStorage` |
| 对话框 | `api('createDialog', {...})`（jQuery UI dialog） |

**扩展 ID 的获取**：Std 加载器不会把扩展自己的 id 传给脚本（id 是安装时用户填的）。
`core.js` 的做法是注册一个一次性探针命令，再遍历 `easyeda.extension.instances`
找出哪个实例收到了它——由此拿到 id，进而拼出 `extension-<id>-<cmd>` 命令名。

**网表算法**：`eda.js` 复刻了编辑器内部 `L.merge` / `L.createNet` 的规则——
导线是一条电气节点、引脚只接在导线端点、导线交点需要 junction、
网络标签/网络电源给节点命名；多图纸按 `sheetIndex × 1e6` 偏移坐标后合并。
当前图纸额外用编辑器的 `getWireNetName` 取权威网络名覆盖。

**单位**：原理图 1 单位 = 10 mil（0.01 inch），PCB 1 单位 = 1 mil。

---

## 离线自测

```bash
node tmp/test-eda.js      # 数据层：元件/网表/BOM/c_para
node tools/make-icons.js  # 重新生成 PNG 图标
```

`tmp/test-eda.js` 用一个模拟的编辑器 API 跑通整条数据链路，不依赖 EasyEDA 客户端。

---

## 已知限制

- 网表由本地规则重算，跨图纸的同名网络靠网络标签串联；极少数复杂接法
  （总线 bus、T 型无 junction 的交叠）可能与编辑器结果有出入，当前图纸会用
  编辑器自己的网络名做校核。
- AI 生成符号使用内置的简单符号模板（R/C/L/D/LED/SW + 通用 N 脚），
  不依赖器件库 UUID；接入真实立创器件库需要另外实现库检索。
- 「AI 生成原理图」的布局由模型给出坐标，落地后建议人工微调。
