# 嘉立创EDA标准版 扩展开发指南

> 面向想为 **嘉立创EDA标准版（EasyEDA Std，v6 前端）** 开发本地扩展的开发者。
> 本文按「运行模型 → 包结构 → API → 数据模型 → UI → 网络 → 配置 → 国际化 →
> 限制与坑 → 实践建议」组织，附录 A 是全量 API 参考，附录 B 是文件格式字段参考。
> 内容自足，可单独作为开发手册使用，无需再对照其他文档。

- 适用对象：标准版（Std）扩展与用户脚本
- 不适用：专业版（Pro）。Pro 使用 `.eext` 打包与 `eda.dmt_*` 对象体系，
  与标准版扩展不通用，本文不涉及。
- 文档结构：1–13 章为开发指南（含完整示例），14–15 章为速查附录，
  16 章说明与官方资料的对应关系。

---

## 1. 平台与运行模型

### 1.1 扩展形态

标准版扩展是**一组本地文件**（`manifest.json` + 若干脚本 + 图标 + 语言文件），
用户在客户端里通过「扩展配置 → 加载扩展」选中全部文件后安装，
**不是** `.eext` 压缩包，也没有 npm / 构建工具要求。

### 1.2 执行环境

宿主把 `manifest.json` 中 `scripts` 列出的每个文件依次执行，执行方式等价于：

```js
(function (api, $, Locale) {
	/* 你的脚本内容 */
})(api, jQuery, Locale);
```

因此脚本里可以直接使用：

| 名称 | 说明 |
|---|---|
| `api` | 宿主 API 函数，签名 `api(name, ...args)` |
| `$` | 页面全局 jQuery（标准版使用 1.8.x，EasyUI 依赖它） |
| `Locale` | 宿主语言对象，`Locale._curr` 为当前语言（如 `zh-hans` / `en`） |

脚本运行在**顶层窗口**，`window` 是共享的。多个扩展实例同时存在，所以务必用
自建命名空间，不要污染全局：

```js
var MY = (window.MYEXT = window.MYEXT || {});
```

### 1.3 生命周期

- 扩展脚本在页面加载时执行一次；**新增/移除扩展、启用/禁用后需要刷新页面**才生效。
- 脚本执行时文档可能尚未打开：不要假设 `getActiveJson()` 一定返回内容，
  要处理「未打开文档」的情况。
- 没有「卸载」回调。清理工作（关闭自己的弹窗、停掉定时器）应在扩展被移除时
  靠页面刷新自然完成。

### 1.4 多实例与命名空间

同一页面可以同时加载多个扩展，甚至同一扩展的不同 ID 实例。任何**全局变量、
localStorage key、命令前缀**都必须带自己的标识：

```js
var CFG_KEY = 'myext.config.v1.' + myExtensionId;
```

### 1.5 用户脚本（不打包成扩展）

只想跑一次或临时调试时，不必安装扩展：**高级 → 扩展 → 运行脚本 / 加载脚本**，
把代码贴进编辑器执行即可，脚本环境同样能使用 `api(...)`。

| 方式 | 适合 |
|---|---|
| 运行脚本 | 临时改一批属性、批量放置图元、验证 API 返回值 |
| 加载脚本 | 让脚本常驻在「用户脚本」列表，随时重复运行 |
| 扩展 | 需要菜单、工具栏、配置、面板等持久入口时 |

用户脚本没有 manifest，因此**不能注册菜单按钮**；需要持久入口请做成扩展。
调试技巧：先 `getSource({type:'json'})` 拿到真实结构，改完用
`applySource({source, createNew:true})` 在一份新文档里验证，避免破坏原工程。

---

## 2. 扩展包结构

### 2.1 文件清单

| 文件 | 必需 | 作用 |
|---|---|---|
| `manifest.json` | 是 | 清单：名称、版本、图标、语言文件、脚本顺序 |
| `locale.txt` | 否 | 宿主菜单/按钮/标题的多语言词条 |
| `icon.svg` | 否 | 扩展图标（推荐 SVG，可同时提供 png） |
| `*.js` | 是 | 扩展逻辑，按 `scripts` 顺序执行 |
| `README` / 说明 | 否 | 安装说明等，加载器会忽略非脚本文件 |

### 2.2 manifest.json

```json
{
	"name": "AI 助手",
	"description": "扩展列表里显示的一句话描述",
	"version": "0.0.36",
	"icons": { "default": "icon.svg" },
	"locale": "locale.txt",
	"scripts": ["core.js", "main.js"]
}
```

规则：

- `scripts` 顺序即执行顺序，被依赖的模块（命名空间、工具函数）放前面。
- `version` 是唯一版本来源，运行时可以在你自己的「关于/诊断」里展示它。
- 图标文件名必须与 `icons` 一致；安装时用户要**全选所有文件**，缺一个都会加载失败。

### 2.3 locale.txt

宿主 `Locale` 直接读取的键值文件，供菜单项、工具栏按钮、弹窗标题取词：

```
[en]
myext.menu.root=My Extension
myext.menu.panel=Open panel...
[zh-cn]
myext.menu.root=我的扩展
myext.menu.panel=打开面板...
```

- 章节名是语言标识，中文用 `[zh-cn]`（编辑器会归一到 `zh-hans`）。
- 取值：`Locale.i18n('myext.menu.root')`，取不到时返回 key 本身，
  所以代码里要带默认值：

```js
function t(key, fallback) {
	try {
		var v = Locale && Locale.i18n && Locale.i18n(key);
		if (v && v !== key) return v;
	} catch (e) { /* ignore */ }
	return fallback || key;
}
```

### 2.4 脚本写法

- 标准版客户端内核较老：**只用 ES5 语法**（`var` / `function`），
  避免箭头函数、`let/const`、模板字符串、可选链。
- 每个文件建议用 IIFE 包裹，避免变量泄漏到全局。
- 单个文件不要过长（建议 ≤ 800 行），拆文件后在 `manifest.json` 里追加。

---

## 3. 安装、升级、移除

### 3.1 安装

1. 客户端：**高级 → 扩展 → 扩展配置 → 加载扩展**
2. **一次性全选**扩展目录下的全部文件（不能放子目录）
3. 填写**扩展 ID**（`\w+`，例如 `myext`）——它会成为命令名前缀
4. 确认后刷新页面

