# PRD · AI 助手（EasyEDA 标准版扩展）

> 本文档记录**完整需求与实现细节**。README 只保留关键信息，变更记录见 CHANGELOG。
> 任何新增需求或修改，需要同步更新 README（关键内容）+ PRD（细节）+ CHANGELOG（按天）。

- 产品：AI 助手（AI Assistant）
- 宿主：EasyEDA 标准版（嘉立创EDA 标准版，Std / v6 前端）
- 形态：标准版第三方扩展（本地加载，非 `.eext`）
- 当前版本：见 `extension/manifest.json`（每次 `node tools/pack.js` 末位 +1）

---

## 1. 背景与目标

EasyEDA 标准版的扩展 API 只提供「读文档 JSON / 读写图元 / 注册菜单命令」这类原子能力，
没有 AI 相关设施。本扩展把大模型接入原理图与 PCB 工作流，让工程师用自然语言完成：

- 原理图评审（网表级）
- BOM 评审与**器件属性标准化**
- PCB 与画布的视觉评审
- 按需求生成原理图（优先使用系统库真实器件）
- 用图片/文字描述生成符号

产品边界：**只支持标准版**。专业版（Pro）使用 `.eext` 与 `eda.dmt_*` 体系，两者不通用，
本扩展刻意不复用 Pro 的任何接口。

---

## 2. 关键设计决策

| 决策 | 原因 |
|---|---|
| 自绘浮层代替 `api('createDialog')` | 平台对话框是 EasyUI，默认关闭态且不加载我们的样式，曾出现"点了没反应"、样式全丢 |
| 全部样式用**内联样式** | 平台页面存在全局样式与 CSP 风险；EasyUI 自身也全用内联样式，最稳 |
| 自绘 Agent 循环 | 模型需要「调用工具取数据 → 再作答」，纯对话无法评审真实设计 |
| 网表本地重建 + 编辑器网络名校核 | 编辑器网表构造器在模块作用域不可达，但顶层命令总线暴露 `getWireNetName` 可用于校核 |
| 页面按 id 隔离命名空间 | 同一窗口可同时存在多个扩展实例（不同 ID），共享 `window.EAI` 会串配置、串会话 |
| 单个 JS 文件 ≤ 800 行 | 便于维护与 AI 上下文控制 |

---

## 3. 功能需求

### 3.1 模型接入（多供应商 / 多模型）

**数据模型**

```
{
  language, temperature, maxTokens, timeout, maxSteps, extraHeaders,
  active: { providerId, modelId },
  providers: [
    { id, name, protocol:'openai'|'anthropic', baseUrl, apiKey,
      collapsed, models:[{ id, name }] }
  ]
}
```

- **首次安装没有任何供应商**，由用户自己添加（设置页提供预设与「自定义」）
- 可**同时保存多个供应商**，每个供应商有自己的协议、地址、Key 与模型列表
- 一个供应商可保存**多个模型**
- `active` 记录面板当前使用的供应商与模型；`resolve()` 把两者拍平成运行时配置
- 旧版扁平配置（`provider/baseUrl/apiKey/model`）加载时**自动迁移**为新结构

**设置界面**：左侧导航 + 右侧详情

| 左侧 | 右侧 |
|---|---|
| 供应商与模型 | 供应商卡片列表（可折叠）：名称、协议、地址、Key、模型列表 |
| 生成参数 | Temperature / Max tokens / 超时 / 最大工具步数 / 回答语言 / 额外请求头 |
| 诊断 | 诊断信息 + 复制 |

- 「添加供应商」下拉：首项为「添加自定义供应商」（在表单里填写名称后创建），
  其余为内置预设（OpenAI / Claude / DeepSeek / 通义千问 / 智谱 / Kimi / SiliconFlow /
  OpenRouter / Ollama / Azure），选中即按预设创建
- 模型组支持「+ 新增模型」与「获取模型列表」：地址**只由用户填写的 Base URL 拼接**
  （`GET <base>/models`，与对话端点同一套归一化：结尾 `/messages`、`/chat/completions`
  换成 `/models`，无路径时补 `/v1/models`；Base URL 已以 `/models` 结尾则原样使用，
  不会替换成任何官方域名），
  拉取结果以勾选清单呈现，**已有模型自动置灰**，只添加所选
- **重复检测**：供应商名称、同一供应商下的模型名（不区分大小写）实时标红；
  保存前再次校验，重复则拒绝保存
