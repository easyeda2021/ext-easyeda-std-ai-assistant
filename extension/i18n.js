/* =====================================================================
 * EasyEDA Std extension — "AI Assistant" / AI 助手
 * i18n.js — full UI localisation (zh → en), applied at render time
 *
 * The UI is authored in Chinese; when the editor runs in a non-Chinese
 * language every rendered text node / placeholder / title is translated
 * through this dictionary.  Unknown strings simply stay Chinese.
 * ===================================================================== */
(function () {
	'use strict';

	var EAI = (window.EAI = window.EAI || {});
	var I = (EAI.i18n = {});

	/** exact-match dictionary */
	I.map = {
		/* ---- roles / buttons ---- */
		'你': 'You',
		'系统': 'System',
		'错误': 'Error',
		'发送': 'Send',
		'停止': 'Stop',
		'关闭': 'Close',
		'复制': 'Copy',
		'已复制': 'Copied',
		'复制失败': 'Copy failed',
		'复制全部': 'Copy all',
		'保存': 'Save',
		'测试连接': 'Test connection',
		'复制诊断信息': 'Copy diagnostics',
		'清除配置': 'Clear config',
		'清空会话': 'Clear chat',
		'设置': 'Settings',
		'运行日志': 'Run log',
		'运行日志（独立窗口）': 'Run log (separate window)',
		'添加图片（也可直接粘贴）': 'Attach image (or paste)',
		'发送（Ctrl + Enter）': 'Send (Ctrl + Enter)',
		'拖动调整输入框高度': 'Drag to resize the input',
		'预览报告': 'Preview',
		'下载 Markdown': 'Download Markdown',
		'下载 HTML': 'Download HTML',
		'字符': 'chars',

		/* ---- panel ---- */
		'AI 助手': 'AI Assistant',
		'AI 设置': 'AI Settings',
		'关于 AI 助手': 'About AI Assistant',
		'嘉立创EDA标准版 · 智能设计助手': 'EasyEDA Std · AI Design Assistant',
		'正在读取文档…': 'Reading document…',
		'未打开文档': 'no document',
		'未配置': 'not configured',
		'描述需求，或点胶囊按钮填入提示词…\nCtrl + Enter 发送 · 可粘贴图片':
			'Describe what you need, or tap a chip below…\nCtrl + Enter to send · images can be pasted',
		'最多附加 4 张图片。': 'Up to 4 images.',
		'会话已清空，可以开始新的对话。': 'Chat cleared.',
		'正在处理，请稍候或点「停止」。': 'Busy — wait, or press Stop.',
		'正在停止…（等待当前请求返回）': 'Stopping… (waiting for the current request)',
		'已请求停止。': 'Stop requested.',
		'已停止。': 'Stopped.',
		'（图片）': '(image)',
		'工具调用过程 · 点击展开或收起': 'Tool calls · click to expand',
		'项目地址：': 'Project: ',
		'图片': 'Image',
		'剪贴板图片': 'clipboard image',
		'还没有配置模型。请先在「设置」里填写接口地址、API Key 和模型名。':
			'No model configured yet. Open Settings and fill in endpoint, API key and model.',
		'模型没有返回内容。请检查接口地址与模型名，或查看「日志」页。':
			'The model returned nothing. Check the endpoint / model, or open the log.',
		'报告内容为空，可能是接口返回异常，请查看「日志」页。':
			'Empty report — the API probably returned an error. See the log.',
		'达到「最大工具步数」上限，模型仍未给出最终结论。可以在设置里把这个值调大，或再发一句「继续」。':
			'Step limit reached. Raise "Max tool steps" in Settings, or send "continue".',
		'模型只返回了中间说明（已在上方显示），没有给出最终结论。可以再发一句「请给出最终报告」，或换一个指令跟随更好的模型。':
			'The model only sent an interim note. Send "give me the final report" or switch to a model that follows instructions better.',
		'AI 助手面板打开失败，请看「设置 → 诊断」。':
			'Could not open the AI panel — see Settings → Diagnostics.',
		'评审报告已生成': 'Report ready',
		'AI 评审报告': 'AI review report',

		/* ---- presets ---- */
		'原理图审查': 'Review schematic',
		'BOM 分析': 'BOM analysis',
		'器件标准化': 'Standardise parts',
		'生成原理图': 'Generate schematic',
		'识别符号': 'Symbol from image',
		'PCB 审查': 'Review PCB',
		'截图评审': 'Review snapshot',

		/* ---- settings ---- */
		'模型接入': 'Model access',
		'接口协议': 'Protocol',
		'供应商快捷填入': 'Provider preset',
		'只帮你填地址和模型，下面的内容都可以手动改':
			'Only fills endpoint and model — everything stays editable',
		'接口地址 Base URL ': 'Base URL ',
		'（可完全自定义）': '(fully custom)',
		'实际请求：': 'Endpoint: ',
		'保存在扩展配置与本机，不会上传到任何第三方':
			'Stored locally in the extension config; never uploaded elsewhere',
		'模型 Model': 'Model',
		'超时(s)': 'Timeout (s)',
		'回答语言': 'Answer language',
		'最大工具步数': 'Max tool steps',
		'额外请求头': 'Extra headers',
		'可选，一行一个 Key: Value': 'Optional, one "Key: Value" per line',
		'生成参数': 'Generation',
		'诊断': 'Diagnostics',
		'反馈问题时请附上这段信息': 'attach this when reporting a problem',
		'已填入预设，地址 / 模型 / Key 仍可修改。':
			'Preset applied — endpoint / model / key remain editable.',
		'请填写接口地址、API Key 与模型名。': 'Fill in the endpoint, API key and model.',
		'清除本扩展保存的接口配置（API Key 等）？这不会删除扩展本身。':
			'Clear the saved API configuration (API key etc.)? The extension itself is not removed.',
		'已清除本扩展保存的配置。': 'Saved configuration cleared.',
		'已复制诊断信息。': 'Diagnostics copied.',
		'— 自定义 —': '— Custom —',
		'供应商与模型': 'Providers & models',
		'协议': 'Protocol',
		'接口地址': 'Base URL',
		'模型（': 'Models (',
		'+ 新增模型': '+ Add model',
		'获取模型列表': 'Fetch model list',
		'添加所选': 'Add selected',
		'取消': 'Cancel',
		'+ 添加供应商（自定义）': '+ Add provider (custom)',
		'名称重复': 'duplicate name',
		'重复': 'dup',
		'(已有)': '(added)',
		'正在获取模型列表…': 'Fetching models…',
		'获取失败：': 'Fetch failed: ',
		'接口没有返回模型列表。': 'The endpoint returned no models.',
		'请先填写接口地址与 API Key': 'Fill in the base URL and API key first',
		'确定清除已保存的接口配置？': 'Clear the saved API configuration?',
		'确认清除': 'Clear',
		'已删除供应商': 'Provider removed',
		'已保存': 'Saved',
		'已清除已保存的配置': 'Saved configuration cleared',
		'供应商名称不能为空': 'Provider name cannot be empty',
		'供应商名称重复：': 'Duplicate provider name: ',
		'切换模型': 'Switch model',
		'超时（秒）': 'Timeout (s)',
		'一次对话里最多允许模型调用多少次工具':
			'Max number of tool calls the model may make in one run',
		'中文': 'Chinese',
		'删除': 'Remove',
		'新供应商': 'New provider',
		'添加供应商': 'Add provider',
		'添加自定义供应商': 'Add custom provider',
		'新供应商名称': 'New provider name',
		'添加': 'Add',
		'请输入供应商名称': 'Enter a provider name',
		'例如 My Gateway': 'e.g. My Gateway',
		'OpenAI 兼容（/chat/completions）': 'OpenAI compatible (/chat/completions)',
		'Anthropic（/messages）': 'Anthropic (/messages)',
		'阿里云百炼 · 通义千问': 'Alibaba Bailian · Qwen',
		'智谱 GLM': 'Zhipu GLM',
		'SiliconFlow 硅基流动': 'SiliconFlow',
		'本地 Ollama': 'Local Ollama',
		'自定义 OpenAI 兼容接口': 'Custom OpenAI-compatible API',
		'自定义 Claude 兼容接口': 'Custom Claude-compatible API',

		/* ---- about ---- */
		'嘉立创EDA标准版 · 智能原理图与 PCB 设计助手':
			'EasyEDA Standard · AI schematic & PCB design assistant',
		'BOM 与截图评审': 'BOM & snapshot review',
		'先查系统库，查不到再现场建符号': 'Library first; build the symbol only if missing',
		'补齐封装 / 型号 / 供应商 / 料号': 'Fill package / part number / supplier / LCSC',
		'网表、悬空脚、去耦、命名冲突': 'Nets, floating pins, decoupling, name clashes',
		'物料与画布一起看': 'BOM and canvas together',
		'· 内置 Agent 循环：模型通过工具读取网表 / BOM / 截图，并直接修改文档。':
			'· Built-in agent loop: the model reads nets / BOM / snapshots through tools and edits the document.',
		'· 支持 OpenAI 与 Anthropic 协议，接口地址可完全自定义。':
			'· OpenAI and Anthropic protocols; the endpoint is fully customisable.',
		'· API Key 仅保存在本机与该扩展配置中。':
			'· The API key is stored locally in the extension config only.',
		'基于嘉立创EDA（EasyEDA）标准版扩展 API 开发，与专业版扩展不通用。':
			'Built on the EasyEDA Standard extension API; not compatible with Pro extensions.'
	};

	/** pattern-based rules for messages that embed values */
	I.rules = [
		[/^你好！当前文档：(.*)$/, 'Hello! Current document: $1'],
		[/^已附加图片：(.*)$/, 'Image attached: $1'],
		[/^正在调用工具 · 第 (\d+) 次 · (.*)$/, 'Working · call #$1 · $2'],
		[/^本轮工具调用 (\d+) 次：(.*)$/, '$1 tool call(s) this turn: $2'],
		[/^已截取画布 (\d+)x(\d+) 并发送给模型。$/, 'Captured $1×$2 and sent to the model.'],
		[/^已定位 (.*)$/, 'Located $1'],
		[/^未找到 (.*)$/, 'Not located: $1'],
		[/^已保存：(.*)$/, 'Saved: $1'],
		[/^正在测试 (.*) …$/, 'Testing $1 …'],
		[/^连接正常 — (.*)$/, 'Connection OK — $1'],
		[/^连接失败：(.*)$/, 'Connection failed: $1'],
		[/^复制失败：(.*)$/, 'Copy failed: $1'],
		[/^已填入「(.*)」提示词，可自行修改后发送。$/, 'Prompt for "$1" filled in — edit it if needed, then send.'],
		[/^(.*) · 可在弹窗中预览，或直接下载$/, '$1 · preview or download'],
		[/^(.*) · package (.*) · (\d+) pins \+ body rectangle(.*)$/, '$1 · package $2 · $3 pins + body rectangle$4'],
		[/^已添加供应商：(.*)$/, 'Provider added: $1'],
		[/^已添加 (\d+) 个模型(.*)$/, '$1 model(s) added$2'],
		[/^「(.*)」有空的模型名$/, '"$1" has an empty model name'],
		[/^「(.*)」模型重复：(.*)$/, '"$1" has a duplicate model: $2']
	];

	I.zh = function () {
		try { return /^zh/i.test(EAI.lang()); } catch (e) { return true; }
	};

	/** translate one string (returns the input when there is no mapping) */
	I.tr = function (text) {
		var s = String(text == null ? '' : text);
		if (I.zh()) return s;
		var exact = I.map[s];
		if (exact !== undefined) return exact;
		for (var i = 0; i < I.rules.length; i++) {
			if (I.rules[i][0].test(s)) return s.replace(I.rules[i][0], I.rules[i][1]);
		}
		return s;
	};

	/** translate text nodes + placeholder/title attributes inside a DOM node */
	/**
	 * Keeps a subtree translated while it grows (messages, pills, status…).
	 * apply() only writes when the text actually changes, so this cannot loop.
	 */
	I.watch = function (root) {
		if (!root || I.zh() || !window.MutationObserver) return;
		if (root.__eaiI18nWatched) return;
		root.__eaiI18nWatched = true;
		var timer = null;
		var mo = new MutationObserver(function () {
			if (timer) return;
			timer = setTimeout(function () {
				timer = null;
				I.apply(root);
			}, 20);
		});
		mo.observe(root, { childList: true, subtree: true, characterData: true });
	};

	I.apply = function (root) {
		if (!root || I.zh()) return root;
		try {
			var doc = root.ownerDocument || document;
			var walker = doc.createTreeWalker(root, 4 /* SHOW_TEXT */, null, false);
			var nodes = [], n;
			while ((n = walker.nextNode())) nodes.push(n);
			nodes.forEach(function (node) {
				var v = node.nodeValue;
				if (!v || !/[一-龥]/.test(v)) return;
				var core = v.trim();
				if (!core) return;
				var tr = I.tr(core);
				if (tr === core) return;
				var lead = v.match(/^\s*/)[0];
				var tail = v.match(/\s*$/)[0];
				node.nodeValue = lead + tr + tail;
			});

			if (root.querySelectorAll) {
				var list = root.querySelectorAll('[placeholder],[title]');
				Array.prototype.forEach.call(list, function (el) {
					['placeholder', 'title'].forEach(function (a) {
						var v = el.getAttribute(a);
						if (!v) return;
						var tr = I.tr(v);
						if (tr !== v) el.setAttribute(a, tr);
					});
				});
			}
		} catch (e) { /* never break rendering for a translation */ }
		return root;
	};
})();