### 3.2 扩展 ID 与命令前缀

`createCommand` 只接受键名为 `extension-<扩展ID>-<命令名>` 的条目，
**前缀不匹配的键会被静默丢弃**（不报错）。因此：

- 命令名必须自己拼接：`'extension-' + extId + '-' + name`
- 如果 ID 填错，表现是「菜单/按钮在，但点了没反应」

运行时 ID 探测（多实例或换 ID 重装时用）：

```js
var insts = (window.easyeda && window.easyeda.extension &&
	window.easyeda.extension.instances) || {};
var ids = Object.keys(insts);

/* 为每个候选 ID 注册一条探针命令，只有真实 ID 的键会存活 */
var MARK = '__probe__';
ids.forEach(function (cand) {
	var c = {};
	c['extension-' + cand + '-' + MARK] = function () {};
	api('createCommand', c);
});
/* 再检查哪个实例的 commands 里出现了 MARK → 那就是真实 ID */
```

注册完成后记得删掉探针键，避免污染命令表。

### 3.3 升级与移除

- 升级：先「移除」旧扩展，再用**同一个 ID** 加载新文件，然后刷新页面。
  用不同 ID 重装会让旧实例残留在 `instances` 里。
- 移除扩展**不会**删除你写进 `readConfig`、`localStorage` 的数据。
  敏感配置请提供「清除配置」按钮（不要依赖浏览器原生 `confirm`，可能被禁用，
  用内联确认）。

---

## 4. API 参考

所有 API 通过 `api(name, ...args)` 调用，同步返回。`name` 区分大小写。

### 4.1 createCommand

```js
api('createCommand', {
	'extension-myext-open': function () { /* ... */ },
	'extension-myext-about': function () { /* ... */ }
});
```

| 参数 | 说明 |
|---|---|
| 第一个参数 | 对象：命令全名 → 处理函数 |

**注意**

- 键名必须是 `extension-<ID>-<name>`，不匹配的前缀会被丢掉，且**不会报错**。
- 建议在脚本加载时统一注册；之后再注册同名命令可能被忽略。

### 4.2 createExtensionMenu

```js
api('createExtensionMenu', [{
	text: '我的扩展',
	fordoctype: 'all',
	submenu: [
		{ text: '打开面板…', cmd: 'extension-myext-open' },
		{ text: '设置…', cmd: 'extension-myext-settings' }
	]
}]);
```

| 字段 | 说明 |
|---|---|
| `text` | 菜单文字 |
| `fordoctype` | 在哪些文档类型出现：`all` 或 `sch,pcb,schlib,pcblib` |
| `submenu` | 子项数组，每项 `{ text, cmd }`（`cmd` 为命令全名） |

**建议**：把功能都收进**一个**子菜单条目。否则标准版会把每个子项平铺在
「高级」菜单一级，条目一多就很难找。

### 4.3 createToolbarButton

```js
api('createToolbarButton', {
	icon: api('getRes', 'icon.svg') || '',
	title: '我的扩展',
	text: '我的扩展',
	fordoctype: 'sch,pcb,schlib,pcblib',
	cmd: 'extension-myext-open',
	menu: [ { text: '设置…', cmd: 'extension-myext-settings' } ]
});
```

| 字段 | 说明 |
|---|---|
| `text` | 按钮文字（缺省时只显示图标） |
| `icon` | 图标内容（通过 `getRes` 读扩展内文件） |
| `cmd` | 点击执行的命令全名 |
| `menu` | 可选：右键/下拉菜单项 |

> **注意（V6）**：顶部工具栏在 V6 已从「图标菜单」改为「文字菜单」，
> **不再提供扩展自定义按钮的展示位**。也就是说 `createToolbarButton` 在 V6 上
> 基本不起作用——调用不报错，但工具栏里看不到你的按钮。
> 功能入口请以 `createExtensionMenu`（「高级」菜单）为准；
> `createToolbarButton` 仅用于兼容旧版客户端。

### 4.4 createDialog（不建议用于自绘 UI）

```js
var dlg = api('createDialog', { title: 'T', width: 600, height: 480, content: '<div>…</div>' });
dlg.dialog('open');   // ⚠ 新建时是关闭状态
```

**问题**：返回的是 EasyUI 对话框，**默认是关闭的**；宿主的全局样式会覆盖你的
样式（且存在 CSP 风险）。需要现代外观与完整控制时，建议自绘浮层（见第 6 章）。

### 4.5 文档读取

| API | 返回 | 说明 |
|---|---|---|
| `api('getActiveJson')` | object | 当前文档的 JSON |
| `api('getActiveFileTitle')` | string | 当前文件名/标题 |
| `api('getActiveProjectAllSchJson')` | object | 整工程多图纸：`{ schematics: [{ tabid, title, json }] }` |
| `api('getSource', { type: 'svg' })` | string | 当前文档的 SVG 源码（可用于截图） |

```js
var doc = api('getActiveJson');
if (!doc) { /* 未打开文档 */ }
```

**坑**：没有打开的文档、或文档类型不匹配时可能返回空对象/`null`，
所有读取都要有空值分支。

### 4.6 图元读写（getShape / updateShape / createShape）

```js
/* 读：按 gId（官方文档里也叫 id） */
var obj = api('getShape', { id: 'gge13' });

/* 改：必须同时给 shapeType 与 gId/jsonCache */
api('updateShape', {
	shapeType: 'PAD',
	jsonCache: { gId: 'gge5', net: 'GND', shape: 'ELLIPSE' }
});

/* 建：直接给字段 / 用 jsonCache / 用库器件 */
api('createShape', { shapeType: 'arrowhead', x: 300, y: 300, color: '#339933', size: '3', rotation: 0 });
api('createShape', { shapeType: 'schlib', shortUrl: 'nxlVIGgQO', from: 'system', title: '556_DIL14', x: 400, y: 300 });
api('createShape', { shapeType: 'schlib', from: 'EasyEDALibs', title: 'HDR2X2', x: 400, y: 300 });
```

**shapeType 速查（官方清单）**