- 配置项说明独立成行（位于控件下方），不再挤在右侧
- 「清除配置」使用**内联确认**（不使用浏览器原生 confirm，可能被禁用）
- 保存 / 取消：编辑在草稿副本上进行，取消即丢弃

### 3.2 AI 面板

结构（自上而下）：

```
[header]  logo · 品牌 + 当前文档/模型 · [日志][清空][设置]
[chat]    消息流（flex:1，可滚动）
[resize]  7px 拖动条（调整输入框高度）
[pills]   快捷功能胶囊（位于输入框上方）
[input]   圆角输入框：文本域 + 左下角图片按钮 + 右下角发送/停止
```

- 输入框**随内容增高**（最多 6 行）；拖动分隔线可手动加大，对话区同步收缩
- 图片：按钮选择 / `Ctrl+V` 粘贴 / 拖入；缩略图 + 文件名胶囊，最多 4 张，可移除
- 发送键运行中变为**红色方形停止键**；点击停止本轮（当前请求返回后结束）
- 发送键左侧有**模型切换下拉**：按供应商分组列出全部模型，切换后立即保存并生效
- **清空会话**：清 history、报告、附件与预设标记
- **工具调用过程（合并展示）**：一轮对话只有**一张**过程卡片，运行中单行动态刷新
  「正在调用工具 · 第 N 次 · 工具名」，本轮结束时折叠为
  「本轮工具调用 N 次：工具 ×次数」，点击卡片展开逐条「序号 + 工具名 + 参数」明细；
  卡片始终位于本轮回答**上方**，不产生逐条系统消息
- **问答页签（ask_user）**：模型提问时在聊天区上方弹出上拉面板，每题一个页签；
  选中答案后自动跳到下一题，已答页签显示 ✓，底部「提交（n/总）」把答案对象回填给
  模型并继续执行；「取消」或停止按钮结束提问
- 消息：用户右对齐、AI/系统/错误左对齐；头像为线性图标
- **复制**：每条 AI / 错误消息下方有复制按钮（原始 Markdown，clipboard API + execCommand 兜底）
- 弹窗可拖动标题栏移动、拖右边/下边/右下角缩放（捕获阶段监听，避免松手失效）
- 默认尺寸 400×640；窗口圆角 8px，正文默认字号 12px（标题 13px）

### 3.3 快捷胶囊

点击**只把「需求」填进输入框**，由用户决定何时发送；**流程与规则不进输入框**。
每个胶囊拆成两半：

| 部分 | 位置 | 内容 |
|---|---|---|
| `prompt` | `agent.js` 的 `AG.presets()` | 一句需求（如「请对当前原理图做一次完整的工程审查，并输出评审报告。」）；生成原理图只给需求模板 |
| `system` | `prompts.js` 的 `P.tasks[id]` | 该任务的流程与技术约束（取哪个工具、检查哪些项、分级标准…） |

发送时 `ui.js` 把 `P.tasks[id]` 以「【当前任务要求】」小节并入 system prompt；
用户之后与任务无关的提问可以忽略这段要求。按当前文档类型显示：

| 胶囊 | 动作 |
|---|---|
| 原理图审查 | 网表评审报告 |
| BOM 分析 | 物料评审报告 |
| 器件标准化 | 补齐封装/型号/供应商/料号 |
| 生成原理图 | 系统库取件 → 连线 |
| 识别符号 | 按当前消息图片生成符号 |
| PCB 审查 | 布局布线评审 |
| 截图评审 | 画布截图视觉评审 |

### 3.4 报告

- 只有**审查/分析类**功能产出报告卡片（原理图审查、BOM、器件标准化、PCB、截图评审）
- 卡片在对话流中，提供「预览报告 / 下载 Markdown / 下载 HTML」
- 预览为独立弹窗，正文 Markdown 渲染，位号可点击定位
- 正文 < 40 字符不建卡（视为异常空回复）

### 3.5 日志

- 独立非模态窗口（header 的日志按钮打开），可与对话并排
- 每条带序号，单行化（折叠换行、紧凑 JSON），可框选复制
- 底部「复制全部」「关闭」
- 打开前的日志从 `EAI.logLines` 缓冲回填

### 3.6 原理图审查（网表）

数据来源：`api('getActiveJson')` / `api('getActiveProjectAllSchJson')`（整工程多图纸）。

连通性重建规则（与编辑器一致）：

- 导线（polyline, `c_etype=wire`）是一条电气节点
- 引脚只连在导线**端点**；导线中点需要 junction
- 网络标签 / 电源端口按 pinDot 挂在导线端点上
- 多图纸用 `sheetIndex × 1e6` 偏移坐标后合并
- 当前图纸额外调用 `window.callByEditor({func:'getWireNetName', args:[pts], uuid:tabid})`
  取**编辑器权威网络名**，覆盖命名并按同名合并分组

