(function () {
	'use strict';

	var EAI = (window.EAI = window.EAI || {});
	var UI = (EAI.ui = EAI.ui || {});
	var U = EAI.util;
	var st = UI.st;
	var C = UI.C;
	var FONT = UI.FONT;
	var MONO = UI.MONO;
	var styleBlock = UI.styleBlock;
	var injectStyle = UI.injectStyle;
	var ghostBtn = UI.ghostBtn;
	var isAlive = UI.isAlive;

	/* --------------------------------------------------------- settings -- */

	var PROVIDERS = [
		{ id: 'openai', label: 'OpenAI', protocol: 'openai',
		  base: 'https://api.openai.com/v1', model: 'gpt-6.0' },
		{ id: 'anthropic', label: 'Anthropic Claude', protocol: 'anthropic',
		  base: 'https://api.anthropic.com/v1', model: 'claude-sonnet-5-5' },
		{ id: 'deepseek', label: 'DeepSeek', protocol: 'openai',
		  base: 'https://api.deepseek.com/v1', model: 'deepseek-flash' },
		{ id: 'qwen', label: '阿里云百炼 · 通义千问', protocol: 'openai',
		  base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen3.8-max' },
		{ id: 'zhipu', label: '智谱 GLM', protocol: 'openai',
		  base: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-5.3-flash' },
		{ id: 'moonshot', label: 'Moonshot / Kimi', protocol: 'openai',
		  base: 'https://api.moonshot.cn/v1', model: 'kimi-k3.1' },
		{ id: 'siliconflow', label: 'SiliconFlow 硅基流动', protocol: 'openai',
		  base: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen3.8-Max' },
		{ id: 'openrouter', label: 'OpenRouter', protocol: 'openai',
		  base: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-sonnet-5.5' },
		{ id: 'ollama', label: '本地 Ollama', protocol: 'openai',
		  base: 'http://127.0.0.1:11434/v1', model: 'qwen3:8b' },
		{ id: 'azure', label: 'Azure OpenAI', protocol: 'openai',
		  base: 'https://<resource>.openai.azure.com/openai/deployments/<deployment>', model: 'gpt-6.0' },
		{ id: 'custom-openai', label: '自定义 OpenAI 兼容接口', protocol: 'openai',
		  base: 'https://<your-gateway>/v1', model: '' },
		{ id: 'custom-anthropic', label: '自定义 Claude 兼容接口', protocol: 'anthropic',
		  base: 'https://<your-gateway>/v1', model: 'claude-sonnet-5-5' }
	];

	function labelCss() {
		return st({
			flex: '0 0 92px', textAlign: 'right', fontSize: '12px', fontWeight: '600',
			color: '#3a4a63', lineHeight: '1.4'
		});
	}

	function inputCss() {
		return st({
			width: '100%', boxSizing: 'border-box', height: '34px', padding: '0 10px',
			border: '1px solid #d8e0ec', borderRadius: '8px', fontSize: '12.5px',
			fontFamily: FONT, color: C.text, background: '#fff', outline: 'none'
		});
	}

	function smallInputCss() {
		return st({
			width: '72px', boxSizing: 'border-box', height: '30px', padding: '0 8px',
			border: '1px solid #d8e0ec', borderRadius: '7px', fontSize: '12px',
			fontFamily: FONT, color: C.text, background: '#fff', outline: 'none'
		});
	}

	/** label | control | (optional) hint — all on ONE line. */
	function field(label, inner, note) {
		return '<div style="' + st({
			display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '9px'
		}) + '">' +
			'<label style="' + labelCss() + '">' + label + '</label>' +
			'<div style="' + st({
				flex: '1 1 auto', minWidth: '0', display: 'flex',
				alignItems: 'center', gap: '8px'
			}) + '">' +
			'<div style="' + st({ flex: '1 1 auto', minWidth: '0' }) + '">' + inner + '</div>' +
			(note ? '<div style="' + st({
				flex: '0 1 auto', maxWidth: '40%', fontSize: '10.5px', color: C.muted,
				whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
			}) + '">' + note + '</div>' : '') +
			'</div>' +
			'</div>';
	}

	/** Compact numeric control: 「label [input]」 on one line. */
	function numField(label, id, value, step, min) {
		return '<div style="' + st({
			display: 'flex', alignItems: 'center', gap: '6px', flex: '0 0 auto'
		}) + '">' +
			'<label style="' + st({
				fontSize: '11.5px', color: '#3a4a63', whiteSpace: 'nowrap'
			}) + '">' + label + '</label>' +
			'<input class="eai-in" type="number" id="' + id + '" value="' + U.esc(String(value)) + '"' +
			' step="' + step + '" min="' + min + '" style="' + smallInputCss() + '">' +
			'</div>';
	}

	/** Diagnostics block — re-rendered whenever the configuration changes. */
	function diagHtml() {
		return EAI.diagnostics().split('\n').map(function (l) {
			return '<div style="' + st({
				whiteSpace: 'pre-wrap', wordBreak: 'break-all'
			}) + '">' + U.esc(l) + '</div>';
		}).join('');
	}

	/** Collapsible section header (used for the rarely edited settings). */
	function sectionToggle(id, title, hint) {
		return '<div data-eai-sec="' + id + '" style="' + st({
			display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 12px',
			cursor: 'pointer', userSelect: 'none'
		}) + '">' +
			'<span data-eai-chev="' + id + '" style="' + st({
				width: '12px', color: C.muted, fontSize: '11px', flex: '0 0 auto'
			}) + '">&#9656;</span>' +
			'<span style="' + st({
				width: '3px', height: '14px', background: C.primary,
				borderRadius: '2px', display: 'inline-block', flex: '0 0 auto'
			}) + '"></span>' +
			'<span style="' + st({ fontSize: '13px', fontWeight: '600', color: C.primaryDark }) + '">' +
			title + '</span>' +
			(hint ? '<span style="' + st({ fontSize: '11px', color: C.muted }) + '">' + hint + '</span>' : '') +
			'</div>';
	}

	function sectionTitle(text, hint) {
		return '<div style="' + st({
			display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 13px'
		}) + '">' +
			'<span style="' + st({
				width: '3px', height: '14px', background: C.primary,
				borderRadius: '2px', display: 'inline-block', flex: '0 0 auto'
			}) + '"></span>' +
			'<span style="' + st({ fontSize: '13px', fontWeight: '600', color: C.primaryDark }) + '">' +
			text + '</span>' +
			(hint ? '<span style="' + st({ fontSize: '11px', color: C.muted }) + '">' + hint + '</span>' : '') +
			'</div>';
	}

	function primaryBtn(text, id) {
		return '<button id="' + id + '" class="eai-btn" style="' + st({
			background: C.primary, border: '1px solid ' + C.primary, color: '#fff',
			borderRadius: '9px', padding: '9px 24px', fontSize: '12.5px',
			fontWeight: '600', fontFamily: FONT, boxShadow: '0 2px 8px rgba(47,111,191,.28)'
		}) + '">' + text + '</button>';
	}

	UI.openSettings = function () {
		injectStyle();
		var $ = EAI.jq;

		if (UI.dlgSettings && !isAlive(UI.dlgSettingsCtl)) {
			UI.dlgSettings = null;
			UI.dlgSettingsCtl = null;
		}
		if (UI.dlgSettings) {
			try { UI.dlgSettingsCtl.open(); } catch (e) { /* ignore */ }
			try { $('#eai-diag', UI.dlgSettings).html(diagHtml()); } catch (e) { /* ignore */ }
			return UI.dlgSettings;
		}

		var cfg = EAI.cfg.current();
		var opts = '<option value="">— 自定义 —</option>';
		PROVIDERS.forEach(function (p) {
			opts += '<option value="' + p.id + '">' + U.esc(p.label) + '</option>';
		});
		function opt(v, t, cur) {
			return '<option value="' + v + '"' + (String(cur) === v ? ' selected' : '') + '>' + t + '</option>';
		}

		var html = styleBlock() + '<div class="eai-root" style="' + st({
			fontFamily: FONT, fontSize: '13px', color: C.text, background: C.bg,
			boxSizing: 'border-box', width: '100%', overflowX: 'hidden'
		}) + '">' +

			/* ---------------- model access ---------------- */
			'<div style="' + st({ padding: '18px 22px 2px' }) + '">' +
			sectionTitle('模型接入') +

			field('接口协议',
				'<select id="eai-provider" class="eai-in" style="' + inputCss() + '">' +
				opt('openai', 'OpenAI 兼容（/chat/completions）', cfg.provider) +
				opt('anthropic', 'Anthropic（/messages）', cfg.provider) +
				'</select>',
				'<span id="eai-provider-note"></span>') +

			field('供应商快捷填入',
				'<select id="eai-preset" style="' + inputCss() + '">' + opts + '</select>',
				'只帮你填地址和模型，下面的内容都可以手动改') +

			field('接口地址 Base URL <span style="' + st({
				fontSize: '10.5px', fontWeight: '400', color: C.muted
			}) + '">（可完全自定义）</span>',
				'<input class="eai-in" type="text" id="eai-baseurl" value="' + U.esc(cfg.baseUrl) +
				'" placeholder="https://api.openai.com/v1" style="' + inputCss() + '">',
				'实际请求：<code id="eai-endpoint" style="' + st({
					background: '#eef2f8', padding: '2px 6px', borderRadius: '5px',
					fontFamily: MONO, fontSize: '11px', color: '#2f5fa8'
				}) + '">-</code>') +

			field('API Key',
				'<input class="eai-in" type="password" id="eai-apikey" value="' + U.esc(cfg.apiKey) +
				'" placeholder="sk-..." style="' + inputCss() + '">',
				'保存在扩展配置与本机，不会上传到任何第三方') +

			field('模型 Model',
				'<input class="eai-in" type="text" id="eai-model" value="' + U.esc(cfg.model) +
				'" placeholder="gpt-4o / claude-sonnet-4-5 / deepseek-chat" style="' + inputCss() + '">') +
			'</div>' +

			/* ---------------- generation ---------------- */
			'<div style="' + st({ height: '1px', background: C.border, margin: '4px 22px 16px' }) + '"></div>' +
			'<div style="' + st({ padding: '0 22px 2px' }) + '">' +
			sectionToggle('params', '生成参数', '默认折叠') +
			'<div id="eai-sec-body-params" style="display:none">' +

			'<div style="' + st({
				display: 'flex', gap: '18px', marginBottom: '9px', flexWrap: 'wrap'
			}) + '">' +
			numField('Temp', 'eai-temp', cfg.temperature, '0.1', '0') +
			numField('Max tokens', 'eai-maxtok', cfg.maxTokens, '512', '256') +
			numField('超时(s)', 'eai-timeout', cfg.timeout, '30', '20') +
			'</div>' +

			'<div style="' + st({
				display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '9px'
			}) + '">' +
			'<label style="' + st({ fontSize: '11.5px', color: '#3a4a63', whiteSpace: 'nowrap' }) +
			'">回答语言</label>' +
			'<select id="eai-lang" class="eai-in" style="' + st({
				width: '104px', boxSizing: 'border-box', height: '30px', padding: '0 6px',
				border: '1px solid #d8e0ec', borderRadius: '7px', fontSize: '12px',
				fontFamily: FONT, color: C.text, outline: 'none'
			}) + '">' +
			opt('zh', '中文', cfg.language) + opt('en', 'English', cfg.language) +
			'</select>' +
			numField('最大工具步数', 'eai-steps', cfg.maxSteps, '1', '1') +
			'</div>' +

			field('额外请求头',
				'<input class="eai-in" type="text" id="eai-headers" value="' + U.esc(cfg.extraHeaders) +
				'" placeholder="X-Custom: 1" style="' + inputCss() + '">',
				'可选，一行一个 Key: Value') +
			'</div>' +
			'</div>' +

			/* ---------------- diagnostics ---------------- */
			'<div style="' + st({ height: '1px', background: C.border, margin: '2px 22px 16px' }) + '"></div>' +
			'<div style="' + st({ padding: '0 22px 16px' }) + '">' +
			sectionToggle('diag', '诊断', '反馈问题时请附上这段信息') +
			'<div id="eai-sec-body-diag" style="display:none">' +
			'<div id="eai-diag" style="' + st({
				fontFamily: MONO, fontSize: '11px', background: C.surface,
				border: '1px solid ' + C.border, borderRadius: '9px', padding: '10px 12px',
				whiteSpace: 'pre-wrap', wordBreak: 'break-all',
				color: '#43536b', maxHeight: '110px', overflow: 'auto', lineHeight: '1.6'
			}) + '">' + diagHtml() + '</div>' +
			'</div>' +
			'</div>' +

			/* ---------------- footer ---------------- */
			'<div style="' + st({
				padding: '12px 22px 16px', borderTop: '1px solid ' + C.border,
				background: C.surface
			}) + '">' +
			'<div id="eai-msg" style="' + st({
				fontSize: '12px', color: C.muted, minHeight: '17px', marginBottom: '10px'
			}) + '"></div>' +
			'<div style="' + st({ display: 'flex', gap: '9px', flexWrap: 'wrap' }) + '">' +
			primaryBtn('保存', 'eai-save') +
			'<button id="eai-test" class="eai-btn" style="' + ghostBtn() + '">测试连接</button>' +
			'<button id="eai-copy-diag" class="eai-btn" style="' + ghostBtn() + '">复制诊断信息</button>' +
			'<button id="eai-clear-config" class="eai-btn" style="' + ghostBtn() + '">清除已保存的配置</button>' +
			'</div></div>' +
			'</div>';

		var ctl = EAI.dlg({
			title: 'AI 设置',
			width: 620,
			height: 720,
			modal: true,
			content: html
		});
		if (!ctl) return null;
		UI.dlgSettingsCtl = ctl;
		var $d = ctl.el;
		UI.dlgSettings = $d;

		function collect() {
			return {
				provider: $('#eai-provider', $d).val(),
				baseUrl: ($('#eai-baseurl', $d).val() || '').trim(),
				apiKey: ($('#eai-apikey', $d).val() || '').trim(),
				model: ($('#eai-model', $d).val() || '').trim(),
				temperature: Number($('#eai-temp', $d).val() || 0),
				maxTokens: Number($('#eai-maxtok', $d).val() || 8192),
				timeout: Number($('#eai-timeout', $d).val() || 300),
				language: $('#eai-lang', $d).val(),
				maxSteps: Number($('#eai-steps', $d).val() || 12),
				extraHeaders: ($('#eai-headers', $d).val() || '').trim()
			};
		}

		function noteFor(p) {
			return p === 'anthropic'
				? '请求头 x-api-key + anthropic-version；地址拼成 &lt;base&gt;/messages'
				: '请求头 Authorization: Bearer；地址拼成 &lt;base&gt;/chat/completions';
		}

		function refreshEndpoint() {
			try { $('#eai-endpoint', $d).text(EAI.llm.endpoint(collect())); }
			catch (e) { $('#eai-endpoint', $d).text('-'); }
		}

		/* collapsible sections */
		$d.find('[data-eai-sec]').on('click', function () {
			var id = $(this).attr('data-eai-sec');
			var body = $('#eai-sec-body-' + id, $d);
			if (!body.length) return;
			var open = body.css('display') === 'none';
			body.css('display', open ? 'block' : 'none');
			$d.find('[data-eai-chev="' + id + '"]').html(open ? '&#9662;' : '&#9656;');
		});

		var $note = $('#eai-provider', $d).parent().find('#eai-provider-note');
		$note.html(noteFor(cfg.provider));

		$('#eai-provider', $d).on('change', function () {
			$note.html(noteFor(this.value));
			refreshEndpoint();
		});
		$('#eai-baseurl', $d).on('input', refreshEndpoint);

		$('#eai-preset', $d).on('change', function () {
			var id = this.value, p = null, i;
			if (!id) return;
			for (i = 0; i < PROVIDERS.length; i++) if (PROVIDERS[i].id === id) { p = PROVIDERS[i]; break; }
			if (!p) return;
			$('#eai-provider', $d).val(p.protocol);
			$note.html(noteFor(p.protocol));
			$('#eai-baseurl', $d).val(p.base);
			if (p.model) $('#eai-model', $d).val(p.model);
			refreshEndpoint();
			$('#eai-msg', $d).css('color', '#5a6b85').text('已填入预设，地址 / 模型 / Key 仍可修改。');
		});

		$('#eai-save', $d).on('click', function () {
			var c = collect();
			EAI.cfg.save(c);
			EAI._cfg = c;
			$('#eai-msg', $d).css('color', '#1d7a3e')
				.text('已保存：' + c.provider + ' · ' + (c.model || '-') + ' · ' + EAI.llm.endpoint(c));
			UI.refreshStatus();
			$('#eai-diag', $d).html(diagHtml());
			UI.appendMsg('sys', '设置已保存。');
		});

		$('#eai-test', $d).on('click', function () {
			var c = collect();
			if (!c.apiKey || !c.baseUrl || !c.model) {
				$('#eai-msg', $d).css('color', '#932626').text('请填写接口地址、API Key 与模型名。');
				return;
			}
			$('#eai-msg', $d).css('color', '#5a6b85').text('正在测试 ' + EAI.llm.endpoint(c) + ' …');
			$('#eai-test', $d).prop('disabled', true);
			EAI.llm.test(c).then(function (r) {
				$('#eai-msg', $d).css('color', '#1d7a3e').text('连接正常 — ' + r);
			}).catch(function (e) {
				$('#eai-msg', $d).css('color', '#932626').text('连接失败：' + e.message);
			}).then(function () { $('#eai-test', $d).prop('disabled', false); });
		});

		$('#eai-copy-diag', $d).on('click', function () {
			var txt = EAI.diagnostics() + '\n\n--- log ---\n' + EAI.logLines.slice(-40).join('\n');
			try {
				var ta = document.createElement('textarea');
				ta.value = txt;
				document.body.appendChild(ta);
				ta.select();
				document.execCommand('copy');
				document.body.removeChild(ta);
				$('#eai-msg', $d).css('color', '#1d7a3e').text('诊断信息已复制。');
			} catch (e) {
				$('#eai-msg', $d).css('color', '#932626').text('复制失败：' + e);
			}
		});

		$('#eai-clear-config', $d).on('click', function () {
			var ok = window.confirm('清除本扩展保存的接口配置（API Key 等）？这不会删除扩展本身。');
			if (!ok) return;
			UI.clearConfig();
			$('#eai-msg', $d).css('color', '#1d7a3e').text('已清除本扩展保存的配置。');
			$('#eai-baseurl', $d).val('');
			$('#eai-apikey', $d).val('');
			$('#eai-model', $d).val('');
			$('#eai-headers', $d).val('');
			refreshEndpoint();
			UI.refreshStatus();
			$('#eai-diag', $d).html(diagHtml());
		});

		refreshEndpoint();
		return $d;
	};

	/**
	 * Removes everything we persist: the per-id localStorage copy and the
	 * entry inside the editor's extensionConfig.  The editor's own "remove
	 * extension" action does NOT touch either of them, which is why the key
	 * survives from one session to the next.
	 */
	UI.clearConfig = function () {
		var defaults = {};
		Object.keys(EAI.cfgDefaults).forEach(function (k) { defaults[k] = EAI.cfgDefaults[k]; });
		try {
			window.localStorage.removeItem('eai.config.v2.' + EAI.discoverExtId());
		} catch (e) { /* ignore */ }
		try {
			var payload = {};
			payload[EAI.discoverExtId()] = {};
			payload[EAI.discoverExtId()]['config'] = JSON.stringify(defaults);
			EAI.api('saveConfig', payload);
		} catch (e) { /* ignore */ }
		EAI._cfg = defaults;
		EAI.log('saved configuration cleared');
	};

})();