| 文档 | shapeType |
|---|---|
| 原理图 | `schlib` `rect` `polyline` `polygon` `wire` `bus` `image` `circle` `ellipse` `line` `path` `arc` `annotation` `junction` `netlabel` `busentry` `arrowhead` `noconnectflag` `pin` `netflag` |
| PCB | `FOOTPRINT` `TRACK` `COPPERAREA` `SOLIDREGION` `RECT` `CIRCLE` `TEXT` `ARC` `DIMENSION` `PAD` `VIA` `HOLE` |

要点：

- `updateShape` 的 `shapeType` 与 `jsonCache.gId` 必填；只给要改的字段即可，其余保留。
- 放置库器件可以用 `shortUrl` / `from` + `title`，也可以用库返回的 `uuid` + `docType`
  （`createShape({ shapeType: 'schlib', uuid, docType })`）；
  后者的好处是能保留封装、BOM 与供应商信息。
- 复合图元（`schlib`）可以传 `head` + `itemOrder` + 各图元表，或 `children` 数组，
  由 `createShape('pin'|'polyline'|'annotation', {...})` 逐个生成。
- 原理图里还有一组预定义网络标签：`netLabel_VCC`、`netLabel_GnD`、`netLabel_GND`、
  `netLabel_+5V`、`netLabel_-5V`、`netLabel_VEE`、`netLabel_Bar`、`netLabel_netPort` 等。
- 不要只构造局部对象整体写回，序列化器会读取大量字段（见第 5 章）。
- 旧脚本风格里还有 `api('insertShape', [{ shapeTypeName: 'path', … }])`，
  新代码建议统一用 `createShape`。

### 4.7 配置读写

```js
/* 读：按扩展 ID 分桶 */
var raw = api('readConfig', 'config');       // 字符串
var cfg = raw ? JSON.parse(raw) : {};

/* 写：外层键是扩展 ID，内层是配置 key */
var payload = {};
payload[extId] = {};
payload[extId]['config'] = JSON.stringify(cfg);
api('saveConfig', payload);
```

- `saveConfig` 的 payload 形如 `{ [扩展ID]: { [key]: 字符串 } }`。
- 配置是**字符串**，自己负责 `JSON.parse` / `JSON.stringify`。
- 数据会按扩展 ID 隔离；换 ID 相当于换一份配置。

### 4.8 资源

```js
var svg = api('getRes', 'icon.svg');   // 读取扩展目录内的文件内容
```

用于把图标内容塞进工具栏按钮，或在弹窗里显示图片。

### 4.9 editorCall（帧内命令）

```js
api('editorCall', { cmd: 'select', args: [uuid] });
api('editorCall', { cmd: 'highlightItems', args: [[uuid]] });
api('editorCall', { cmd: 'setCustomPara', args: ['Manufacturer Part', 'STM32F103C8T6'] });
```

- 用于执行编辑器自身的命令（选中、高亮、写文档级属性等）。
- 具体可用命令名与参数随编辑器版本变化，调用前建议包一层 try/catch。

### 4.10 window.callByEditor（跨窗口命令）

编辑器部分能力（例如按坐标求网络名）只暴露在顶层命令总线上：

```js
var name = window.callByEditor({ func: 'getWireNetName', args: [points], uuid: tabId });
```

- `uuid` 是文档页签 id（多图纸时用于指定图纸）。
- 返回结构由命令决定，可能为空；必须有兜底逻辑。

---

### 4.11 文档源：读取与整体写回（getSource / applySource）

```js
var json = api('getSource', { type: 'json' });       // 可读的 JSON 对象
var comp = api('getSource', { type: 'compress' });   // 数据库里保存的压缩串
var svg  = api('getSource', { type: 'svg' });        // SVG 源码（截图 / 导出）

api('applySource', { source: json, createNew: false });  // 改当前文档
api('applySource', { source: comp, createNew: true });   // 新开一个编辑器
```

- 批量改属性（统一线宽、过孔孔径等）用 `getSource → 改字段 → applySource` 最省事。
- `createNew: true` 会**新开**一个编辑器并载入内容，`false` 则替换当前文档。
- `applySource` 是整体替换，执行前最好校验字段并提示用户（或先备份）。

### 4.12 批量图元操作

```js
api('clone', { ids: ['gge2', 'gge3'] });          // 返回新 gId 数组
api('delete', { ids: ['gge2'] });
api('rotate', { ids: ['gge2'], degree: 90 });
api('rotate_left', { ids: ['gge2'] });            // 逆时针
api('rotate_right', { ids: ['gge2'] });           // 顺时针
api('fliph', { ids: ['gge2'] });
api('flipv', { ids: ['gge2'] });
api('align_left', { ids: ['gge2', 'gge3'] });     // align_right / align_top / align_bottom
api('moveObjs', { objs: [{ gId: 'gge2' }, 'gge3'], addX: 20, addY: 20 });  // 相对移动
api('moveObjsTo', { objs: ['gge2'], x: 20, y: 20 });                       // 绝对移动
```

- `objs` 可以省略：省略时作用于当前选中对象。
- 位移单位是**画布坐标**（见 4.14），不是 mil/mm。

### 4.13 选择状态

```js
api('select', { ids: ['gge2', 'gge3'] });
api('selectNone');
var ids = api('getSelectedIds');   // 当前选中对象的 gId 数组
```

### 4.14 坐标系统与单位换算

标准版有「画布坐标」与「真实坐标」两套：画布 **1 像素 = 10 mil**（PCB 常用单位），
原点可以通过 API 映射。

```js
api('setOriginXY', { x: 400, y: 300 });   // 把真实原点映射到画布 (400, 300)

api('coordConvert', { type: 'real2canvas', x: '10mm', y: '10mm' });
api('coordConvert', { type: 'canvas2real', x: 400 });

api('valConvert', { type: 'real2canvas', val: '20mil' });   // 尺寸换算
api('valConvert', { type: 'canvas2real', val: 400 });

api('getSvgArcPathByCRA', { cx: 0, cy: 0, rx: 90, ry: 90, startAngle: 0.1, endAngle: 0.7, sweepFlag: 1 });
```

- 支持的单位：px / mil / mm / inch；不写单位时按画布单位处理。
- 不涉及用户单位时，直接 `画布值 × 10 = mil` 即可，省掉换算调用。
- 旧脚本里还能看到 `api('edit.unitConvert', { type: 'mil2pixel', value: 10 })`，等价换算。

## 5. 文档数据模型