输出给模型：**整工程一次性**的「元件→引脚→网络」总表 + 单引脚/命名冲突/未命名/电源地摘要。
格式见 3.7 工具 `get_netlist`；禁止逐网络查询（提示词与工具描述双重约束）。

### 3.7 BOM 与器件标准化

- BOM 按「封装 + 值 + 名称」分组，列出位号、数量
- **器件标准化**流程：
  1. `audit_components` 列出缺封装 / 型号 / 供应商 / 供应商编号 / 值的元件
  2. 模型结合位号、器件名、数值判断；能用系统库确认的调用 `search_library`
  3. `set_component_params` 把 `package` / `Manufacturer Part` / `Supplier` /
     `Supplier Part` 写回 `c_para`
  4. 无法确定的必须列出让用户确认，不允许臆造

### 3.8 PCB 审查与截图评审

- `get_pcb_info`：板框尺寸（mil / mm）、器件位置与层、网络与焊盘、走线/过孔/焊盘数量
- `capture_image`：`getSource{type:'svg'}` → canvas → PNG（最长边 1800px），
  作为下一条消息的图片块交给模型（同时适用于视觉评审与符号识别）

### 3.9 生成原理图

步骤（强制，一次做到结束）：

1. **先一次性问清**：电源电压/电源轨、关键 IC 型号、封装、接口与连接器脚位等，
   全部通过 `ask_user` 一次提出并等待回答；**不允许**用普通文本提问后就停下
2. **常用器件用内置模板**（不查库）：模板在 `extension/parts.js`，每个模板是一行
   **原始 LIB 源码**（目前 18 种：R/C/C_TAN/L/D/LED/Q_NPN/Q_PNP/M_NMOS/M_PMOS/
   SW/CONN2-4/HDR2X2/2X3/XTAL/XTAL4）；放置时才解码并修改坐标、位号、值、封装。
   位号写 `pre + ?`，由编辑器自动编号
3. **其余器件批量检索**：`search_library` 接受 `queries[]`，一次调用查多个型号
4. **批量放置**：`place_devices` 一次调用放完；库器件给 `uuid` + `docType`，
   内置器件给 `part`；不传 x/y 时按图框自动排版
5. **图框约束**：坐标统一夹到图纸范围内——图框本体是一个 `frame_lib` schlib 块，
   其位置给出纸张大小，没有图框时用 canvas 尺寸；越界坐标自动贴边修正
6. 系统库没有且非内置 → `create_symbol` 一次画完（不截图核对）
7. `create_wire` / `create_net_label` 连线与命名

约束：坐标单位 1 = 10 mil；完成后说明哪些来自系统库、哪些用内置模板、哪些现场生成。

### 3.10 符号生成

一次调用产出完整符号（与手画库符号一致）：

- `rect` 本体：由引脚附着点计算包围盒（最小 40×40），先于引脚绘制
- 每个引脚独立 `part_pin` 组：`configure / name / num / pinDot / path / dot / clock`
  （`dot` 与 `clock` 必须存在，否则 `bc.pin` 序列化抛错）
- 注释：`P`（位号，默认 `U?`）、`N`（名称）
- `head.c_para`：`name` / `package` / `pre` / `value` / `Manufacturer Part` /
  `Manufacturer` / `Supplier` / `Supplier Part`
- **符号库文档**：额外用 `editorCall('setCustomPara', [key, value])` 写入**文档级** c_para
  （库列表展示的是文档头，不是元件组）

### 3.11 多语言（全量）

- `locale.txt`：`[en]` / `[zh-cn]`（编辑器会把 `zh-cn` 归一到 `zh-hans`），
  供菜单项、工具栏按钮、弹窗标题通过 `U.t(key, '中文默认')` 取词
- **界面正文**由 `i18n.js` 在渲染时翻译：
  - `EAI.i18n.map`：中文 → 英文的精确字典（按钮、标签、提示、关于页等）
  - `EAI.i18n.rules`：带变量的消息用正则规则（如「已定位 R1」→「Located R1」）
  - `EAI.i18n.apply(el)`：遍历文本节点与 `placeholder` / `title` 属性做替换
  - `EAI.i18n.watch(el)`：`MutationObserver` 监听对话框，新增消息/胶囊/状态自动翻译
