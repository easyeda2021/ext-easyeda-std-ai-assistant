/* =====================================================================
 * EasyEDA Std extension — "AI Assistant" / AI 助手
 * ui-settings.js — settings dialog (providers, models, generation, diagnostics)
 * ===================================================================== */
(function () {
	'use strict';

	var EAI = (window.EAI = window.EAI || {});
	var UI = (EAI.ui = EAI.ui || {});
	var U = EAI.util;
	var st = UI.st, C = UI.C, FONT = UI.FONT, MONO = UI.MONO;
	var injectStyle = UI.injectStyle, ghostBtn = UI.ghostBtn;

	UI.dlgSettings = null;
	UI.dlgSettingsCtl = null;

	/* working state of the dialog */
	var draft = null;
	var tab = 'providers';
	var fetched = {};          /* providerId -> { names:[…], error:'', loading:bool } */
	var confirmClear = false;
	var addingCustom = false;   /* inline "new provider" form */
	var customName = '';
	var message = '';
	var messageErr = false;

	var PRESETS = [
		{ label: 'OpenAI', protocol: 'openai', base: 'https://api.openai.com/v1', model: 'gpt-6.0' },
		{ label: 'Anthropic Claude', protocol: 'anthropic', base: 'https://api.anthropic.com/v1', model: 'claude-sonnet-5-5' },
		{ label: 'DeepSeek', protocol: 'openai', base: 'https://api.deepseek.com/v1', model: 'deepseek-flash' },
		{ label: '阿里云百炼 · 通义千问', protocol: 'openai', base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen3.8-max' },
		{ label: '智谱 GLM', protocol: 'openai', base: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-5.3-flash' },
		{ label: 'Moonshot / Kimi', protocol: 'openai', base: 'https://api.moonshot.cn/v1', model: 'kimi-k3.1' },
		{ label: 'SiliconFlow 硅基流动', protocol: 'openai', base: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen3.8-Max' },
		{ label: 'OpenRouter', protocol: 'openai', base: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-sonnet-5.5' },
		{ label: '本地 Ollama', protocol: 'openai', base: 'http://127.0.0.1:11434/v1', model: 'qwen3:8b' },
		{ label: 'Azure OpenAI', protocol: 'openai', base: 'https://<resource>.openai.azure.com/openai/deployments/<deployment>', model: 'gpt-6.0' }
	];

	/* ------------------------------------------------------------ pieces -- */

	function labelCss() {
		return st({
			flex: '0 0 96px', textAlign: 'right', fontSize: '12px', fontWeight: '600',
			color: '#3a4a63', lineHeight: '1.4'
		});
	}

	function inputCss() {
		return st({
			width: '100%', boxSizing: 'border-box', height: '32px', padding: '0 9px',
			border: '1px solid #d8e0ec', borderRadius: '8px', fontSize: '12.5px',
			fontFamily: FONT, color: C.text, background: '#fff', outline: 'none'
		});
	}

	/** label | control on one row, description on its own line below */
	function field(label, inner, note) {
		return '<div style="' + st({ marginBottom: '12px' }) + '">' +
			'<div style="' + st({ display: 'flex', alignItems: 'center', gap: '10px' }) + '">' +
			'<label style="' + labelCss() + '">' + label + '</label>' +
			'<div style="' + st({ flex: '1 1 auto', minWidth: '0' }) + '">' + inner + '</div>' +
			'</div>' +
			(note ? '<div style="' + st({
				marginLeft: '106px', marginTop: '3px', fontSize: '11px',
				color: C.muted, lineHeight: '1.5'
			}) + '">' + note + '</div>' : '') +
			'</div>';
	}

	function diagHtml() {
		return EAI.diagnostics().split('\n').map(function (l) {
			return '<div style="' + st({ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }) + '">' +
				U.esc(l) + '</div>';
		}).join('');
	}

	function navItem(id, label) {
		var active = tab === id;
		return '<a href="#" data-tab="' + id + '" style="' + st({
			display: 'block', padding: '7px 10px', borderRadius: '8px', marginBottom: '3px',
			textDecoration: 'none', fontSize: '12.5px',
			background: active ? '#e8f1ff' : 'transparent',
			color: active ? C.primary : '#3a4a63',
			fontWeight: active ? '600' : '400'
		}) + '">' + label + '</a>';
	}

	function smallBtn(id, text, data) {
		var d = '';
		if (data) {
			Object.keys(data).forEach(function (k) { d += ' data-' + k + '="' + U.esc(data[k]) + '"'; });
		}
		return '<button href="#" id="' + (id || '') + '"' + d + ' class="eai-btn" style="' + st({
			background: '#fff', border: '1px solid ' + C.borderStrong, color: '#23405f',
			borderRadius: '7px', padding: '4px 10px', fontSize: '11.5px', fontFamily: FONT,
			cursor: 'pointer'
		}) + '">' + text + '</button>';
	}

	/* -------------------------------------------------------- provider UI -- */

	function providerCard(p, index) {
		var collapsed = !!p.collapsed;
		var nameDup = EAI.cfg.nameTaken(draft, p.name, p.id);

		var head =
			'<div style="' + st({
				display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
				background: '#f7f9fc', borderRadius: collapsed ? '9px' : '9px 9px 0 0'
			}) + '">' +
			'<a href="#" data-toggle="' + p.id + '" style="' + st({
				textDecoration: 'none', color: C.muted, width: '12px', fontSize: '11px'
			}) + '">' + (collapsed ? '&#9656;' : '&#9662;') + '</a>' +
			'<input data-pf="name" data-id="' + p.id + '" value="' + U.esc(p.name || '') + '"' +
			' style="' + st({
				flex: '1 1 auto', minWidth: '0', border: '1px solid transparent',
				background: 'transparent', fontSize: '12.5px', fontWeight: '600',
				color: nameDup ? '#b03a3a' : C.primaryDark, padding: '2px 4px',
				borderRadius: '5px', outline: 'none', fontFamily: FONT
			}) + '">' +
			(nameDup ? '<span style="' + st({ fontSize: '10.5px', color: '#b03a3a' }) + '">名称重复</span>' : '') +
			'<span style="' + st({ fontSize: '10.5px', color: C.muted }) + '">' +
			(p.protocol === 'anthropic' ? 'Anthropic' : 'OpenAI') + '</span>' +
			'<a href="#" data-del-provider="' + p.id + '" title="删除" style="' + st({
				textDecoration: 'none', color: '#a83232', fontSize: '12px', padding: '0 4px'
			}) + '">&#10005;</a>' +
			'</div>';

		if (collapsed) {
			return '<div data-prov-card="' + p.id + '" style="' + st({
				border: '1px solid ' + C.border, borderRadius: '9px', marginBottom: '9px',
				background: '#fff'
			}) + '">' + head + '</div>';
		}

		var body =
			'<div style="' + st({ padding: '10px 12px 12px' }) + '">' +
			field('协议',
				'<select data-pf="protocol" data-id="' + p.id + '" style="' + inputCss() + '">' +
				'<option value="openai"' + (p.protocol !== 'anthropic' ? ' selected' : '') +
				'>OpenAI 兼容（/chat/completions）</option>' +
				'<option value="anthropic"' + (p.protocol === 'anthropic' ? ' selected' : '') +
				'>Anthropic（/messages）</option></select>') +
			field('接口地址',
				'<input data-pf="baseUrl" data-id="' + p.id + '" value="' + U.esc(p.baseUrl || '') +
				'" placeholder="https://api.openai.com/v1" style="' + inputCss() + '">',
				'实际请求：<code style="' + st({
					background: '#eef2f8', padding: '1px 5px', borderRadius: '4px',
					fontFamily: MONO, fontSize: '10.5px', color: '#2f5fa8'
				}) + '">' + U.esc(EAI.llm.endpoint({
					provider: p.protocol, baseUrl: p.baseUrl, model: ''
				})) + '</code>') +
			field('API Key',
				'<input data-pf="apiKey" data-id="' + p.id + '" type="password" value="' +
				U.esc(p.apiKey || '') + '" placeholder="sk-..." style="' + inputCss() + '">',
				'保存在扩展配置与本机，不会上传到任何第三方') +
			modelsBlock(p) +
			'</div>';

		return '<div data-prov-card="' + p.id + '" style="' + st({
			border: '1px solid ' + C.border, borderRadius: '9px', marginBottom: '9px',
			background: '#fff'
		}) + '">' + head + body + '</div>';
	}

	function modelsBlock(p) {
		var list = (p.models || []).map(function (m) {
			var dup = EAI.cfg.modelTaken(p, m.name, m.id);
			return '<div style="' + st({
				display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px'
			}) + '">' +
				'<input data-pm="' + m.id + '" data-id="' + p.id + '" value="' + U.esc(m.name || '') +
				'" placeholder="模型名，例如 deepseek-flash" style="' + st({
					flex: '1 1 auto', minWidth: '0', height: '30px', padding: '0 9px',
					border: '1px solid ' + (dup ? '#e3a9a9' : '#d8e0ec'), borderRadius: '7px',
					fontSize: '12px', fontFamily: MONO, color: C.text, outline: 'none'
				}) + '">' +
				(dup ? '<span style="' + st({ fontSize: '10.5px', color: '#b03a3a' }) + '">重复</span>' : '') +
				'<a href="#" data-del-model="' + m.id + '" data-id="' + p.id + '" title="删除' +
				'" style="' + st({ textDecoration: 'none', color: '#a83232', fontSize: '12px' }) +
				'">&#10005;</a>' +
				'</div>';
		}).join('');

		var fetchBox = '';
		var f = fetched[p.id];
		if (f) {
			if (f.loading) {
				fetchBox = '<div style="' + st({ fontSize: '11.5px', color: C.muted, marginTop: '6px' }) +
					'">正在获取模型列表…</div>';
			} else if (f.error) {
				fetchBox = '<div style="' + st({ fontSize: '11.5px', color: '#b03a3a', marginTop: '6px' }) +
					'">获取失败：' + U.esc(f.error) + '</div>';
			} else if (f.names && f.names.length) {
				fetchBox = '<div style="' + st({
					border: '1px dashed #cfdaea', borderRadius: '8px', padding: '8px',
					marginTop: '6px', maxHeight: '150px', overflow: 'auto', background: '#fbfcfe'
				}) + '">' + f.names.map(function (n) {
					var has = EAI.cfg.modelTaken(p, n);
					return '<label style="' + st({
						display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px',
						color: has ? C.muted : C.text, marginBottom: '3px'
					}) + '"><input type="checkbox" data-pick="' + p.id + '" value="' + U.esc(n) + '"' +
						(has ? ' disabled' : '') + '> ' + U.esc(n) +
						(has ? ' <span style="font-size:10px">(已有)</span>' : '') + '</label>';
				}).join('') +
					'<div style="' + st({ marginTop: '6px', display: 'flex', gap: '6px' }) + '">' +
					smallBtn('', '添加所选', { 'pick-add': p.id }) +
					smallBtn('', '取消', { 'pick-cancel': p.id }) +
					'</div></div>';
			} else {
				fetchBox = '<div style="' + st({ fontSize: '11.5px', color: C.muted, marginTop: '6px' }) +
					'">接口没有返回模型列表。</div>';
			}
		}

		return '<div style="' + st({ marginLeft: '0', marginTop: '2px' }) + '">' +
			'<div style="' + st({
				display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px'
			}) + '">' +
			'<span style="' + st({ fontSize: '12px', fontWeight: '600', color: '#3a4a63' }) +
			'">模型（' + (p.models || []).length + '）</span>' +
			'<span style="flex:1"></span>' +
			smallBtn('', '+ 新增模型', { 'add-model': p.id }) +
			smallBtn('', '获取模型列表', { fetch: p.id }) +
			'</div>' +
			list + fetchBox +
			'</div>';
	}

	/* ------------------------------------------------------------- panes -- */

	function paneProviders() {
		var addOptions = '<option value="" selected>添加供应商</option>' +
			'<option value="custom">添加自定义供应商</option>';
		PRESETS.forEach(function (pr, i) {
			addOptions += '<option value="' + i + '">' + U.esc(pr.label) + '</option>';
		});

		var cards = (draft.providers || []).map(providerCard).join('');
		if (!cards) {
			cards = '<div style="' + st({
				padding: '18px 12px', textAlign: 'center', fontSize: '12px',
				color: C.muted, border: '1px dashed ' + C.borderStrong,
				borderRadius: '9px', marginBottom: '10px', lineHeight: '1.8'
			}) + '">还没有供应商<br/>在下面「添加供应商」里选一个预设，或「添加自定义供应商」</div>';
		}

		var customForm = '';
		if (addingCustom) {
			customForm =
				'<div style="' + st({
					border: '1px solid ' + C.border, borderRadius: '9px', padding: '10px',
					marginBottom: '9px', background: '#fbfcfe'
				}) + '">' +
				'<div style="' + st({ fontSize: '12px', color: '#3a4a63', marginBottom: '6px' }) +
				'">新供应商名称</div>' +
				'<div style="' + st({ display: 'flex', gap: '6px', alignItems: 'center' }) + '">' +
				'<input id="eai-custom-name" value="' + U.esc(customName) +
				'" placeholder="例如 My Gateway" style="' + st({
					flex: '1 1 auto', minWidth: '0', height: '30px', padding: '0 9px',
					border: '1px solid #d8e0ec', borderRadius: '7px', fontSize: '12px',
					fontFamily: FONT, color: C.text, outline: 'none'
				}) + '">' +
				smallBtn('', '添加', { 'custom-add': '1' }) +
				smallBtn('', '取消', { 'custom-cancel': '1' }) +
				'</div></div>';
		}

		return '' +
			cards + customForm +
			'<div style="' + st({ marginTop: '4px' }) + '">' +
			'<select id="eai-add-provider" style="' + st({
				width: '100%', height: '32px', padding: '0 9px', borderRadius: '8px',
				border: '1px dashed ' + C.borderStrong, background: '#fbfcfe',
				fontSize: '12.5px', color: C.primary, fontFamily: FONT, outline: 'none'
			}) + '">' + addOptions + '</select>' +
			'</div>';
	}

	function paneParams() {
		return field('Temperature',
			'<input type="number" id="eai-temp" step="0.1" min="0" max="2" value="' +
			U.esc(String(draft.temperature)) + '" style="' + inputCss() + '">') +
			field('Max tokens',
				'<input type="number" id="eai-maxtok" step="512" min="256" value="' +
				U.esc(String(draft.maxTokens)) + '" style="' + inputCss() + '">') +
			field('超时（秒）',
				'<input type="number" id="eai-timeout" step="30" min="20" value="' +
				U.esc(String(draft.timeout)) + '" style="' + inputCss() + '">') +
			field('最大工具步数',
				'<input type="number" id="eai-steps" step="1" min="1" max="40" value="' +
				U.esc(String(draft.maxSteps)) + '" style="' + inputCss() + '">',
				'一次对话里最多允许模型调用多少次工具') +
			field('回答语言',
				'<select id="eai-lang" style="' + inputCss() + '">' +
				'<option value="zh"' + (draft.language !== 'en' ? ' selected' : '') + '>中文</option>' +
				'<option value="en"' + (draft.language === 'en' ? ' selected' : '') + '>English</option>' +
				'</select>') +
			field('额外请求头',
				'<input id="eai-headers" type="text" value="' + U.esc(draft.extraHeaders || '') +
				'" placeholder="X-Custom: 1" style="' + inputCss() + '">',
				'可选，一行一个 Key: Value');
	}

	function paneDiag() {
		return '<div style="' + st({ fontSize: '12px', color: C.muted, marginBottom: '8px' }) +
			'">反馈问题时请附上这段信息</div>' +
			'<div id="eai-diag" style="' + st({
				fontFamily: MONO, fontSize: '11px', background: C.surface,
				border: '1px solid ' + C.border, borderRadius: '9px', padding: '10px 12px',
				color: '#43536b', maxHeight: '260px', overflow: 'auto', lineHeight: '1.6'
			}) + '">' + diagHtml() + '</div>' +
			'<div style="' + st({ marginTop: '10px' }) + '">' +
			smallBtn('eai-copy-diag', '复制诊断信息') + '</div>';
	}

	function bodyHtml() {
		if (tab === 'params') return paneParams();
		if (tab === 'diag') return paneDiag();
		return paneProviders();
	}

	/* ------------------------------------------------------------ render -- */

	function render() {
		if (!UI.dlgSettings) return;
		var $ = EAI.jq;
		var body = $('#eai-set-body', UI.dlgSettings);
		if (!body.length) return;
		body.html(bodyHtml());

		$('.eai-set-nav', UI.dlgSettings).each(function () {
			var id = $(this).attr('data-tab');
			var active = id === tab;
			$(this).attr('style', st({
				display: 'block', padding: '7px 10px', borderRadius: '8px', marginBottom: '3px',
				textDecoration: 'none', fontSize: '12.5px',
				background: active ? '#e8f1ff' : 'transparent',
				color: active ? C.primary : '#3a4a63',
				fontWeight: active ? '600' : '400'
			}));
		});

		var msgEl = $('#eai-msg', UI.dlgSettings);
		if (msgEl.length) {
			msgEl.css('color', messageErr ? '#932626' : (message ? '#1d7a3e' : C.muted));
		}
	}

	function say(text, isErr) {
		message = text || '';
		messageErr = !!isErr;
		if (!UI.dlgSettings) return;
		var $ = EAI.jq;
		$('#eai-msg', UI.dlgSettings)
			.text(EAI.i18n ? EAI.i18n.tr(message) : message)
			.css('color', isErr ? '#932626' : (message ? '#1d7a3e' : C.muted));
	}

	/* ----------------------------------------------------------- actions -- */

	function findProvider(id) {
		var list = draft.providers || [];
		for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
		return null;
	}

	function addProvider(preset, wantedName) {
		var name = wantedName || (preset ? preset.label : '新供应商');
		var base = name, n = 2;
		while (EAI.cfg.nameTaken(draft, base)) { base = name + ' ' + n; n++; }

		var p = {
			id: EAI.cfgId('p'),
			name: base,
			protocol: preset ? preset.protocol : 'openai',
			baseUrl: preset ? preset.base : '',
			apiKey: '',
			collapsed: false,
			models: preset ? [{ id: EAI.cfgId('m'), name: preset.model }] : []
		};
		draft.providers.push(p);
		if (!draft.active || !findProvider(draft.active.providerId)) {
			draft.active = { providerId: p.id, modelId: p.models[0] ? p.models[0].id : '' };
		}
		render();
		say('已添加供应商：' + p.name);
	}

	function removeProvider(id) {
		draft.providers = draft.providers.filter(function (p) { return p.id !== id; });
		if (draft.active && draft.active.providerId === id) {
			var first = draft.providers[0];
			draft.active = first
				? { providerId: first.id, modelId: (first.models[0] || {}).id || '' }
				: { providerId: '', modelId: '' };
		}
		delete fetched[id];
		render();
	}

	function validate() {
		var names = {};
		for (var i = 0; i < draft.providers.length; i++) {
			var p = draft.providers[i];
			var n = String(p.name || '').trim().toLowerCase();
			if (!n) return '供应商名称不能为空';
			if (names[n]) return '供应商名称重复：' + p.name;
			names[n] = 1;

			var seen = {};
			for (var j = 0; j < (p.models || []).length; j++) {
				var m = String(p.models[j].name || '').trim();
				if (!m) return '「' + p.name + '」有空的模型名';
				var k = m.toLowerCase();
				if (seen[k]) return '「' + p.name + '」模型重复：' + m;
				seen[k] = 1;
			}
		}
		return '';
	}

	/* -------------------------------------------------------------- open -- */

	UI.openSettings = function () {
		injectStyle();
		var $ = EAI.jq;

		if (UI.dlgSettings && !UI.isAlive(UI.dlgSettingsCtl)) {
			UI.dlgSettings = null;
			UI.dlgSettingsCtl = null;
		}
		if (UI.dlgSettings) {
			try { UI.dlgSettingsCtl.open(); } catch (e) { /* ignore */ }
			return UI.dlgSettings;
		}

		draft = U.clone(EAI.cfg.raw(true));
		tab = 'providers';
		fetched = {};
		confirmClear = false;
		addingCustom = false;
		customName = '';
		message = '';
		messageErr = false;

		var html = UI.styleBlock() + '<div class="eai-root" style="' + st({
			fontFamily: FONT, fontSize: '13px', color: C.text, background: C.bg,
			height: '100%', display: 'flex', flexDirection: 'column'
		}) + '">' +

			'<div style="' + st({ flex: '1 1 auto', minHeight: '0', display: 'flex' }) + '">' +
			'<div style="' + st({
				width: '152px', flex: '0 0 auto', borderRight: '1px solid ' + C.border,
				background: '#f7f9fc', padding: '12px 8px'
			}) + '">' +
			'<a href="#" class="eai-set-nav" data-tab="providers" style="display:block">供应商与模型</a>' +
			'<a href="#" class="eai-set-nav" data-tab="params" style="display:block">生成参数</a>' +
			'<a href="#" class="eai-set-nav" data-tab="diag" style="display:block">诊断</a>' +
			'</div>' +
			'<div id="eai-set-body" style="' + st({
				flex: '1 1 auto', minWidth: '0', overflowY: 'auto', padding: '14px 16px'
			}) + '"></div>' +
			'</div>' +

			'<div style="' + st({
				flex: '0 0 auto', borderTop: '1px solid ' + C.border,
				background: C.surface, padding: '10px 16px'
			}) + '">' +
			'<div id="eai-msg" style="' + st({
				fontSize: '12px', color: C.muted, minHeight: '17px', marginBottom: '8px'
			}) + '"></div>' +
			'<div id="eai-set-actions" style="' + st({ display: 'flex', gap: '8px' }) + '">' +
			'<button id="eai-save" class="eai-btn" style="' + st({
				background: C.primary, border: '1px solid ' + C.primary, color: '#fff',
				borderRadius: '9px', padding: '8px 22px', fontSize: '12.5px',
				fontWeight: '600', fontFamily: FONT
			}) + '">保存</button>' +
			'<button id="eai-cancel" class="eai-btn" style="' + ghostBtn() + '">取消</button>' +
			'<span style="flex:1"></span>' +
			'<button id="eai-clear-config" class="eai-btn" style="' + ghostBtn() + '">清除配置</button>' +
			'</div></div>' +
			'</div>';

		var ctl = EAI.dlg({
			title: U.t('eai.settings.title', 'AI 设置'),
			width: 660,
			height: 640,
			modal: true,
			content: html
		});
		if (!ctl) return null;
		UI.dlgSettingsCtl = ctl;
		UI.dlgSettings = ctl.el;
		var $d = ctl.el;

		render();
		var msgEl = $('#eai-msg', $d);
		if (msgEl.length) msgEl.css('color', C.muted);

		/* ---- navigation ---- */
		$d.on('click', '.eai-set-nav', function (e) {
			e.preventDefault();
			tab = $(this).attr('data-tab');
			render();
		});

		/* ---- provider fields ---- */
		$d.on('input', '[data-pf]', function () {
			var p = findProvider($(this).attr('data-id'));
			if (!p) return;
			p[$(this).attr('data-pf')] = $(this).val();
		});
		$d.on('change', '[data-pf]', function () {
			var p = findProvider($(this).attr('data-id'));
			if (!p) return;
			p[$(this).attr('data-pf')] = $(this).val();
			var k = $(this).attr('data-pf');
			if (k === 'name' || k === 'protocol') render();
		});

		$d.on('input', '[data-pm]', function () {
			var p = findProvider($(this).attr('data-id'));
			if (!p) return;
			var mid = $(this).attr('data-pm');
			p.models.forEach(function (m) { if (m.id === mid) m.name = $(this).val(); }, this);
		});

		/* ---- structural actions ---- */
		$d.on('click', '[data-toggle]', function (e) {
			e.preventDefault();
			var p = findProvider($(this).attr('data-toggle'));
			if (!p) return;
			p.collapsed = !p.collapsed;
			render();
		});

		$d.on('click', '[data-del-provider]', function (e) {
			e.preventDefault();
			removeProvider($(this).attr('data-del-provider'));
			say('已删除供应商');
		});

		$d.on('click', '[data-add-model]', function (e) {
			e.preventDefault();
			var p = findProvider($(this).attr('data-add-model'));
			if (!p) return;
			p.models = p.models || [];
			p.models.push({ id: EAI.cfgId('m'), name: '' });
			p.collapsed = false;
			render();
		});

		$d.on('click', '[data-del-model]', function (e) {
			e.preventDefault();
			var p = findProvider($(this).attr('data-id'));
			if (!p) return;
			var mid = $(this).attr('data-del-model');
			p.models = p.models.filter(function (m) { return m.id !== mid; });
			if (draft.active && draft.active.modelId === mid) {
				draft.active.modelId = (p.models[0] || {}).id || '';
			}
			render();
		});

		$d.on('change', '#eai-add-provider', function () {
			var v = $(this).val();
			$(this).val('');
			if (v === '') return;

			if (v === 'custom') {
				addingCustom = true;
				customName = '';
				render();
				try { $('#eai-custom-name', $d).focus(); } catch (e) { /* ignore */ }
				return;
			}
			addProvider(PRESETS[Number(v)]);
		});

		$d.on('input', '#eai-custom-name', function () {
			customName = $(this).val();
		});

		$d.on('click', '[data-custom-add]', function (e) {
			e.preventDefault();
			var name = String(customName || '').trim();
			if (!name) { say('请输入供应商名称', true); return; }
			if (EAI.cfg.nameTaken(draft, name)) { say('供应商名称重复：' + name, true); return; }
			addProvider(null, name);
			addingCustom = false;
			customName = '';
			render();
		});

		$d.on('click', '[data-custom-cancel]', function (e) {
			e.preventDefault();
			addingCustom = false;
			customName = '';
			render();
		});

		/* ---- fetch model list ---- */
		$d.on('click', '[data-fetch]', function (e) {
			e.preventDefault();
			var p = findProvider($(this).attr('data-fetch'));
			if (!p) return;
			if (!p.baseUrl || !p.apiKey) {
				say('请先填写接口地址与 API Key', true);
				return;
			}
			fetched[p.id] = { loading: true };
			render();
			EAI.llm.listModels({
				provider: p.protocol,
				baseUrl: p.baseUrl,
				apiKey: p.apiKey
			}).then(function (names) {
				fetched[p.id] = { names: names };
				render();
			}).catch(function (err) {
				fetched[p.id] = { error: (err && err.message) || String(err) };
				render();
			});
		});

		$d.on('click', '[data-pick-add]', function (e) {
			e.preventDefault();
			var p = findProvider($(this).attr('data-pick-add'));
			if (!p) return;
			var added = 0, dup = 0;
			$('input[data-pick="' + p.id + '"]:checked', $d).each(function () {
				var name = $(this).val();
				if (EAI.cfg.modelTaken(p, name)) { dup++; return; }
				p.models.push({ id: EAI.cfgId('m'), name: name });
				added++;
			});
			if (!draft.active || !findProvider(draft.active.providerId)) {
				draft.active = { providerId: p.id, modelId: (p.models[0] || {}).id || '' };
			}
			fetched[p.id] = null;
			render();
			say('已添加 ' + added + ' 个模型' + (dup ? '，跳过 ' + dup + ' 个重复项' : ''));
		});

		$d.on('click', '[data-pick-cancel]', function (e) {
			e.preventDefault();
			fetched[$(this).attr('data-pick-cancel')] = null;
			render();
		});

		/* ---- params pane ---- */
		$d.on('change', '#eai-temp', function () { draft.temperature = Number($(this).val() || 0); });
		$d.on('change', '#eai-maxtok', function () { draft.maxTokens = Number($(this).val() || 8192); });
		$d.on('change', '#eai-timeout', function () { draft.timeout = Number($(this).val() || 300); });
		$d.on('change', '#eai-steps', function () { draft.maxSteps = Number($(this).val() || 12); });
		$d.on('change', '#eai-lang', function () { draft.language = $(this).val(); });
		$d.on('input', '#eai-headers', function () { draft.extraHeaders = $(this).val(); });

		/* ---- diagnostics ---- */
		$d.on('click', '#eai-copy-diag', function () {
			try {
				var ta = document.createElement('textarea');
				ta.value = EAI.diagnostics() + '\n\n--- log ---\n' + EAI.logLines.slice(-40).join('\n');
				document.body.appendChild(ta);
				ta.select();
				document.execCommand('copy');
				document.body.removeChild(ta);
				say('已复制诊断信息');
			} catch (err) {
				say('复制失败：' + err, true);
			}
		});

		/* ---- save / cancel / clear ---- */
		$d.on('click', '#eai-save', function () {
			var problem = validate();
			if (problem) { say(problem, true); return; }

			/* keep active pointing at something valid */
			if (!findProvider(draft.active && draft.active.providerId)) {
				var first = draft.providers[0];
				draft.active = first
					? { providerId: first.id, modelId: (first.models[0] || {}).id || '' }
					: { providerId: '', modelId: '' };
			}

			EAI.cfg.save(U.clone(draft));
			EAI._cfg = null;
			UI.refreshStatus();
			if (UI.renderModelPicker) UI.renderModelPicker();
			say('已保存');
			render();
		});

		$d.on('click', '#eai-cancel', function () {
			try { UI.dlgSettingsCtl.close(); } catch (e) { /* ignore */ }
			draft = null;
			UI.dlgSettings = null;
			UI.dlgSettingsCtl = null;
		});

		$d.on('click', '#eai-clear-config', function () {
			if (confirmClear) return;
			confirmClear = true;
			$('#eai-set-actions', $d).html(
				'<span style="' + st({ fontSize: '12px', color: '#932626', alignSelf: 'center' }) +
				'">确定清除已保存的接口配置？</span>' +
				'<button id="eai-clear-yes" class="eai-btn" style="' + st({
					background: '#fff', border: '1px solid #e3a9a9', color: '#a83232',
					borderRadius: '9px', padding: '7px 16px', fontSize: '12.5px', fontFamily: FONT
				}) + '">确认清除</button>' +
				'<button id="eai-clear-no" class="eai-btn" style="' + ghostBtn() + '">取消</button>');
		});

		$d.on('click', '#eai-clear-yes', function () {
			UI.clearConfig();
			draft = U.clone(EAI.cfg.raw(true));
			confirmClear = false;
			tab = 'providers';
			render();
			UI.renderModelPicker && UI.renderModelPicker();
			say('已清除已保存的配置');
			/* restore footer buttons */
			$('#eai-set-actions', $d).html(
				'<button id="eai-save" class="eai-btn" style="' + st({
					background: C.primary, border: '1px solid ' + C.primary, color: '#fff',
					borderRadius: '9px', padding: '8px 22px', fontSize: '12.5px',
					fontWeight: '600', fontFamily: FONT
				}) + '">保存</button>' +
				'<button id="eai-cancel" class="eai-btn" style="' + ghostBtn() + '">取消</button>' +
				'<span style="flex:1"></span>' +
				'<button id="eai-clear-config" class="eai-btn" style="' + ghostBtn() + '">清除配置</button>');
		});

		$d.on('click', '#eai-clear-no', function () {
			confirmClear = false;
			$('#eai-set-actions', $d).html(
				'<button id="eai-save" class="eai-btn" style="' + st({
					background: C.primary, border: '1px solid ' + C.primary, color: '#fff',
					borderRadius: '9px', padding: '8px 22px', fontSize: '12.5px',
					fontWeight: '600', fontFamily: FONT
				}) + '">保存</button>' +
				'<button id="eai-cancel" class="eai-btn" style="' + ghostBtn() + '">取消</button>' +
				'<span style="flex:1"></span>' +
				'<button id="eai-clear-config" class="eai-btn" style="' + ghostBtn() + '">清除配置</button>');
			say('');
		});

		return UI.dlgSettings;
	};

	/** Removes every persisted setting (also used by the tests). */
	UI.clearConfig = function () {
		var fresh = null;
		try {
			window.localStorage.removeItem('eai.config.v2.' + EAI.discoverExtId());
		} catch (e) { /* ignore */ }
		try {
			var payload = {};
			payload[EAI.discoverExtId()] = {};
			payload[EAI.discoverExtId()]['config'] = '{}';
			EAI.api('saveConfig', payload);
		} catch (e) { /* ignore */ }
		EAI._cfg = null;
		fresh = EAI.cfg.raw(true);
		EAI.log('saved configuration cleared');
		return fresh;
	};
})();