> **文件格式的权威说明**：<https://github.com/easyeda/easyeda-std-file-format>
> —— 包含通用格式、原理图/PBC 图元、各 docType 文件结构以及完整示例 JSON。
> 本章讲扩展开发时最常打交道的部分；**全量字段速查见附录 B（第 15 章）**。

**docType 对照**

| docType | 文档类型 |
|---|---|
| 1 | 原理图 |
| 2 | 原理图符号（Symbol） |
| 3 | PCB |
| 4 | PCB 封装（Footprint） |
| 5 | 原理图工程（多页原理图） |

**文件是 JSON，但图元字段用分隔符压成字符串**（这也是处理 `c_para`、引脚、
封装内部图元时必须按分隔符切分的原因）：

| 分隔符 | 用途 |
|---|---|
| `~` | 分隔属性字段 |
| `` ` `` | 分隔自定义属性键值对 |
| `^^` | 连接复合图元段（Pin、Netflag、PAD） |
| `#@$` | 连接器件/封装内部图元 |

### 5.1 原理图 / 符号文档

顶层是一个对象，按类型分表存图元，另有一个绘制顺序表：

```
{
	head:        { ... },
	annotation:  [ ... ],      // 位号/名称等标注
	wire:        { ... },      // 导线
	netlabel:    { ... },      // 网络标签
	netflag:     { ... },      // 电源/地符号
	schlib:      { ... },      // 元件（符号）块
	rect/polygon/text/... 
	itemOrder:   [ ... ]       // 绘制顺序
}
```

元件块的典型结构：

```
{
	head: { gId, x, y, rotation, c_para, locked, ... },
	annotation: { P: 'R1', N: '10k', ... },
	... 该元件的图元（rect / part_pin / text）,
	itemOrder: [ ... ]
}
```

- **位号**：`annotation` 中 `mark === 'P'` 的值
- **名称/值**：`mark === 'N'`
- **封装**：`c_para.package`

### 5.2 c_para

反引号分隔的键值串，例如：

```
package`0603`value`10k`Manufacturer Part`RC0603FR-0710KL`
```

- 读取时 `BOM_` 前缀会被剥离（`BOM_Supplier` 与 `Supplier` 等价）。
- 写入时忽略以 `attr-` 开头的键。
- 器件标准化时常用的键：`package`、`Manufacturer Part`、`Manufacturer`、
  `Supplier`、`Supplier Part`。

### 5.3 引脚（part_pin）

````
{
	configure: { locked: false, ... },
	name: 'VCC',
	num: '1',
	pinDot: { ... },
	path:   { ... },
	dot:    { visible: true, ... },
	clock:  { visible: false, ... }
}
````

**必需字段**：`dot`、`clock`、`configure.locked`。缺任何一个，
序列化时会抛 `Cannot read properties of undefined`。

### 5.4 坐标与单位

| 文档 | 1 单位 = | 建议 |
|---|---|---|
| 原理图 | 10 mil | 取 10 的整数倍，器件间距 ≥ 40 |
| PCB | 1 mil | 直接用 mil 计算 |

### 5.5 连通性（网表）规则

标准版的电气连通与编辑器保持一致：

- 一条**导线**是一个电气节点；
- 引脚只连接在导线**端点**；连接在导线中点需要放置 junction；
- 网络标签 / 电源符号按 pinDot 挂在导线端点上；
- 多图纸合并时用 `sheetIndex × 1e6` 对坐标做偏移，避免不同图纸坐标重叠；
- 当前图纸可再用 `window.callByEditor({ func: 'getWireNetName' })`
  取得编辑器权威网络名，用于校核自建网表。

### 5.6 PCB 文档

PCB 的 JSON 结构与原理图不同：器件为封装块，含位置、层、旋转；
网络与走线分表存放。需要统计板框、器件、网络、走线/过孔数量时，
建议遍历顶层表而不是依赖单一字段名，并对空表做保护。

---

## 6. UI 开发

### 6.1 为什么自绘弹窗

`createDialog` 的默认关闭状态 + EasyUI 全局样式 + CSP 风险，使自绘浮层更可控：

```
遮罩(position:fixed; inset:0; z-index 高)
  └─ 卡片(圆角、阴影、flex 列布局)
       ├─ 标题栏(可拖动)
       ├─ 内容区(滚动，可选中文本)
       └─ 缩放柄(右/下/右下)
```

### 6.2 内联样式与转义

宿主会覆盖外部 CSS；稳妥做法是**全部内联样式**，并写一个转换函数：

```js
function st(obj) {
	var out = [];
	for (var k in obj) {
		if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
		var name = k.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); });
		var val = String(obj[k]).replace(/"/g, '&quot;');   // ← 关键
		out.push(name + ':' + val);
	}
	return out.join(';');
}
```

**坑**：内联 `style` 属性由双引号包裹，值里再出现双引号（例如
`font-family:"Courier New"`）会截断整个 style 属性，后面的样式全部失效。
字体名用单引号，或统一走 `st()` 转义。

### 6.3 拖动与缩放的三个要点

1. **捕获阶段监听**：`window.addEventListener('mousemove', fn, true)`，
   避免子元素 `stopPropagation` 后松手事件丢失。
2. **遮罩吞指针**：非模态弹窗的遮罩通常是 `pointer-events:none`，
   拖动时鼠标一旦离开卡片就会落进编辑器 iframe，`mouseup` 回不到本窗口，
   表现为「拖拽卡死」。拖动期间把遮罩临时改为 `pointer-events:auto`，松手还原。
3. **绝对坐标计算**：缩放用 `getBoundingClientRect()` 的绝对位置算宽高，
   不要累加 `mousemove` 的增量，避免漂移；同时清掉 `max-width/max-height` 限制。

### 6.4 尺寸与自适应

- 面板类弹窗默认 400×640 比较合适；
- 内容较短的弹窗（关于页等）用**高度自适应**（`height:auto` + `max-height:92vh`），
  固定高度容易出现滚动条；
- 内容区 `overflow-y:auto; overflow-x:hidden`：横向滚动条会压住底部缩放手柄。

### 6.5 富文本

模型输出通常是 Markdown：建议自己实现一个最小渲染器（标题、列表、代码、
表格、粗体、链接），或者先转义再按需替换，**不要**直接 `innerHTML` 未转义内容。