- 语言判定：`EAI.lang()` 读 `Locale._curr`，未知时按中文处理
- 未命中字典的文案保持中文（优雅降级）；新增文案需同步补词条

---

## 4. Agent 与工具规范

### 4.1 循环

```
[system + 历史 + 本轮] → 模型(带 tools) → tool_calls → 执行工具 → 回填 tool 消息
      ↑                                                        │
      └────────────── 直到无 tool_calls 或达到步数上限 ──────────┘
```

- **提示词集中管理**：角色与全局规则（`P.system`）、胶囊任务要求（`P.tasks`）、
  循环催办（`P.nudges`）全部放在 `prompts.js`，改提示词不需要动业务代码
- 每步只发一次非流式请求（兼容性优先，第三方网关差异大）
- 工具结果以文本回填；图片类工具改为**下一条消息附图片**
- **消息 content 兼容两种形态**：分段数组（`[{type:'text'|'image',…}]`）或纯字符串；
  整形函数统一归一化，任何一段代码都不会对字符串调 `.map()`
- **无工具请求折叠工具回执**：收敛 / 步数上限后的最后一次 `chat()` 不带 `tools`，
  此时 `role:'tool'` 消息改写成 user 文本（`[tool 名称] + 结果`），
  既避免"孤儿 tool 消息"被服务端 400，也保证模型仍看得到已取到的数据
- **空回复追问**：用过工具但最终无正文时，自动追加"直接给出最终结论"再请求一次
- **工具收敛**：单轮累计达到「最大工具调用次数」（默认 80，可配置）后禁用工具并强制总结；
  批量工具（`place_devices`、`search_library` 的 `queries[]`）让上百个元件也只占少量额度
- **步数上限**：默认 40 步（每步一次模型请求），到达上限时再补一次"无工具"请求；
  仍无正文则提示用户调大步数
- **等待用户**：`ask_user` 工具会挂起循环，等用户在问答面板提交后把答案作为工具结果
  回填，然后继续同一次运行（不需要用户再发一条消息）
- HTTP 200 但返回 `{error:…}` 的网关错误会被识别并抛出
- `tools` 字段被网关拒绝（400/404/422 且含 tool 关键字）时，降级为无工具重试

### 4.2 工具清单

| 工具 | 作用 | 主要参数 |
|---|---|---|
| `get_document_info` | 文档类型/标题/规模 | — |
| `get_components` | 元件或封装列表 | withPins |
| `get_netlist` | 整工程网表（元件→引脚→网络）+ 摘要 | maxComponents |
| `get_bom` | 物料清单 | — |
| `get_pcb_info` | 板框/器件/网络/统计 | — |
| `capture_image` | 截图并附到下一条消息 | — |
| `locate_component` | 选中并高亮位号 | designator |
| `set_component_value` | 改单个参数值 | designator, value, parameter |
| `set_component_designator` | 改位号 | designator, newDesignator |
| `audit_components` | 找出属性不全的元件 | — |
| `set_component_params` | 批量写 c_para | designator + 各属性 |
| `search_library` | 系统库**批量**检索 | queries[]（最多 20）, limit |
| `place_device` | 放置单个系统库器件 | uuid, docType, x, y |
| `place_devices` | **批量**放置（库器件或内置件，自动排版+图框约束） | placements[] |
| `place_part` | 内置 R/C/L/D/LED/SW/Q_NPN/Q_PNP/M_NMOS/M_PMOS/XTAL/连接器/通用件 | part, x, y, value… |
| `delete_components` | 删除元件或图元（按位号 / gId） | designators[], ids[] |
| **`place`** | 放置元件（统一入口，一次多个；库器件或内置件，自动排版+编号） | items[] |
| **`draw`** | 画导线 / 放网络标签（自动吸附到引脚或导线端点） | wires[], net_labels[] |
| **`update_component`** | 批量改值 / 属性 / 位号 | edits[] |
| `place_part` / `place_device` / `place_devices` / `create_wire` / `create_net_label` / `set_component_*` | 兼容保留，不再对模型暴露 | — |
| `ask_user` | 一次提出多个问题并等待回答 | questions[{id,text,options[]}] |
| `create_wire` | 画导线 | points[] |
| `create_net_label` | 放网络标签 | x, y, name |
| `create_symbol` | 生成完整符号（兜底） | name, package, pins[], manufacturerPart… |

工具按文档类型裁剪：`sch/schlib` 拿到原理图与符号类；`pcb` 拿到 PCB 类；只读类始终可用。

---

## 5. 技术附录

### 5.1 使用的 Std 扩展 API

