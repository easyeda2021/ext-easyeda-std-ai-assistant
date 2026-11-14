/* =====================================================================
 * EasyEDA Std extension — "AI Assistant"
 * ui.js — settings dialog, AI panel, report rendering and the features
 * ===================================================================== */
(function () {
	'use strict';

	var EAI = (window.EAI = window.EAI || {});
	var UI = (EAI.ui = {});
	var U = EAI.util;

	var dlgPanel = null, dlgSettings = null;
	var history = [];          /* conversation for the current session */
	var lastReport = '';       /* markdown of the last report          */
	var pendingImage = null;   /* {dataUrl, base64, mediaType}         */

	/* ------------------------------------------------------------- style -- */

	var CSS = [
		'.eai-root{font-family:"Microsoft YaHei",Segoe UI,Verdana,sans-serif;font-size:13px;color:#222;}',
		'.eai-bar{display:flex;align-items:center;gap:8px;padding:6px 10px;background:#f3f6fb;border-bottom:1px solid #dfe6f0;flex-wrap:wrap;}',
		'.eai-bar .eai-status{color:#5a6b85;font-size:12px;}',
		'.eai-actions{display:flex;flex-wrap:wrap;gap:6px;padding:8px 10px;border-bottom:1px solid #e6ebf3;background:#fbfcfe;}',
		'.eai-actions a.eai-btn{display:inline-block;padding:4px 10px;border:1px solid #c6d3e6;border-radius:3px;',
		'	background:#fff;color:#1e3a68;text-decoration:none;cursor:pointer;font-size:12px;}',
		'.eai-actions a.eai-btn:hover{background:#e8f0fb;border-color:#8fb0dd;}',
		'.eai-tabs{display:flex;gap:2px;padding:6px 10px 0;background:#f3f6fb;border-bottom:1px solid #dfe6f0;}',
		'.eai-tabs a.eai-tab{padding:5px 14px;border:1px solid #dfe6f0;border-bottom:none;border-radius:3px 3px 0 0;',
		'	background:#e9eef6;color:#40536f;text-decoration:none;cursor:pointer;font-size:12px;}',
		'.eai-tabs a.eai-tab.eai-active{background:#fff;color:#1e3a68;font-weight:bold;}',
		'.eai-pane{display:none;padding:10px;}',
		'.eai-pane.eai-active{display:block;}',
		'.eai-chat{height:250px;overflow:auto;border:1px solid #dfe6f0;border-radius:3px;background:#fff;padding:8px;}',
		'.eai-msg{margin:0 0 8px;padding:6px 8px;border-radius:4px;white-space:pre-wrap;word-break:break-word;}',
		'.eai-msg.eai-user{background:#eaf2ff;border:1px solid #cfe0fb;}',
		'.eai-msg.eai-ai{background:#f6f8fb;border:1px solid #e4e9f1;}',
		'.eai-msg.eai-sys{background:#fff6e5;border:1px solid #f0dcb0;color:#7a5b16;}',
		'.eai-msg.eai-err{background:#fdecec;border:1px solid #f2c2c2;color:#932626;}',
		'.eai-msg .eai-role{display:block;font-size:11px;color:#7b8aa3;margin-bottom:3px;}',
		'.eai-input{display:flex;gap:6px;margin-top:8px;}',
		'.eai-input textarea{flex:1;height:56px;resize:vertical;border:1px solid #cfd9e8;border-radius:3px;padding:6px;',
		'	font-family:Consolas,Monaco,monospace;font-size:12px;}',
		'.eai-input button{padding:0 16px;border:1px solid #2f6fbf;background:#2f6fbf;color:#fff;border-radius:3px;cursor:pointer;}',
		'.eai-input button:hover{background:#255a9e;}',
		'.eai-input button:disabled{background:#a9bfdc;border-color:#a9bfdc;cursor:default;}',
		'.eai-report{height:330px;overflow:auto;border:1px solid #dfe6f0;border-radius:3px;background:#fff;padding:10px;}',
		'.eai-report h1{font-size:17px;border-bottom:1px solid #e6ebf3;padding-bottom:5px;margin-top:4px;}',
		'.eai-report h2{font-size:15px;margin-top:16px;color:#1e3a68;}',
		'.eai-report h3{font-size:13px;margin-top:12px;color:#33517f;}',
		'.eai-report table{border-collapse:collapse;margin:8px 0;font-size:12px;width:100%;}',
		'.eai-report th,.eai-report td{border:1px solid #dde4ee;padding:4px 7px;text-align:left;vertical-align:top;}',
		'.eai-report th{background:#f2f6fb;}',
		'.eai-report code{background:#f2f4f8;padding:1px 4px;border-radius:2px;font-family:Consolas,monospace;}',
		'.eai-report pre{background:#f6f8fb;border:1px solid #e4e9f1;padding:8px;border-radius:3px;overflow:auto;}',
		'.eai-report blockquote{border-left:3px solid #cfd9e8;margin:6px 0;padding:2px 10px;color:#5a6b85;}',
		'.eai-report a.eai-locate{color:#2f6fbf;text-decoration:underline;cursor:pointer;}',
		'.eai-log{height:330px;overflow:auto;border:1px solid #dfe6f0;border-radius:3px;background:#1f2733;color:#c8d4e4;',
		'	padding:8px;font-family:Consolas,Monaco,monospace;font-size:11px;white-space:pre-wrap;}',
		'.eai-settings label{display:block;margin:8px 0 3px;font-weight:bold;color:#33405a;}',
		'.eai-settings input[type=text],.eai-settings input[type=password],.eai-settings select,',
		'.eai-settings input[type=number]{width:420px;padding:5px;border:1px solid #cfd9e8;border-radius:3px;}',
		'.eai-settings .eai-row{display:flex;gap:12px;align-items:center;}',
		'.eai-settings .eai-row>*{width:auto!important;}',
		'.eai-settings .eai-hint{color:#7b8aa3;font-size:11px;margin-top:2px;}',
		'.eai-settings .eai-btns{margin-top:14px;}',
		'.eai-settings .eai-btns button{padding:6px 16px;margin-right:8px;border:1px solid #2f6fbf;background:#2f6fbf;',
		'	color:#fff;border-radius:3px;cursor:pointer;}',
		'.eai-settings .eai-btns button.eai-secondary{background:#fff;color:#2f6fbf;}',
		'.eai-footer{padding:6px 10px;border-top:1px solid #dfe6f0;background:#f9fbfe;color:#7b8aa3;font-size:11px;}'
	].join('');

	function injectStyle() {
		if (document.getElementById('eai-style')) return;
		var s = document.createElement('style');
		s.id = 'eai-style';
		s.type = 'text/css';
		s.appendChild(document.createTextNode(CSS));
		document.head.appendChild(s);
	}

	/* ------------------------------------------------------ markdown ----- */

	function mdToHtml(md) {
		md = String(md || '').replace(/\r\n/g, '\n');
		var lines = md.split('\n');
		var out = [], i;
		var inCode = false, codeBuf = [];
		var listStack = [];

		function closeLists(toDepth) {
			while (listStack.length > (toDepth || 0)) {
				out.push(listStack.pop() === 'ul' ? '</ul>' : '</ol>');
			}
		}

		function inline(t) {
			return U.esc(t)
				.replace(/`([^`]+)`/g, '<code>$1</code>')
				.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
				.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
				.replace(/~~([^~]+)~~/g, '<del>$1</del>');
		}

		for (i = 0; i < lines.length; i++) {
			var line = lines[i];

			if (/^\s*```/.test(line)) {
				if (inCode) {
					out.push('<pre><code>' + U.esc(codeBuf.join('\n')) + '</code></pre>');
					codeBuf = []; inCode = false;
				} else { closeLists(0); inCode = true; }
				continue;
			}
			if (inCode) { codeBuf.push(line); continue; }

			if (!line.trim()) { closeLists(0); continue; }

			var h = /^(#{1,6})\s+(.*)$/.exec(line);
			if (h) {
				closeLists(0);
				var lvl = h[1].length;
				out.push('<h' + lvl + '>' + inline(h[2]) + '</h' + lvl + '>');
				continue;
			}

			/* horizontal rule */
			if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
				closeLists(0); out.push('<hr/>'); continue;
			}

			/* table */
			if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
				closeLists(0);
				var head = splitRow(line);
				var rows = [];
				i += 2;
				while (i < lines.length && /^\s*\|/.test(lines[i])) {
					rows.push(splitRow(lines[i])); i++;
				}
				i--;
				var html = '<table><thead><tr>';
				head.forEach(function (c) { html += '<th>' + inline(c) + '</th>'; });
				html += '</tr></thead><tbody>';
				rows.forEach(function (r) {
					html += '<tr>';
					r.forEach(function (c) { html += '<td>' + inline(c) + '</td>'; });
					html += '</tr>';
				});
				html += '</tbody></table>';
				out.push(html);
				continue;
			}

			/* block quote */
			if (/^\s*>\s?/.test(line)) {
				closeLists(0);
				out.push('<blockquote>' + inline(line.replace(/^\s*>\s?/, '')) + '</blockquote>');
				continue;
			}

			/* lists */
			var ul = /^(\s*)[-*+]\s+(.*)$/.exec(line);
			var ol = /^(\s*)\d+[.)]\s+(.*)$/.exec(line);
			if (ul || ol) {
				var depth = ul ? (ul[1].length / 2 + 1) : (ol[1].length / 2 + 1);
				var kind = ul ? 'ul' : 'ol';
				depth = Math.floor(depth);
				while (listStack.length > depth) { out.push(listStack.pop() === 'ul' ? '</ul>' : '</ol>'); }
				if (listStack.length < depth) {
					while (listStack.length < depth) { out.push('<' + kind + '>'); listStack.push(kind); }
				} else if (listStack[listStack.length - 1] !== kind) {
					out.push(listStack.pop() === 'ul' ? '</ul>' : '</ol>');
					out.push('<' + kind + '>'); listStack.push(kind);
				}
				out.push('<li>' + inline((ul ? ul[2] : ol[2])) + '</li>');
				continue;
			}
			closeLists(0);
			out.push('<p>' + inline(line) + '</p>');
		}
		if (inCode && codeBuf.length) {
			out.push('<pre><code>' + U.esc(codeBuf.join('\n')) + '</code></pre>');
		}
		closeLists(0);
		return out.join('\n');

		function splitRow(l) {
			return l.trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); });
		}
	}

	UI.mdToHtml = mdToHtml;

	/* Makes every designator of the current design clickable. */
	function linkifyDesignators(html) {
		var json = EAI.eda.activeJson();
		var pres = [];
		if (json && json.schlib) {
			for (var gid in json.schlib) {
				if (!Object.prototype.hasOwnProperty.call(json.schlib, gid)) continue;
				var ann = json.schlib[gid].annotation;
				if (!ann) continue;
				for (var aid in ann) {
					if (!Object.prototype.hasOwnProperty.call(ann, aid)) continue;
					if (ann[aid].mark === 'P' && ann[aid].string) pres.push(ann[aid].string);
				}
			}
		}
		if (!pres.length) return html;
		pres.sort(function (a, b) { return b.length - a.length; });
		var re = new RegExp('(?<![\\w>])(' + pres.map(escapeRe).join('|') + ')(?![\\w<])', 'g');
		return html.replace(re, function (m, p1) {
			return '<a class="eai-locate" data-pre="' + U.esc(p1) + '">' + p1 + '</a>';
		});
	}

	function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

	/* --------------------------------------------------------- settings -- */

	/* ------------------------------------------------------ provider presets -- */

	/*
	 * Every address below is only a convenience: the Base URL field stays
	 * completely free, so any third party gateway / self hosted model can be
	 * used.  Selecting a preset only fills the fields in.
	 */
	var PROVIDERS = [
		{ id: 'openai', label: 'OpenAI', protocol: 'openai',
		  base: 'https://api.openai.com/v1', model: 'gpt-4o' },
		{ id: 'anthropic', label: 'Anthropic Claude', protocol: 'anthropic',
		  base: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-5' },
		{ id: 'deepseek', label: 'DeepSeek', protocol: 'openai',
		  base: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
		{ id: 'moonshot', label: 'Moonshot / Kimi', protocol: 'openai',
		  base: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
		{ id: 'qwen', label: 'DashScope Qwen', protocol: 'openai',
		  base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
		{ id: 'zhipu', label: 'BigModel GLM', protocol: 'openai',
		  base: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-plus' },
		{ id: 'siliconflow', label: 'SiliconFlow', protocol: 'openai',
		  base: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-7B-Instruct' },
		{ id: 'openrouter', label: 'OpenRouter', protocol: 'openai',
		  base: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-sonnet-4.5' },
		{ id: 'ollama', label: 'Local Ollama', protocol: 'openai',
		  base: 'http://127.0.0.1:11434/v1', model: 'qwen2.5:7b' },
		{ id: 'azure', label: 'Azure OpenAI', protocol: 'openai',
		  base: 'https://<resource>.openai.azure.com/openai/deployments/<deployment>',
		  model: 'gpt-4o' },
		{ id: 'custom-anthropic', label: 'Custom Claude compatible API', protocol: 'anthropic',
		  base: 'https://<your-gateway>/v1', model: 'claude-sonnet-4-5' },
		{ id: 'custom-openai', label: 'Custom OpenAI compatible API', protocol: 'openai',
		  base: 'https://<your-gateway>/v1', model: '' }
	];

	/* --------------------------------------------------------- settings -- */

	UI.openSettings = function () {
		injectStyle();
		var cfg = EAI.cfg.current();

		var providerOptions = '<option value="">-- custom / custom --</option>';
		PROVIDERS.forEach(function (p) {
			providerOptions += '<option value="' + p.id + '">' + U.esc(p.label) + '</option>';
		});

		var html =
			'<div class="eai-root eai-settings">' +
			'  <label>1. API protocol / API \u534f\u8bae</label>' +
			'  <select id="eai-provider">' +
			'    <option value="openai">OpenAI (compatible)</option>' +
			'    <option value="anthropic">Anthropic (Claude)</option>' +
			'  </select>' +
			'  <div class="eai-hint" id="eai-provider-hint"></div>' +
			'  <label>2. Provider preset / \u4f9b\u5e94\u5546\u5feb\u6377\u586b\u5165\uff08\u53ef\u9009\uff09</label>' +
			'  <select id="eai-preset">' + providerOptions + '</select>' +
			'  <div class="eai-hint">\u9009\u4e00\u4e2a\u4f9b\u5e94\u5546\u53ea\u662f\u5e2e\u4f60\u586b\u4e0a\u5730\u5740\u548c\u6a21\u578b\uff0c' +
			'\u4e0b\u9762\u7684\u5730\u5740\u3001\u6a21\u578b\u3001Key \u90fd\u53ef\u4ee5\u968f\u4fbf\u6539\u6210\u4efb\u4f55\u7b2c\u4e09\u65b9\u7f51\u5173\u6216\u81ea\u5efa\u670d\u52a1\u3002</div>' +
			'  <label>3. Base URL / \u63a5\u53e3\u5730\u5740\uff08\u53ef\u5b8c\u5168\u81ea\u5b9a\u4e49\uff09</label>' +
			'  <input type="text" id="eai-baseurl" placeholder="https://api.openai.com/v1">' +
			'  <div class="eai-hint">\u6700\u7ec8\u8bf7\u6c42\u5730\u5740\uff1a<code id="eai-endpoint">-</code></div>' +
			'  <label>4. API Key</label>' +
			'  <input type="password" id="eai-apikey" placeholder="sk-...">' +
			'  <label>5. Model / \u6a21\u578b</label>' +
			'  <input type="text" id="eai-model" placeholder="gpt-4o / claude-sonnet-4-5">' +
			'  <div class="eai-row">' +
			'    <label style="margin:0">Temperature</label>' +
			'    <input type="number" id="eai-temp" step="0.1" min="0" max="2">' +
			'    <label style="margin:0">Max tokens</label>' +
			'    <input type="number" id="eai-maxtok" step="256" min="256">' +
			'    <label style="margin:0">Timeout (s)</label>' +
			'    <input type="number" id="eai-timeout" step="10" min="10">' +
			'  </div>' +
			'  <label>Answer language / \u56de\u7b54\u8bed\u8a00</label>' +
			'  <select id="eai-lang">' +
			'    <option value="zh">\u4e2d\u6587</option>' +
			'    <option value="en">English</option>' +
			'  </select>' +
			'  <label>Extra headers (optional, one per line, "Key: Value")</label>' +
			'  <input type="text" id="eai-headers" placeholder="X-Example: 1">' +
			'  <div class="eai-btns">' +
			'    <button id="eai-save">Save / \u4fdd\u5b58</button>' +
			'    <button id="eai-test" class="eai-secondary">Test connection / \u6d4b\u8bd5\u8fde\u63a5</button>' +
			'  </div>' +
			'  <div class="eai-hint" id="eai-msg"></div>' +
			'</div>';

		dlgSettings = EAI.api('createDialog', {
			title: 'AI Assistant — ' + U.t('eai.menu.settings', 'Settings'),
			width: 560,
			height: 660,
			modal: true,
			resizable: true,
			content: html
		});

		var $ = EAI.jq;
		var $d = $(dlgSettings);

		$('#eai-provider', $d).val(cfg.provider);
		$('#eai-baseurl', $d).val(cfg.baseUrl);
		$('#eai-apikey', $d).val(cfg.apiKey);
		$('#eai-model', $d).val(cfg.model);
		$('#eai-temp', $d).val(cfg.temperature);
		$('#eai-maxtok', $d).val(cfg.maxTokens);
		$('#eai-timeout', $d).val(cfg.timeout);
		$('#eai-lang', $d).val(cfg.language);
		$('#eai-headers', $d).val(cfg.extraHeaders);

		function hintFor(p) {
			return p === 'anthropic'
				? 'Claude messages API — header x-api-key + anthropic-version, endpoint = <base>/messages.'
				: 'OpenAI chat completions API — header Authorization: Bearer, endpoint = <base>/chat/completions.';
		}

		function collect() {
			return {
				provider: $('#eai-provider', $d).val(),
				baseUrl: ($('#eai-baseurl', $d).val() || '').trim(),
				apiKey: ($('#eai-apikey', $d).val() || '').trim(),
				model: ($('#eai-model', $d).val() || '').trim(),
				temperature: Number($('#eai-temp', $d).val() || 0),
				maxTokens: Number($('#eai-maxtok', $d).val() || 4096),
				timeout: Number($('#eai-timeout', $d).val() || 180),
				language: $('#eai-lang', $d).val(),
				extraHeaders: ($('#eai-headers', $d).val() || '').trim()
			};
		}

		function refreshEndpoint() {
			try {
				$('#eai-endpoint', $d).text(EAI.llm.endpoint(collect()));
			} catch (e) {
				$('#eai-endpoint', $d).text('-');
			}
		}

		$('#eai-provider-hint', $d).text(hintFor(cfg.provider));
		$('#eai-provider', $d).on('change', function () {
			$('#eai-provider-hint', $d).text(hintFor(this.value));
			refreshEndpoint();
		});
		$('#eai-baseurl', $d).on('input', refreshEndpoint);
		$('#eai-model', $d).on('input', refreshEndpoint);

		$('#eai-preset', $d).on('change', function () {
			var id = this.value;
			if (!id) return;
			var p = null, i;
			for (i = 0; i < PROVIDERS.length; i++) {
				if (PROVIDERS[i].id === id) { p = PROVIDERS[i]; break; }
			}
			if (!p) return;
			$('#eai-provider', $d).val(p.protocol);
			$('#eai-provider-hint', $d).text(hintFor(p.protocol));
			$('#eai-baseurl', $d).val(p.base);
			if (p.model) $('#eai-model', $d).val(p.model);
			refreshEndpoint();
			$('#eai-msg', $d).css('color', '#5a6b85')
				.text('Provider preset filled in — address, model and key stay editable.');
		});

		$('#eai-save', $d).on('click', function () {
			var c = collect();
			EAI.cfg.save(c);
			EAI._cfg = c;
			$('#eai-msg', $d).css('color', '#1d7a3e')
				.text('Saved: ' + c.provider + ' · ' + (c.model || '-') + ' · ' + EAI.llm.endpoint(c));
			EAI.log('configuration saved (' + c.provider + ' / ' + c.model + ')');
			UI.refreshStatus();
		});

		$('#eai-test', $d).on('click', function () {
			var c = collect();
			if (!c.apiKey || !c.baseUrl || !c.model) {
				$('#eai-msg', $d).css('color', '#932626')
					.text('Please fill in the base URL, the API key and the model.');
				return;
			}
			$('#eai-msg', $d).css('color', '#5a6b85')
				.text('Testing ' + EAI.llm.endpoint(c) + ' …');
			$('#eai-test', $d).prop('disabled', true);
			EAI.llm.test(c).then(function (r) {
				$('#eai-msg', $d).css('color', '#1d7a3e').text('Connection OK — ' + r);
			}).catch(function (e) {
				$('#eai-msg', $d).css('color', '#932626').text('Failed: ' + e.message);
			}).then(function () {
				$('#eai-test', $d).prop('disabled', false);
			});
		});

		refreshEndpoint();
		$('.dialog', $d).dialog('open');
		return dlgSettings;
	};

	/* ------------------------------------------------------------ panel -- */

	function panelHtml() {
		return '<div class="eai-root">' +
			'  <div class="eai-bar">' +
			'    <strong>AI Assistant</strong>' +
			'    <span class="eai-status" id="eai-status"></span>' +
			'    <span style="flex:1"></span>' +
			'    <a href="#" class="eai-btn" id="eai-open-settings">Settings</a>' +
			'    <a href="#" class="eai-btn" id="eai-pick-image">Attach image</a>' +
			'    <input type="file" id="eai-file" accept="image/*" style="display:none">' +
			'  </div>' +
			'  <div class="eai-actions" id="eai-actions">' +
			'    <a href="#" class="eai-btn" data-act="review">Schematic review (netlist)</a>' +
			'    <a href="#" class="eai-btn" data-act="bom">BOM analysis</a>' +
			'    <a href="#" class="eai-btn" data-act="snapshot">Snapshot review</a>' +
			'    <a href="#" class="eai-btn" data-act="edit">Batch edit values</a>' +
			'    <a href="#" class="eai-btn" data-act="generate">Generate schematic</a>' +
			'    <a href="#" class="eai-btn" data-act="symbol">Symbol from image</a>' +
			'    <a href="#" class="eai-btn" data-act="clear">Clear</a>' +
			'  </div>' +
			'  <div class="eai-tabs">' +
			'    <a href="#" class="eai-tab eai-active" data-tab="chat">Chat</a>' +
			'    <a href="#" class="eai-tab" data-tab="report">Report</a>' +
			'    <a href="#" class="eai-tab" data-tab="log">Log</a>' +
			'  </div>' +
			'  <div class="eai-pane eai-active" data-pane="chat">' +
			'    <div class="eai-chat" id="eai-chat"></div>' +
			'    <div class="eai-input">' +
			'      <textarea id="eai-input" placeholder="Ask the AI about the current schematic / PCB …"></textarea>' +
			'      <button id="eai-send">Send</button>' +
			'    </div>' +
			'  </div>' +
			'  <div class="eai-pane" data-pane="report">' +
			'    <div class="eai-report" id="eai-report"></div>' +
			'    <div style="margin-top:8px">' +
			'      <a href="#" class="eai-btn" id="eai-export-md">Export .md</a>' +
			'      <a href="#" class="eai-btn" id="eai-export-html">Export .html</a>' +
			'      <a href="#" class="eai-btn" id="eai-apply">Apply suggested changes</a>' +
			'    </div>' +
			'  </div>' +
			'  <div class="eai-pane" data-pane="log">' +
			'    <div class="eai-log" id="eai-log"></div>' +
			'  </div>' +
			'  <div class="eai-footer">EasyEDA Std extension · AI Assistant v' + EAI.ver + '</div>' +
			'</div>';
	}

	UI.openPanel = function () {
		injectStyle();
		if (dlgPanel) {
			try { $('.dialog', EAI.jq(dlgPanel)).dialog('open'); } catch (e) { /* ignore */ }
			UI.refreshStatus();
			return dlgPanel;
		}

		dlgPanel = EAI.api('createDialog', {
			title: 'AI Assistant',
			width: 900,
			height: 660,
			modal: false,
			resizable: true,
			content: panelHtml()
		});

		var $ = EAI.jq;
		var $d = $(dlgPanel);

		$('.dialog', $d).dialog('open');

		$('#eai-open-settings', $d).on('click', function (e) {
			e.preventDefault(); UI.openSettings();
		});

		$('.eai-tab', $d).on('click', function (e) {
			e.preventDefault();
			var name = $(this).data('tab');
			$('.eai-tab', $d).removeClass('eai-active');
			$(this).addClass('eai-active');
			$('.eai-pane', $d).removeClass('eai-active');
			$('.eai-pane[data-pane="' + name + '"]', $d).addClass('eai-active');
		});

		$('#eai-send', $d).on('click', function () { UI.sendInput(); });
		$('#eai-input', $d).on('keydown', function (e) {
			if (e.keyCode === 13 && (e.ctrlKey || e.metaKey)) { e.preventDefault(); UI.sendInput(); }
		});

		$('#eai-actions a.eai-btn', $d).on('click', function (e) {
			e.preventDefault();
			UI.runAction($(this).data('act'));
		});

		$('#eai-pick-image', $d).on('click', function (e) {
			e.preventDefault();
			$('#eai-file', $d).trigger('click');
		});
		$('#eai-file', $d).on('change', function () {
			var f = this.files && this.files[0];
			if (!f) return;
			var reader = new FileReader();
			reader.onload = function () {
				var dataUrl = reader.result;
				pendingImage = {
					dataUrl: dataUrl,
					base64: String(dataUrl).split(',')[1] || '',
					mediaType: f.type || 'image/png',
					name: f.name
				};
				UI.appendMsg('user', 'Attached image: ' + f.name + ' (' +
					Math.round(pendingImage.base64.length * 0.75 / 1024) + ' kB)');
			};
			reader.readAsDataURL(f);
			this.value = '';
		});

		$('#eai-export-md', $d).on('click', function (e) {
			e.preventDefault();
			U.download('ai-review-' + Date.now() + '.md', lastReport || '');
		});
		$('#eai-export-html', $d).on('click', function (e) {
			e.preventDefault();
			var html = '<!doctype html><meta charset="utf-8"><title>AI review</title>' +
				'<style>body{font-family:sans-serif;padding:24px;max-width:1000px;margin:auto}' +
				'table{border-collapse:collapse}th,td{border:1px solid #ccc;padding:4px 8px}' +
				'code{background:#f2f4f8;padding:1px 4px}</style>' + mdToHtml(lastReport || '');
			U.download('ai-review-' + Date.now() + '.html', html, 'text/html;charset=utf-8');
		});
		$('#eai-apply', $d).on('click', function (e) {
			e.preventDefault();
			UI.applyPendingEdits();
		});

		UI.refreshStatus();
		UI.appendMsg('sys', 'Ready. Open a schematic or a PCB and pick an action above.');
		return dlgPanel;
	};

	UI.refreshStatus = function () {
		if (!dlgPanel) return;
		var cfg = EAI.cfg.current();
		var $ = EAI.jq;
		$('#eai-status', $(dlgPanel)).text(
			cfg.provider + ' · ' + (cfg.model || 'no model') +
			(cfg.apiKey ? '' : ' · not configured'));
	};

	/* ----------------------------------------------------------- output -- */

	UI.appendMsg = function (role, text, html) {
		if (!dlgPanel) return;
		var $ = EAI.jq;
		var box = $('#eai-chat', $(dlgPanel));
		if (!box.length) return;
		var div = $('<div class="eai-msg eai-' + role + '"></div>');
		$('<span class="eai-role"></span>').text(role === 'user' ? 'You' :
			(role === 'ai' ? 'AI' : 'System')).appendTo(div);
		if (html) div.append(html); else div.append(document.createTextNode(text || ''));
		box.append(div);
		box.scrollTop(box[0].scrollHeight);
		return div;
	};

	UI.appendLog = function (line, level) {
		if (!dlgPanel) return;
		var $ = EAI.jq;
		var box = $('#eai-log', $(dlgPanel));
		if (!box.length) return;
		box.append(document.createTextNode(line + '\n'));
		box.scrollTop(box[0].scrollHeight);
	};

	UI.showReport = function (markdown) {
		lastReport = markdown || '';
		if (!dlgPanel) return;
		var $ = EAI.jq;
		var box = $('#eai-report', $(dlgPanel));
		var html = linkifyDesignators(mdToHtml(lastReport));
		box.html(html);
		box.off('click.eai').on('click.eai', '.eai-locate', function (e) {
			e.preventDefault();
			var pre = $(this).data('pre');
			var ok = EAI.eda.locateComponent(pre) || EAI.eda.locateFootprint(pre);
			UI.appendMsg('sys', ok ? ('Located ' + pre) : ('Could not locate ' + pre));
		});
	};

	/* ------------------------------------------------------------ chat --- */

	UI.sendInput = function () {
		var $ = EAI.jq;
		if (!dlgPanel) return;
		var ta = $('#eai-input', $(dlgPanel));
		var text = (ta.val() || '').trim();
		if (!text) return;

		if (!EAI.cfg.ready()) {
			UI.appendMsg('err', U.t('eai.hint.noKey', 'Please configure the API first.'));
			UI.openSettings();
			return;
		}
		ta.val('');
		UI.appendMsg('user', text);
		var msgs = history.concat([{ role: 'user', content: [{ type: 'text', text: text }] }]);
		UI.ask(msgs);
	};

	/** Sends a message list to the model and streams the answer into the chat. */
	UI.ask = function (messages) {
		var cfg = EAI.cfg.current();
		var $ = EAI.jq;
		var btn = dlgPanel ? $('#eai-send', $(dlgPanel)) : null;
		if (btn) btn.prop('disabled', true);

		var node = UI.appendMsg('ai', '');
		var buf = '';
		var acc = '';
		if (node) {
			var span = $('<span></span>').appendTo(node);
			node.find('.eai-role').after('');
			acc = span;
		}

		function onDelta(delta) {
			buf += delta;
			if (acc) acc.text(buf);
			if (dlgPanel) {
				var box = $('#eai-chat', $(dlgPanel));
				box.scrollTop(box[0].scrollHeight);
			}
		}

		/* remember the last user turn so the chat stays coherent */
		var lastUser = null;
		for (var mi = messages.length - 1; mi >= 0; mi--) {
			if (messages[mi].role === 'user') { lastUser = messages[mi]; break; }
		}
		if (lastUser && history.indexOf(lastUser) < 0) history.push(lastUser);

		return EAI.llm.chat(cfg, messages, { onDelta: onDelta })
			.then(function (answer) {
				var text = answer || buf;
				if (acc) acc.text(text);
				history.push({ role: 'assistant', content: [{ type: 'text', text: text }] });
				lastReport = text;
				return text;
			})
			.catch(function (err) {
				var msg = err && err.message ? err.message : String(err);
				if (err && err.isCors) {
					msg += '\n' + U.t('eai.hint.cors', 'Please check the endpoint / CORS settings.');
				}
				if (acc) acc.text('');
				UI.appendMsg('err', msg);
				EAI.log('request failed: ' + msg, 'error');
			})
			.then(function () {
				if (btn) btn.prop('disabled', false);
			});
	};

	UI.history = history;

	/* --------------------------------------------------------- features -- */

	function systemPrompt(role) {
		var lang = (EAI.cfg.current().language === 'en')
			? 'Answer in English.' : '请用中文回答。';
		return [
			'You are an experienced electronic hardware engineer and PCB reviewer ' +
			'assisting inside EasyEDA (嘉立创EDA 标准版).',
			lang,
			'Be concrete and technical. Point out real risks (power, decoupling, ' +
			'signal integrity, ERC/DRC issues, missing ratings, wrong footprints, ' +
			'dangling nets, floating pins, missing pull-ups …).',
			'When you mention a component always use its exact designator ' +
			'(for example R12, C3, U1) so the user can locate it.',
			'Use Markdown. Prefer tables for net lists and BOM summaries.',
			role ? ('Current task: ' + role) : ''
		].filter(Boolean).join('\n');
	}

	function userText(text) {
		return [{ role: 'user', content: [{ type: 'text', text: text }] }];
	}

	/** Renders the net list as a compact, model friendly text. */
	function netlistText(nl, components) {
		var lines = [];
		lines.push('## Net list');
		lines.push('nets: ' + nl.stats.nets + ', named: ' + nl.stats.namedNets +
			', pins: ' + nl.stats.pins + ', sheets: ' + nl.stats.sheets);
		lines.push('');
		nl.nets.forEach(function (n) {
			var pins = n.pins.map(function (p) {
				return p.designator + '.' + p.number +
					(p.name ? '(' + p.name + ')' : '');
			});
			lines.push('- **' + n.name + '** [' + n.pins.length + ' pins]' +
				(n.conflict ? ' (NAME CONFLICT: ' + n.labels.map(function (l) { return l.name; }).join(', ') + ')' : '') +
				': ' + (pins.join(', ') || '(no pins)'));
		});

		lines.push('');
		lines.push('## Components');
		components.forEach(function (c) {
			lines.push('- ' + c.designator + ' | ' + (c.name || '') + ' | ' +
				(c.package || '') + ' | ' + (c.value || '') + ' | pins=' + c.pins.length);
		});
		return lines.join('\n');
	}

	function bomText(bom, components) {
		var lines = [];
		lines.push('## BOM');
		lines.push('| Designators | Qty | Package | Value | Name |');
		lines.push('|---|---|---|---|---|');
		bom.forEach(function (b) {
			lines.push('| ' + b.designators.join(', ') + ' | ' + b.qty + ' | ' +
				(b.package || '') + ' | ' + (b.value || '') + ' | ' + (b.name || '') + ' |');
		});
		lines.push('');
		lines.push('total lines: ' + bom.length + ', total components: ' + components.length);
		return lines.join('\n');
	}

	function requireDoc() {
		var dt = EAI.eda.docType();
		if (!dt) {
			UI.appendMsg('err', U.t('eai.hint.noDoc', 'No document is open.'));
			return null;
		}
		return dt;
	}

	UI.runAction = function (act) {
		switch (act) {
			case 'review': return UI.reviewNetlist();
			case 'bom': return UI.reviewBom();
			case 'snapshot': return UI.reviewSnapshot();
			case 'edit': return UI.editValues();
			case 'generate': return UI.generateSchematic();
			case 'symbol': return UI.symbolFromImage();
			case 'clear':
				if (dlgPanel) EAI.jq('#eai-chat', EAI.jq(dlgPanel)).empty();
				lastReport = '';
				return null;
		}
		return null;
	};

	/* --- 1. netlist review ------------------------------------------------ */

	UI.reviewNetlist = function () {
		var dt = requireDoc();
		if (!dt) return null;

		var sheets = EAI.eda.projectSchematics();
		if (!sheets.length) {
			UI.appendMsg('err', 'No schematic found in the current project.');
			return null;
		}
		UI.appendMsg('sys', 'Analysing ' + sheets.length + ' sheet(s)…');

		var nl = EAI.eda.netlist(sheets);
		var comps = [];
		sheets.forEach(function (s) {
			comps = comps.concat(EAI.eda.components(s.json));
		});

		var text = netlistText(nl, comps);
		UI.appendMsg('user', 'Please review the net list of this project and report ' +
			'ERC problems, design risks and suggestions.');

		return UI.ask([
			{ role: 'system', content: [{ type: 'text', text: systemPrompt('schematic / net list review') }] },
			{ role: 'user', content: [{ type: 'text', text: text }] }
		]).then(function (answer) {
			UI.showReport(answer);
			UI.lastNetlist = nl;
			return answer;
		});
	};

	/* --- 2. BOM analysis -------------------------------------------------- */

	UI.reviewBom = function () {
		var dt = requireDoc();
		if (!dt) return null;
		var json = EAI.eda.activeJson();
		var comps = EAI.eda.components(json);
		if (!comps.length) {
			UI.appendMsg('err', 'No component found in the current document.');
			return null;
		}
		var bom = EAI.eda.bom(comps);
		UI.appendMsg('user', 'Please analyse this BOM and report: missing values, ' +
			'wrong or missing footprints, unpriced / unavailable parts, ' +
			'duplicates that could be merged, and assembly or sourcing advice.');

		return UI.ask([
			{ role: 'system', content: [{ type: 'text', text: systemPrompt('BOM analysis') }] },
			{ role: 'user', content: [{ type: 'text', text: bomText(bom, comps) }] }
		]).then(function (answer) {
			UI.showReport(answer);
			UI.lastBom = bom;
			return answer;
		});
	};

	/* --- 3. snapshot review ----------------------------------------------- */

	UI.reviewSnapshot = function () {
		var dt = requireDoc();
		if (!dt) return null;
		var svg = EAI.eda.svg(50);
		if (!svg) {
			UI.appendMsg('err', 'Could not export the canvas.');
			return null;
		}
		UI.appendMsg('sys', 'Rendering the canvas…');
		return EAI.eda.svgToPng(svg, 1800).then(function (img) {
			UI.appendMsg('user', 'Please review this drawing of the ' +
				(dt === 'pcb' ? 'PCB' : 'schematic') + ' and report layout, ' +
				'readability and wiring problems.');
			return UI.ask([
				{ role: 'system', content: [{ type: 'text', text: systemPrompt('drawing / layout review') }] },
				{
					role: 'user', content: [
						{ type: 'text', text: 'Here is the current ' + (dt === 'pcb' ? 'PCB' : 'schematic') + ' drawing:' },
						{ type: 'image', mediaType: 'image/png', data: img.base64 }
					]
				}
			]).then(function (answer) {
				UI.showReport(answer);
				return answer;
			});
		}).catch(function (e) {
			UI.appendMsg('err', 'Rendering failed: ' + e.message);
		});
	};

	/* --- 4. batch edit ---------------------------------------------------- */

	UI.editValues = function () {
		var dt = requireDoc();
		if (!dt) return null;
		var json = EAI.eda.activeJson();
		var comps = EAI.eda.components(json);
		if (!comps.length) {
			UI.appendMsg('err', 'No component found in the current document.');
			return null;
		}
		var lines = comps.map(function (c) {
			return '- ' + c.designator + ' | name=' + (c.name || '') +
				' | package=' + (c.package || '') +
				' | value=' + (c.value || '') +
				' | params=' + U.fmt(c.params);
		});
		UI.appendMsg('user', 'Please suggest corrected values and designators for the ' +
			'components below. Answer with a JSON array of ' +
			'{"designator":"R1","value":"10k","parameter":"value"} objects ' +
			'for every component that needs a change, and nothing else.');

		return UI.ask([
			{ role: 'system', content: [{ type: 'text', text: systemPrompt('component value correction') }] },
			{ role: 'user', content: [{ type: 'text', text: '## Components\n' + lines.join('\n') }] }
		]).then(function (answer) {
			UI.showReport(answer);
			UI.pendingEdits = UI.parseEdits(answer);
			UI.appendMsg('sys', UI.pendingEdits.length
				? ('Found ' + UI.pendingEdits.length + ' suggested change(s) — ' +
					'open the Report tab and press "Apply suggested changes".')
				: 'No change could be parsed from the answer.');
			return answer;
		});
	};

	/** Extracts the JSON array of edits out of a model answer. */
	UI.parseEdits = function (answer) {
		var text = String(answer || '');
		var m = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
		var body = m ? m[1] : text;
		var start = body.indexOf('[');
		var end = body.lastIndexOf(']');
		if (start < 0 || end <= start) return [];
		try {
			var arr = JSON.parse(body.slice(start, end + 1));
			return Array.isArray(arr) ? arr.filter(function (x) { return x && x.designator; }) : [];
		} catch (e) {
			return [];
		}
	};

	UI.applyPendingEdits = function () {
		var edits = UI.pendingEdits || [];
		if (!edits.length && UI.pendingPlan) {
			var plan = EAI.actions.applyPlan(UI.pendingPlan);
			var done = plan.components.length + plan.wires.length +
				plan.netLabels.length + plan.junctions.length;
			UI.appendMsg(done ? 'sys' : 'err',
				done ? ('Placed ' + plan.components.length + ' component(s), ' +
					plan.wires.length + ' wire(s), ' + plan.netLabels.length +
					' net label(s).')
					: 'Nothing could be placed.');
			plan.errors.forEach(function (e) { UI.appendMsg('err', e); });
			return plan;
		}
		if (!edits.length) {
			UI.appendMsg('err', 'There is nothing to apply yet.');
			return null;
		}
		var res = EAI.actions.applyEdits(edits);
		res.forEach(function (r) {
			if (r.valueResult && r.valueResult.ok) {
				UI.appendMsg('sys', 'Updated ' + r.designator + ' → ' + r.valueResult.value);
			} else if (r.valueResult && r.valueResult.error) {
				UI.appendMsg('err', r.designator + ': ' + r.valueResult.error);
			}
			if (r.designatorResult && r.designatorResult.ok) {
				UI.appendMsg('sys', 'Renamed ' + r.designator + ' → ' + r.designatorResult.newDesignator);
			}
		});
		return res;
	};

	/* --- 5. generate a schematic ------------------------------------------ */

	UI.generateSchematic = function () {
		var dt = requireDoc();
		if (!dt) return null;

		var requirement = pendingImage ? '' : '';
		UI.appendMsg('user', 'Please design a schematic for the following requirement ' +
			'and answer with a JSON object:\n' +
			'{"components":[{"part":"R","x":0,"y":0,"rotation":0,"value":"10k"}],' +
			'"wires":[[{"x":0,"y":0},{"x":100,"y":0}]],' +
			'"netLabels":[{"x":100,"y":0,"name":"VCC"}],' +
			'"junctions":[{"x":50,"y":0}]}\n' +
			'Allowed parts: R, C, L, D, LED, SW, GENERIC (use "pinCount" for GENERIC). ' +
			'Coordinates are in schematic units (1 unit = 10 mil). ' +
			'Requirement: ');

		var ta = dlgPanel ? EAI.jq('#eai-input', EAI.jq(dlgPanel)) : null;
		if (ta && ta.val()) {
			requirement = ta.val();
			ta.val('');
		}

		return UI.ask([
			{ role: 'system', content: [{ type: 'text', text: systemPrompt('schematic generation') }] },
			{ role: 'user', content: [{ type: 'text', text: 'Design a schematic for: ' + requirement }] }
		]).then(function (answer) {
			UI.showReport(answer);
			UI.pendingPlan = UI.parsePlan(answer);
			UI.appendMsg('sys', UI.pendingPlan
				? 'A plan was parsed — open the Report tab and press "Apply suggested changes".'
				: 'No plan could be parsed from the answer.');
			return answer;
		});
	};

	UI.parsePlan = function (answer) {
		var text = String(answer || '');
		var m = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
		var body = m ? m[1] : text;
		var start = body.indexOf('{');
		var end = body.lastIndexOf('}');
		if (start < 0 || end <= start) return null;
		try {
			var obj = JSON.parse(body.slice(start, end + 1));
			return (obj && (obj.components || obj.wires || obj.netLabels)) ? obj : null;
		} catch (e) { return null; }
	};

	/* --- 6. symbol from an image ------------------------------------------ */

	UI.symbolFromImage = function () {
		var dt = requireDoc();
		if (!dt) return null;

		if (!pendingImage) {
			UI.appendMsg('err', 'Attach an image first (button "Attach image" in the header).');
			return null;
		}
		UI.appendMsg('user', 'Please analyse this symbol picture and answer with a JSON ' +
			'object describing the symbol:\n' +
			'{"name":"R","pre":"R","package":"0603",' +
			'"pins":[{"number":"1","name":"","x":-15,"y":0,"dotX":-25,"dotY":0,' +
			'"path":"h -10","electric":"passive"}],' +
			'"texts":[{"x":0,"y":-10,"string":"R"}]}\n' +
			'Coordinates are relative to the symbol origin in schematic units ' +
			'(1 unit = 10 mil). Pins on the left use "h -10", pins on the right "h 10".');

		return UI.ask([
			{ role: 'system', content: [{ type: 'text', text: systemPrompt('symbol recognition from an image') }] },
			{
				role: 'user', content: [
					{ type: 'text', text: 'Recognise this electronic symbol:' },
					{ type: 'image', mediaType: pendingImage.mediaType, data: pendingImage.base64 }
				]
			}
		]).then(function (answer) {
			UI.showReport(answer);
			UI.pendingSymbol = UI.parseSymbol(answer);
			if (UI.pendingSymbol) {
				var x = UI.pendingSymbol.x || 400;
				var y = UI.pendingSymbol.y || 300;
				var res = EAI.actions.createSymbol(UI.pendingSymbol);
				UI.appendMsg(res.ok ? 'sys' : 'err',
					res.ok ? ('Symbol placed at ' + res.x + ',' + res.y)
						: ('Creating the symbol failed: ' + res.error));
			} else {
				UI.appendMsg('err', 'No symbol description could be parsed from the answer.');
			}
			return answer;
		});
	};

	UI.parseSymbol = function (answer) {
		var text = String(answer || '');
		var m = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
		var body = m ? m[1] : text;
		var start = body.indexOf('{');
		var end = body.lastIndexOf('}');
		if (start < 0 || end <= start) return null;
		try {
			var obj = JSON.parse(body.slice(start, end + 1));
			if (!obj || !obj.pins || !obj.pins.length) return null;
			if (obj.x === undefined) obj.x = 400;
			if (obj.y === undefined) obj.y = 300;
			return obj;
		} catch (e) { return null; }
	};
})();