---

## 7. 网络与跨域

### 7.1 运行环境

标准版客户端是 Chromium（Electron / 浏览器页面），`webSecurity` 开启，
页面发起的请求受 CORS 约束。

### 7.2 CORS

- 第三方网关/自建服务必须返回 `Access-Control-Allow-Origin`，
  并允许你的请求头（`Authorization`、`x-api-key` 等）。
- 预检失败时的表现是请求被浏览器拦截，`fetch` 抛 `TypeError`，
  请给用户明确提示（「接口需允许跨域」），而不是只报「网络错误」。

### 7.3 本地服务

请求 `http://127.0.0.1:端口` 会触发浏览器的**本地网络访问**权限，
Chromium 内核版本较新时可能被拦截，表现为请求长时间挂起。
调试时建议把本地服务换成一个可被允许的来源，或在浏览器里手动放行。

### 7.4 流式与非流式

- 流式（SSE）：体验好，但不同网关实现差异大（`data:` 分块、`[DONE]` 标记、
  错误帧格式），解析要容错。
- 非流式：兼容性最好，推荐作为默认；长回答也不容易因为连接空闲被中断。

### 7.5 超时与取消

```js
var ctrl = new AbortController();
var timer = setTimeout(function () { ctrl.abort(); }, 300 * 1000);
fetch(url, { method: 'POST', headers: h, body: b, signal: ctrl.signal })
	.finally(function () { clearTimeout(timer); });
```

用户点「停止」时 `ctrl.abort()`，并把 UI 的 busy 状态复位。

### 7.6 安全

- API Key 放扩展配置 / localStorage，**不要**写进脚本或提交到仓库；
- 只把设计数据发往用户自己配置的地址；
- 不要动态注入远程脚本。

---

## 8. 配置与持久化

### 8.1 存储位置

| 位置 | 生命周期 | 用途 |
|---|---|---|
| `api('saveConfig')` | 与扩展 ID 绑定 | 正式配置（可跨会话） |
| `localStorage` | 与页面同源 | 快速读写、缓存；建议 key 带扩展 ID |

推荐**双写**：`saveConfig` 作为权威来源，`localStorage` 作为快速读取与兜底。

### 8.2 结构与迁移

配置必须有版本或可探测的结构，升级时自动迁移：

```js
function migrate(c) {
	if (!c) return defaults();
	if (!Array.isArray(c.providers)) {          // 旧结构 → 新结构
		return {
			providers: c.baseUrl ? [{ baseUrl: c.baseUrl, apiKey: c.apiKey }] : [],
			active: { providerId: '', modelId: '' }
		};
	}
	return c;
}
```

### 8.3 敏感信息

- 配置是明文存储的，UI 上要把 Key 显示为密码框；
- 提供「清除配置」入口（内联确认）；
- 移除扩展不会清除数据，要在文档里说明。

---

## 9. 国际化

### 9.1 宿主文案

菜单、工具栏按钮、弹窗标题在 DOM 出现前就要取词，走 `locale.txt` + `Locale.i18n`
（见 2.3）。

### 9.2 自绘 UI 文案

自绘 DOM 由自己渲染，可以选择：

1. 中文写在代码里 + 英文词典在渲染时替换（字典 + 正则规则 + `MutationObserver`）；
2. 或用 `t(key)` 双语文案直接在生成 HTML 时取词。

方案 1 的好处是新增文案时即使忘了补词条也能正常显示中文，属于优雅降级；
但要保证**文本节点与 `placeholder`/`title` 属性**都被覆盖。

### 9.3 语言判定

```js
var lang = (Locale && Locale._curr) || 'en';   // 未知时按英文处理
```

语言切换后菜单不会热更新（需要刷新页面），弹窗正文可以实时翻译。

---

## 10. 限制与约束

- 没有文件系统、没有 shell：只能通过 `api` 与页面能力工作；
- 不能修改宿主核心代码，也不能保证私有 DOM 结构长期稳定；
- 画布是 canvas，无法直接读取像素以外的东西；截图请走
  `getSource('svg') → canvas → PNG`；
- 大文档（几千个网络）注意上下文长度与性能，输出要裁剪；
- 扩展执行在顶层窗口，任何异常都可能影响其他扩展，务必 try/catch。

---

## 11. 常见坑速查

| 现象 | 原因 | 处理 |
|---|---|---|
| 菜单/按钮在，点了没反应 | 命令名缺 `extension-<ID>-` 前缀，被静默丢弃 | 用真实 ID 拼命令名 |
| 换 ID 重装后菜单失效 | 旧实例仍存在，取到了旧 ID | 探针优先，兜底取最新实例 |
| 弹窗打不开 | `createDialog` 默认关闭 | 调用 `.dialog('open')` 或自绘 |
| 样式全丢 / 日志不换行 | 内联 style 里的双引号截断属性 | `st()` 转义，字体名用单引号 |
| 引脚序列化崩溃 | `pin.dot` / `pin.clock` / `configure.locked` 缺失 | 构造完整字段 |
| 拖拽卡死 | 遮罩 `pointer-events:none`，指针进入 iframe | 拖动期间改为 `auto` |
| 横向滚动条压住缩放手柄 | `overflow-x` 默认 auto | 内容区 `overflow-x:hidden` |
| 固定高度弹窗出现滚动条 | 内容比高度高 | 高度自适应 `max-height:92vh` |
| 请求被拦截 | CORS / 本地网络权限 | 服务端允许跨域；本地服务换来源 |
| 移除扩展后配置还在 | 平台行为 | 提供「清除配置」按钮 |
| 语言没切换 | 语言在加载时确定 | 刷新页面 |
| 多扩展互相干扰 | 共享全局变量 / localStorage key | 命名空间带扩展 ID |

---

## 12. 实践建议

1. **分层**：`core`（命名空间/配置/日志）→ `api` 封装 → 业务模块 → `UI`；
2. **日志与诊断**：所有关键路径打日志，并提供「复制诊断信息」
   （扩展 ID、API 可用性、文档类型、配置、最近日志），排查安装问题最有效；
3. **错误提示要具体**：区分「未配置」「CORS」「HTTP 状态码」「模型不支持工具」；
4. **版本管理**：`manifest.json` 的 `version` 作为唯一来源，构建脚本自增；
   产物按「项目名 + 版本号」命名，便于发版；