| 能力 | API |
|---|---|
| 菜单 / 工具栏 / 命令 | `createExtensionMenu` / `createToolbarButton` / `createCommand` |
| 读文档 | `getActiveJson`、`getSource`、`getActiveProjectAllSchJson` |
| 图元读写 | `getShape` / `updateShape` / `createShape` |
| 帧内命令 | `editorCall({cmd,args})`（如 `select`、`highlightItems`、`setCustomPara`） |
| 跨窗口命令 | `window.callByEditor({func,args,uuid})`（`getWireNetName` 只在这里） |
| 配置 | `readConfig` / `saveConfig` |
| 资源 | `getRes` |

### 5.2 数据模型要点

- `c_para`：反引号分隔的键值串，`BOM_` 前缀在解析时剥离，写入时忽略 `attr-` 键
- 元件块：`head`（`gId/x/y/rotation/c_para/locked/…`）+ 各图元 map + `itemOrder`
- 位号 = `annotation` 里 `mark==='P'` 的字符串；名称/值 = `mark==='N'`；封装 = `c_para.package`
- 引脚 JSON 必须含 `dot` / `clock` / `configure.locked`
- 坐标：原理图 1 单位 = 10 mil；PCB 1 单位 = 1 mil

### 5.3 扩展 ID 探测

加载器不会把扩展 ID 传给脚本，而命令名必须带它（`extension-<id>-<cmd>`）：

1. **探针优先**：对每个候选 id 注册 `extension-<候选>-__eai_probe__`，
   `createCommand` 会丢弃不匹配前缀的键 → 唯一存活者即真实 ID
2. 兜底：取**最新**的、`manifest.scripts` 含 `core.js` 的实例

（先扫 manifest 会在"移除扩展→换 ID 重载"时命中旧实例，导致命令注册到旧 ID、菜单点了没反应。）

---

## 6. 非功能需求

- **安全**：API Key 只保存在本机（扩展配置 + localStorage），除用户配置的模型接口外不外发
- **隐私**：仅在执行审查/生成时把设计数据发送给所选模型
- **CORS**：Electron `webSecurity: true`，第三方网关必须允许跨域；失败给出明确提示
- **上下文**：网表与工具输出均有上限（网表 24k 字符、元件 300、BOM 200 行），避免撑爆
- **可维护性**：单文件 ≤ 800 行；文档三件套同步更新

---

## 7. 构建与发布

```bash
node tools/pack.js                  # 版本末位 +1，产出目录 + zip
node tools/pack.js --version 0.1.0  # 指定版本
node tools/pack.js --no-zip         # 只产出解压目录
node tmp/test-*.js                  # 离线测试（本地开发脚本，不入库）
```

- 产物（`dist/`，不入库）：
  - `dist/ext-easyeda-std-ai-assistant-v<版本>/` —— 解压目录，本地加载用
  - `dist/ext-easyeda-std-ai-assistant-v<版本>.zip` —— Release 附件，文件位于 zip 根目录
- zip 由 `pack.js` 内置实现（zlib + 手写中央目录），不依赖系统 `zip`，Windows / CI 通用
- **扩展 ID 不进入产物**：安装时由用户自行填写，运行时由 `discoverExtId()` 探测；
  命令名与本地配置以该 ID 为键，所以安装后不要改
- `manifest.json` 的 `version` 是唯一版本来源，运行时从加载的清单读取（关于页/诊断显示）
- 发布：GitHub Actions → `Release` → Run workflow（版本可选），构建并创建 `v<版本>`
  Release，附上 zip

---

## 8. 文档维护约定

任何新增需求、行为变更、修复都要同步：

1. `README.md`：保持"关键内容"（定位、安装、快速使用、文档索引）
2. `PRD.md`：补充/修改细节（功能、接口、约束）
3. `CHANGELOG.md`：**按天**记录，写当天最新版本号与合并提炼后的关键变更

---

## 9. 已知限制与后续

- 网表的跨图纸连接依赖网络标签；极复杂 bus / 无 junction 交叠可能与编辑器有出入（当前图纸会校核）
- 系统库检索依赖登录态；失败时自动退回 `create_symbol`
- 内置符号库只有 R/C/L/D/LED/SW/通用件
- 语言判定：读 `Locale._curr`，**未知时按英文处理**；未命中英文字典的文案回退为中文
  （新增文案时记得补 `i18n.js` 词条，否则该条仍显示中文）
- 后续可做：DRC 结果接入、封装/3D 检查、库内符号批量校对、完整 i18n