5. **模块与体积**：单文件 ≤ 800 行，便于维护；
6. **文档三件套**：README（关键）、PRD/设计文档（细节）、CHANGELOG（按版本）。

---

## 13. 最小完整示例

```js
/* main.js —— 菜单 + 命令 + 自绘弹窗 + 读取文档 */
(function (api, $, Locale) {
	'use strict';
	if (!api) return;

	var MY = (window.MYEXT = window.MYEXT || {});
	var ID = detectId();                 // 返回真实扩展 ID
	var CMD = 'extension-' + ID + '-panel';

	function detectId() {
		var insts = (window.easyeda && window.easyeda.extension &&
			window.easyeda.extension.instances) || {};
		var ids = Object.keys(insts);
		var mark = '__probe__';
		ids.forEach(function (cand) {
			var o = {};
			o['extension-' + cand + '-' + mark] = function () {};
			api('createCommand', o);
		});
		for (var i = 0; i < ids.length; i++) {
			var cmds = (insts[ids[i]] || {}).commands || {};
			for (var k in cmds) if (k.indexOf(mark) >= 0) return ids[i];
		}
		return ids[ids.length - 1] || 'myext';
	}

	var cmds = {};
	cmds[CMD] = function () { openPanel(); };
	api('createCommand', cmds);

	api('createExtensionMenu', [{
		text: '我的扩展', fordoctype: 'all',
		submenu: [{ text: '打开面板…', cmd: CMD }]
	}]);

	function openPanel() {
		var doc = null;
		try { doc = api('getActiveJson'); } catch (e) { /* ignore */ }
		var count = doc && doc.schlib ? Object.keys(doc.schlib).length : 0;

		var mask = document.createElement('div');
		mask.setAttribute('style',
			'position:fixed;inset:0;z-index:2147483002;background:rgba(10,20,36,.45);' +
			'display:flex;align-items:center;justify-content:center');
		mask.innerHTML =
			'<div style="width:420px;background:#fff;border-radius:8px;padding:18px;' +
			'font-family:\'Microsoft YaHei\',sans-serif;font-size:12px;color:#1f2733">' +
			'<div style="font-size:14px;font-weight:600;margin-bottom:8px">我的扩展</div>' +
			'<div>当前文档元件数：' + count + '</div>' +
			'<div style="margin-top:14px;text-align:right">' +
			'<button data-close style="padding:5px 14px">关闭</button></div></div>';
		mask.addEventListener('click', function (e) {
			if (e.target === mask || e.target.hasAttribute('data-close')) {
				mask.parentNode.removeChild(mask);
			}
		});
		document.body.appendChild(mask);
	}
})(api, $, Locale);
```

配套 `manifest.json`：

```json
{
	"name": "我的扩展",
	"version": "0.0.1",
	"icons": { "default": "icon.svg" },
	"locale": "locale.txt",
	"scripts": ["main.js"]
}
```

---

## 14. 附录 A：API 全量参考

调用约定：`api(name, args)` 同步返回；`name` 区分大小写；不同客户端版本可能增减参数。
「扩展环境」标注的 API 只在扩展/脚本环境可用，官方 API List 未逐项列出但已在
编辑器内实测可用。

### 14.1 文档源

| API | 参数 | 返回 | 说明 |
|---|---|---|---|
| `getSource` | `{type:'json'\|'compress'\|'svg'}` | object / string | `json` 可读对象；`compress` 数据库存储串；`svg` 矢量源码 |
| `applySource` | `{source, createNew}` | – | `createNew:true` 新开编辑器，`false` 替换当前文档 |
| `getActiveJson` | – | object | 当前文档 JSON（扩展环境） |
| `getActiveFileTitle` | – | string | 当前文档标题（扩展环境） |
| `getActiveProjectAllSchJson` | – | object | 整工程多图纸 `{schematics:[{tabid,title,json}]}`（扩展环境） |

### 14.2 图元增删改查

| API | 参数 | 返回 | 说明 |
|---|---|---|---|
| `getShape` | `{id}` | object | 按 gId 读单个图元 |
| `createShape` | `{shapeType, …}` | object / gId | 创建图元；可直接给字段、`jsonCache`、`shortUrl/from/title` 或库器件 |
| `updateShape` | `{shapeType, jsonCache}` | – | `jsonCache.gId` 必填，只改给定字段 |
| `insertShape` | `[{shapeTypeName, …}]` | – | 旧式批量创建（脚本示例常用） |
| `clone` | `{ids:[gId]}` | gId[] | 复制并返回新 id |
| `delete` | `{ids:[gId]}` | – | 删除 |

**shapeType 全量**

| 文档 | 取值 |
|---|---|
| 原理图 | `schlib` `rect` `polyline` `polygon` `wire` `bus` `image` `circle` `ellipse` `line` `path` `arc` `annotation` `junction` `netlabel` `busentry` `arrowhead` `noconnectflag` `pin` `netflag` |
| PCB | `FOOTPRINT` `TRACK` `COPPERAREA` `SOLIDREGION` `RECT` `CIRCLE` `TEXT` `ARC` `DIMENSION` `PAD` `VIA` `HOLE` |

### 14.3 变换与移动

| API | 参数 | 说明 |
|---|---|---|
| `rotate` | `{ids, degree}` | 旋转到指定角度 |
| `rotate_left` / `rotate_right` | `{ids}` | 逆时针 / 顺时针 90° |
| `fliph` / `flipv` | `{ids}` | 水平 / 垂直翻转 |
| `align_left` / `align_right` / `align_top` / `align_bottom` | `{ids}` | 对齐 |
| `moveObjs` | `{objs?, addX, addY}` | 相对移动；`objs` 省略时作用于选中对象 |
| `moveObjsTo` | `{objs?, x, y}` | 移动到绝对坐标 |

`objs` 元素可以是 gId 字符串，也可以是 `{gId:'…'}`。

### 14.4 选择

| API | 参数 | 返回 | 说明 |
|---|---|---|---|
| `select` | `{ids}` | – | 选中指定图元 |
| `selectNone` | – | – | 取消全部选中 |
| `getSelectedIds` | – | gId[] | 当前选中集合 |

### 14.5 坐标与单位

| API | 参数 | 返回 | 说明 |
|---|---|---|---|
| `setOriginXY` | `{x, y}` | – | 把真实原点映射到画布坐标 |
| `coordConvert` | `{type:'real2canvas'\|'canvas2real', x, y}` | number | 坐标换算，支持 `400mil` / `10mm` 写法 |
| `valConvert` | `{type:'real2canvas'\|'canvas2real', val}` | number | 尺寸换算 |
| `edit.unitConvert` | `{type:'mil2pixel'\|…, value}` | number | 旧式单位换算 |
| `getSvgArcPathByCRA` | `{cx,cy,rx,ry,startAngle,endAngle,sweepFlag}` | string | 圆弧参数转 SVG path |

### 14.6 界面与扩展环境

| API | 参数 | 说明 |
|---|---|---|
| `createCommand` | `{'extension-<id>-<name>': fn}` | 注册命令；前缀不匹配会被**静默丢弃** |
| `createExtensionMenu` | `[{text, fordoctype, submenu:[{text,cmd}] \| cmd}]` | 注册「高级」菜单 |
| `createToolbarButton` | `{icon,title,text,fordoctype,cmd,menu}` | 工具栏按钮（**V6 不再显示**） |
| `createDialog` | `{title,width,height,content}` | EasyUI 对话框（默认关闭） |
| `readConfig` | `key` | 读扩展配置（字符串） |
| `saveConfig` | `{[extId]:{[key]:value}}` | 写扩展配置 |
| `getRes` | `name` | 读扩展目录内文件内容 |
| `editorCall` | `{cmd, args}` | 帧内编辑器命令（扩展环境） |
| `window.callByEditor` | `{func, args, uuid}` | 顶层命令总线（扩展环境） |

---

## 15. 附录 B：文件格式字段参考

> 与官方仓库 <https://github.com/easyeda/easyeda-std-file-format> 一致；
> 本章把常用字段整理成速查表，字段顺序即压缩串中的顺序。

### 15.1 顶层结构与 docType

| docType | 文档类型 | 顶层结构 |
|---|---|---|
| 1 | 原理图 | `{head, canvas, shape[], BBox}` |
| 2 | 原理图符号 | 同上，`head.c_para` 含 `pre/name/package` |
| 3 | PCB | `{head, canvas, shape[], layers[], objects[], BBox, preference, DRCRULE, netColors}` |
| 4 | PCB 封装 | 同 PCB（`head.c_para` 含 `package/pre`） |
| 5 | 原理图工程 | `{docType:'5', title, description, colors, schematics:[{docType:'1', title, dataStr:{head,canvas,shape,BBox}}]}` |

### 15.2 通用结构

**head**

| 字段 | 类型 | 说明 |
|---|---|---|
| `docType` | string | 文档类型（见上表） |
| `editorVersion` | string | 编辑器版本 |
| `newgId` | boolean | 内部器件是否生成唯一 id |
| `c_para` | object | 文档级自定义属性（如 `pre` / `name` / `package`） |
| `x` / `y` | string | 文档坐标原点 |
| `hasIdFlag` | boolean | 库文件是否已绑定封装 uuid |
| `c_spiceCmd` | string | 仿真指令（仅原理图） |

**canvas**（`~` 分隔）

```
CA~viewWidth~viewHeight~backGround~gridVisible~gridColor~gridSize~canvasWidth~canvasHeight~gridStyle~snapSize~unit~altSnapSize~originX~originY
```

PCB 的 `canvas` 额外包含 `routingWidth`、`routingAngle`、`copperAreaDisplay`、
`routeConflict`、`removeLoop` 等布线相关配置。

**其他顶层键**

| 键 | 说明 |
|---|---|
| `shape` | 字符串数组，每个元素是一个压缩图元 |
| `BBox` | `{x, y, width, height}` 内容包围盒 |
| `layers`（PCB） | `"layerid~name~color~visible~active~config~transparency~type"` |
| `DRCRULE`（PCB） | `{Default:{trackWidth,clearance,viaHoleDiameter,viaHoleD}, isRealtime, …}` |
| `preference`（PCB） | `{hideFootprints, hideNets}` |
| `netColors`（PCB） | 网络配色映射 |

**分隔符**

| 分隔符 | 用途 |
|---|---|
| `~` | 分隔属性字段 |
| `` ` `` | 分隔 `c_para` 键值对 |
| `^^` | 复合图元分段（Pin、Netflag、PAD） |
| `#@$` | 器件/封装内部图元连接 |

### 15.3 原理图图元

单位：**pixel（1 px = 10 mil）**；`strokeStyle`：`0` 实线 / `1` 虚线 / `2` 点线。

| 图元 | 格式串 |
|---|---|
| 折线 | `PL~points~strokeColor~strokeWidth~strokeStyle~fillColor~gId~locked` |
| 导线 | `W~points~…`（同折线，电气连接） |
| 总线 | `B~points~…` |
| 多边形 | `PG~points~…`（闭合） |
| 矩形 | `R~x~y~rx~ry~width~height~strokeColor~strokeWidth~strokeStyle~fillColor~gId~locked~c_etype` |
| 圆 | `C~cx~cy~r~strokeColor~strokeWidth~strokeStyle~fillColor~gId~locked` |
| 椭圆 | `E~cx~cy~rx~ry~strokeColor~strokeWidth~strokeStyle~fillColor~gId~locked` |
| 直线 | `L~x1~y1~x2~y2~strokeColor~strokeWidth~strokeStyle~fillColor~gId~locked` |
| 路径 | `PT~pathString~strokeColor~strokeWidth~strokeStyle~fillColor~gId~locked` |
| 圆弧 | `A~pathString~helperDots~strokeColor~strokeWidth~strokeStyle~fillColor~gId~locked` |
| 图片 | `I~x~y~width~height~rotation~href~gId~locked` |
| 文本 | `T~mark~x~y~rotation~fillColor~fontFamily~fontSize~fontWeight~fontStyle~dominantBaseline~type~value~visible~textAnchor~gId~locked~c_etype` |
| 网络标签 | `N~x~y~rotation~fillColor~name~gId~textAnchor~textX~textY~fontFamily~fontSize~locked` |
| 连接点 | `J~x~y~radius~fillColor~gId~locked` |
| 无连接标志 | `O~x~y~gId~pathString~strokeColor~locked` |
| 总线分支 | `BE~rotation~x1~y1~x2~y2~gId~locked` |
| 箭头 | `AR~partType~x~y~gId~rotation~pathString~fillColor~locked~arrowType~arrowSize` |
| 器件 | `LIB~x~y~c_para~rotation~importFlag~gId~puuid~uuid~locked~bindPcbId~convertToPcb~addIntoBom#@$图元1#@$图元2…` |

**文本的 mark**：`L` 普通 / `N` 名称（值）/ `P` 位号 / `PK` 封装名。

**引脚 P**（`^^` 分段）

```
P~display~electric~spicePin~x~y~rotation~gId~locked ^^ x~y ^^ pathString~pinColor ^^ name段 ^^ number段 ^^ dot段 ^^ clock段
```

| 段 | 格式 |
|---|---|
| 配置 | `P~display~electric~spicePin~x~y~rotation~gId~locked` |
| 吸附点 | `x~y` |
| 路径 | `pathString~pinColor` |
| 名称 | `visible~x~y~rotation~text~textAnchor~fontFamily~fontSize~fillColor` |
| 编号 | 同名称 |
| 终点圆 | `visible~x~y` |
| 时钟 | `visible~pathString` |

**网络标识 F**（`^^` 分段）

```
F~partId~x~y~rotation~gId~transform~locked ^^ x~y ^^ text~color~x~y~rotation~textAnchor~visible~fontFamily~fontSize~gId ^^ 图形…
```

### 15.4 PCB 图元

单位：官方文档说明画布以 **10 mil** 为基本单位；实际 JSON 数值与编辑器显示单位
（mil / mm / inch）不同，读写以 JSON 数值为准，跨单位计算请用 `valConvert` 校验。

| 图元 | 格式串 |
|---|---|
| 导线 | `TRACK~strokeWidth~layerid~net~points~gId~locked` |
| 矩形 | `RECT~x~y~width~height~layerid~gId~locked~strokeWidth~fill~transform~net~c_etype` |
| 圆 | `CIRCLE~cx~cy~r~strokeWidth~layerid~gId~locked~net~transformarc` |
| 圆弧 | `ARC~strokeWidth~layerid~net~pathString~helperDots~gId~locked` |
| 文本 | `TEXT~type~x~y~strokeWidth~rotation~mirror~layerid~net~fontSize~text~pathStr~display~gId~fontFamily~locked~c_etype` |
| 焊盘 | `PAD~shape~x~y~width~height~layerid~net~number~holeR~pointArr~rotation~gId~holeLength~slotPointArr~plated~locked~pasteExpansion~solderExpansion~holeCenter` |
| 过孔 | `VIA~x~y~diameter~net~holeR~gId~locked` |
| 通孔 | `HOLE~x~y~holeR~gId~locked` |
| 铺铜 | `COPPERAREA~strokeWidth~layerid~net~pathStr~clearanceWidth~fillStyle~gId~thermal~keepIsland~compressData~locked~name~order~gridTrackWidth~gridClearance~toBoardOutline~fabricationImprove~spokeWidth` |
| 实心填充 | `SOLIDREGION~layerid~net~pathStr~type~gId~teardrop~targetPad~targetWire~locked` |
| 尺寸标注 | `DIMENSION~layerid~pathString~gId~fontSize~locked~measuringType~fontWidth` |
| 封装 | `LIB~x~y~c_para~rotation~importFlag~gId~layerid~uuid~utime~locked#@$图元1#@$图元2…` |
| 图形组合 | `SVGNODE~{JSON}` |

**枚举**

| 字段 | 取值 |
|---|---|
| `PAD.shape` | `ELLIPSE` / `RECT` / `OVAL` / `POLYGON` |
| `PAD.plated` | `Y` / `N` |
| `SOLIDREGION.type` | `solid` / `cutout` / `npth` |
| `TEXT.type` | `L` 普通 / `P` 位号 |
| `layers` 常用 id | `1` TopLayer、`2` BottomLayer、`3` TopSilkLayer（其余以 `layers` 数组为准） |

### 15.5 `c_para` 常用键

| 键 | 说明 |
|---|---|
| `package` | 封装名 |
| `name` / `pre` | 名称 / 位号前缀（库文件） |
| `value` | 值 |
| `Manufacturer` / `Manufacturer Part` | 厂商 / 厂商型号 |
| `Supplier` / `Supplier Part` | 供应商 / 供应商编号 |
| `BOM_` 前缀键 | 读取时会被剥离为同名的普通键 |

---

## 16. 与官方文档的关系

官方资料（建议对照阅读）：

| 资源 | 内容 |
|---|---|
| [How to Use API](https://docs.easyeda.com/en/API/1-How-to-Use-API/) | 插件入口、加载扩展、用户脚本、入门示例 |
| [Coordinate System and Unit](https://docs.easyeda.com/en/API/2-Coordinate-System-and-Unit/) | 画布坐标 / 真实坐标、单位换算 |
| [API List](https://docs.easyeda.com/en/API/3-API-List/) | API 全量清单与调用示例 |
| [API Examples](https://docs.easyeda.com/en/API/4-API-Examples/) | 示例工程代码 |
| [Standard file format](https://github.com/easyeda/easyeda-std-file-format) | 文档 JSON 格式说明与各 docType 示例 |

**覆盖情况**：官方 API List 中的函数在本文第 14 章已全部列出；
本文在官方"示例式"说明之外，补充了扩展工程化必需的部分——扩展 ID 与命令前缀、
配置持久化、自绘弹窗与拖动/缩放、CORS 与流式请求、国际化、常见坑与发布流程。

**需要注意的差异**

- `createToolbarButton` 在 V6 不再展示（见 4.3），菜单入口请用 `createExtensionMenu`。
- 官方文档以「运行一次脚本」的示例为主，扩展里还要处理文档未打开、语言、
  配置缺失等运行期状态。
- 个别 API 在不同客户端版本上行为略有差异，以实际返回值为准。

---

> 本文描述的是标准版扩展的公开能力与常见实现方式。不同客户端版本在细节上
> 可能有差异，遇到问题时优先用「诊断信息 + 日志」定位，并以实际返回值为准。
