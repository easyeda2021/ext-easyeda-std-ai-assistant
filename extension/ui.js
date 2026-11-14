/* =====================================================================
 * EasyEDA Std extension — "AI Assistant" / AI 助手
 * ui.js — AI panel, settings dialog and about dialog
 *
 * NOTE ON STYLING
 *   The dialogs are created by api('createDialog') and rendered inside the
 *   editor's own DOM.  A stylesheet injected into <head> was not reliable
 *   there, so every structural/visual rule below is written as an INLINE
 *   style (the editor itself styles its UI that way, so inline styles are
 *   guaranteed to work).  A small <style> block is still shipped for
 *   :hover / transitions / markdown fallbacks only.
 * ===================================================================== */
(function () {
	'use strict';

	var EAI = (window.EAI = window.EAI || {});
	var UI = (EAI.ui = {});
	var U = EAI.util;

	UI.dlgPanel = null;
	UI.dlgSettings = null;
	UI.dlgAbout = null;
	UI.dlgReport = null;

	var history = [];
	var lastReport = '';
	var pendingImage = null;
	var busy = false;

	/* ------------------------------------------------------------ design -- */

	var C = {
		bg: '#ffffff',
		surface: '#f7f9fc',
		surfaceAlt: '#f1f5fb',
		border: '#e3e8f0',
		borderStrong: '#d3ddec',
		text: '#1f2733',
		muted: '#8794a8',
		primary: '#2f6fbf',
		primaryDark: '#1e3a68',
		primaryDeep: '#16294a',
		green: '#0f766e',
		red: '#b03a3a',
		radius: '10px'
	};

	/** {display:'flex', gap:'8px'} -> "display:flex;gap:8px;" */
	function st(o) {
		var out = [];
		for (var k in o) {
			if (!Object.prototype.hasOwnProperty.call(o, k)) continue;
			var name = k.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); });
			out.push(name + ':' + o[k]);
		}
		return out.join(';');
	}

	var FONT = '"Microsoft YaHei","Segoe UI",Verdana,sans-serif';
	var MONO = 'Consolas,Monaco,"Courier New",monospace';

	/* hover / animation only — never layout */
	var EXTRA_CSS = [
		'.eai-pill{transition:all .15s ease;cursor:pointer;}',
		'.eai-pill:hover{border-color:#8fb2df !important;background:#eef5ff !important;transform:translateY(-1px);box-shadow:0 3px 10px rgba(47,111,191,.16);}',
		'.eai-btn{transition:all .15s ease;cursor:pointer;}',
		'.eai-btn:hover{filter:brightness(.96);}',
		'.eai-tab{transition:all .15s ease;cursor:pointer;}',
		'.eai-locate{text-decoration:underline;cursor:pointer;}',
		'.eai-chat::-webkit-scrollbar,.eai-report::-webkit-scrollbar,.eai-log::-webkit-scrollbar{width:9px;}',
		'.eai-chat::-webkit-scrollbar-thumb,.eai-report::-webkit-scrollbar-thumb,.eai-log::-webkit-scrollbar-thumb{background:#cbd6e6;border-radius:9px;}',
		'.eai-in{transition:border-color .15s,box-shadow .15s;}',
		'.eai-in:focus{border-color:#5b8fd6 !important;box-shadow:0 0 0 3px rgba(91,143,214,.15) !important;outline:none;}'
	].join('');

	function styleBlock() {
		return '<style type="text/css">' + EXTRA_CSS + '</style>';
	}

	function injectStyle() {
		if (document.getElementById('eai-style')) return;
		var s = document.createElement('style');
		s.id = 'eai-style';
		s.type = 'text/css';
		s.appendChild(document.createTextNode(EXTRA_CSS));
		try { document.head.appendChild(s); } catch (e) { /* ignore */ }
	}

	function logoSvg(size) {
		size = size || 26;
		return '<svg viewBox="0 0 32 32" width="' + size + '" height="' + size + '" style="display:block">' +
			'<defs><linearGradient id="eaiG1" x1="0" y1="0" x2="0" y2="1">' +
			'<stop offset="0" stop-color="#7df3fc"/><stop offset="1" stop-color="#16c2dd"/></linearGradient></defs>' +
			'<g stroke="#7df3fc" stroke-width="1.7" stroke-linecap="round">' +
			'<path d="M12.2 10.4 V11.8"/><path d="M16 10.4 V11.8"/><path d="M19.8 10.4 V11.8"/>' +
			'<path d="M12.2 24.2 V25.6"/><path d="M16 24.2 V25.6"/><path d="M19.8 24.2 V25.6"/>' +
			'<path d="M6.4 13.6 H7.8"/><path d="M6.4 17.2 H7.8"/><path d="M6.4 20.8 H7.8"/>' +
			'<path d="M24.2 13.6 H25.6"/><path d="M24.2 17.2 H25.6"/><path d="M24.2 20.8 H25.6"/></g>' +
			'<rect x="7.8" y="11.8" width="16.4" height="12.4" rx="2" fill="url(#eaiG1)"/>' +
			'<rect x="11.4" y="15" width="9.2" height="6" rx="1" fill="#0d2b46"/>' +
			'<path d="M23.5 2.3 L24.75 6.05 L28.5 7.3 L24.75 8.55 L23.5 12.3 L22.25 8.55 L18.5 7.3 L22.25 6.05 Z" fill="#ffc44d"/>' +
			'<path d="M7.6 4.2 L8.4 6.4 L10.6 7.2 L8.4 8 L7.6 10.2 L6.8 8 L4.6 7.2 L6.8 6.4 Z" fill="#a5f0ff"/>' +
			'</svg>';
	}
	UI.logoSvg = logoSvg;

	/* -------------------------------------------------------- markdown -- */

	function inlineCss() {
		return {
			h1: st({ fontSize: '17px', margin: '14px 0 6px', color: C.primaryDark, fontWeight: '600', lineHeight: '1.35' }),
			h2: st({ fontSize: '15px', margin: '14px 0 6px', color: C.primaryDark, fontWeight: '600', lineHeight: '1.35' }),
			h3: st({ fontSize: '13.5px', margin: '12px 0 5px', color: '#33517f', fontWeight: '600' }),
			p: st({ margin: '5px 0' }),
			ul: st({ margin: '5px 0 5px 20px', padding: '0' }),
			ol: st({ margin: '5px 0 5px 20px', padding: '0' }),
			li: st({ margin: '2px 0' }),
			table: st({ borderCollapse: 'collapse', width: '100%', margin: '8px 0', fontSize: '12.5px' }),
			th: st({ border: '1px solid ' + C.border, padding: '5px 8px', textAlign: 'left', background: C.surfaceAlt, fontWeight: '600' }),
			td: st({ border: '1px solid ' + C.border, padding: '5px 8px', textAlign: 'left', verticalAlign: 'top' }),
			code: st({ background: '#f0f3f8', padding: '1px 5px', borderRadius: '4px', fontFamily: MONO, fontSize: '12px' }),
			pre: st({ background: '#f6f8fb', border: '1px solid ' + C.border, padding: '10px', borderRadius: '8px', overflow: 'auto', margin: '8px 0' }),
			quote: st({ borderLeft: '3px solid #cfd9e8', margin: '6px 0', padding: '2px 12px', color: '#5a6b85' }),
			hr: st({ border: 'none', borderTop: '1px solid ' + C.border, margin: '12px 0' })
		};
	}

	UI.mdToHtml = function (md) {
		md = String(md || '').replace(/\r\n/g, '\n');
		var S = inlineCss();
		var lines = md.split('\n');
		var out = [], inCode = false, codeBuf = [], listStack = [];

		function closeLists(toDepth) {
			while (listStack.length > (toDepth || 0)) {
				out.push(listStack.pop() === 'ul' ? '</ul>' : '</ol>');
			}
		}

		function inline(t) {
			return U.esc(t)
				.replace(/`([^`]+)`/g, '<code style="' + S.code + '">$1</code>')
				.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
				.replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>')
				.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
					'<a href="$2" target="_blank" style="color:' + C.primary + '">$1</a>');
		}

		function splitRow(l) {
			return l.trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); });
		}

		for (var i = 0; i < lines.length; i++) {
			var line = lines[i];

			if (/^\s*```/.test(line)) {
				if (inCode) {
					out.push('<pre style="' + S.pre + '"><code style="font-family:' + MONO + ';font-size:12px">' +
						U.esc(codeBuf.join('\n')) + '</code></pre>');
					codeBuf = []; inCode = false;
				} else { closeLists(0); inCode = true; }
				continue;
			}
			if (inCode) { codeBuf.push(line); continue; }
			if (!line.trim()) { closeLists(0); continue; }

			var h = /^(#{1,6})\s+(.*)$/.exec(line);
			if (h) {
				closeLists(0);
				var lvl = Math.min(h[1].length, 3);
				var hs = lvl === 1 ? S.h1 : lvl === 2 ? S.h2 : S.h3;
				out.push('<h' + lvl + ' style="' + hs + '">' + inline(h[2]) + '</h' + lvl + '>');
				continue;
			}
			if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
				closeLists(0); out.push('<hr style="' + S.hr + '"/>'); continue;
			}

			if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
				closeLists(0);
				var head = splitRow(line), rows = [];
				i += 2;
				while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(splitRow(lines[i])); i++; }
				i--;
				var html = '<table style="' + S.table + '"><thead><tr>';
				head.forEach(function (c) { html += '<th style="' + S.th + '">' + inline(c) + '</th>'; });
				html += '</tr></thead><tbody>';
				rows.forEach(function (r) {
					html += '<tr>';
					r.forEach(function (c) { html += '<td style="' + S.td + '">' + inline(c) + '</td>'; });
					html += '</tr>';
				});
				out.push(html + '</tbody></table>');
				continue;
			}

			if (/^\s*>\s?/.test(line)) {
				closeLists(0);
				out.push('<blockquote style="' + S.quote + '">' +
					inline(line.replace(/^\s*>\s?/, '')) + '</blockquote>');
				continue;
			}

			var ul = /^(\s*)[-*+]\s+(.*)$/.exec(line);
			var ol = /^(\s*)\d+[.)]\s+(.*)$/.exec(line);
			if (ul || ol) {
				var depth = Math.max(1, Math.floor((ul ? ul[1] : ol[1]).length / 2) + 1);
				var kind = ul ? 'ul' : 'ol';
				while (listStack.length > depth) out.push(listStack.pop() === 'ul' ? '</ul>' : '</ol>');
				if (listStack.length < depth) {
					while (listStack.length < depth) {
						out.push('<' + kind + ' style="' + (kind === 'ul' ? S.ul : S.ol) + '">');
						listStack.push(kind);
					}
				} else if (listStack[listStack.length - 1] !== kind) {
					out.push(listStack.pop() === 'ul' ? '</ul>' : '</ol>');
					out.push('<' + kind + ' style="' + (kind === 'ul' ? S.ul : S.ol) + '">');
					listStack.push(kind);
				}
				out.push('<li style="' + S.li + '">' + inline(ul ? ul[2] : ol[2]) + '</li>');
				continue;
			}
			closeLists(0);
			out.push('<p style="' + S.p + '">' + inline(line) + '</p>');
		}
		if (inCode && codeBuf.length) {
			out.push('<pre style="' + S.pre + '"><code style="font-family:' + MONO + ';font-size:12px">' +
				U.esc(codeBuf.join('\n')) + '</code></pre>');
		}
		closeLists(0);
		return out.join('\n');
	};

	function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

	function linkify(html) {
		var json = EAI.eda.activeJson(), pres = [];
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
		var re;
		try {
			re = new RegExp('(?<![\\w>])(' + pres.map(escapeRe).join('|') + ')(?![\\w<])', 'g');
		} catch (e) { return html; }
		return html.replace(re, function (m, p1) {
			return '<a class="eai-locate" data-pre="' + U.esc(p1) + '" ' +
				'style="color:' + C.primary + ';text-decoration:underline;cursor:pointer">' + p1 + '</a>';
		});
	}

	/* ------------------------------------------------------------ pieces -- */

	function iconBtn(id, title, glyph) {
		return '<a href="#" id="' + id + '" title="' + title + '" style="' +
			st({
				color: '#fff', textDecoration: 'none', fontSize: '15px', lineHeight: '1',
				padding: '6px 8px', borderRadius: '8px', background: 'rgba(255,255,255,.12)',
				display: 'inline-block'
			}) + '">' + glyph + '</a>';
	}

	function headerHtml() {
		return '<div style="' + st({
			display: 'flex', alignItems: 'center', gap: '12px',
			padding: '14px 16px',
			background: 'linear-gradient(135deg,#16294a 0%,#1e3a68 55%,#2e5896 100%)',
			color: '#fff', borderTopLeftRadius: '6px', borderTopRightRadius: '6px'
		}) + '">' +
			'<div style="' + st({
				width: '38px', height: '38px', borderRadius: '11px',
				background: '#0b1a30', display: 'flex',
				alignItems: 'center', justifyContent: 'center', flex: '0 0 auto',
				boxShadow: '0 4px 14px rgba(0,0,0,.35)'
			}) + '">' + logoSvg(27) + '</div>' +
			'<div style="' + st({ flex: '1 1 auto', minWidth: '0' }) + '">' +
			'  <div style="' + st({ fontSize: '13.5px', fontWeight: '600', letterSpacing: '.3px' }) +
			'">EasyEDA 智能设计助手</div>' +
			'  <div id="eai-sub" style="' + st({ fontSize: '11.5px', opacity: '.75', marginTop: '3px' }) +
			'">正在读取文档…</div>' +
			'</div>' +
			'<span id="eai-state" style="' + st({
				fontSize: '11px', background: 'rgba(255,255,255,.16)', padding: '4px 11px',
				borderRadius: '20px', whiteSpace: 'nowrap'
			}) + '">未配置</span>' +
			iconBtn('eai-btn-clear', '清空会话', '&#128465;') +
			iconBtn('eai-btn-settings', '设置', '&#9881;') +
			iconBtn('eai-btn-image', '附加图片', '&#128247;') +
			'<input type="file" id="eai-file" accept="image/*" style="display:none">' +
			'</div>';
	}

	function panelHtml() {
		return styleBlock() + '<div class="eai-root" style="' + st({
			fontFamily: FONT, fontSize: '13px', color: C.text, lineHeight: '1.6',
			background: C.bg, margin: '0', padding: '0'
		}) + '">' +
			headerHtml() +

			'<div style="' + st({
				display: 'flex', gap: '6px', padding: '10px 16px',
				background: C.bg, borderBottom: '1px solid ' + C.border
			}) + '">' +
			'  <a href="#" class="eai-tab eai-active" data-tab="chat" style="' + segCss(true) + '">对话</a>' +
			'  <a href="#" class="eai-tab" data-tab="log" style="' + segCss(false) + '">日志</a>' +
			'</div>' +

			'<div class="eai-pane" data-pane="chat" style="display:block">' +
			'  <div id="eai-pills" style="' + st({
				display: 'flex', flexWrap: 'wrap', gap: '8px',
				padding: '11px 16px', background: C.surface,
				borderBottom: '1px solid ' + C.border
			}) + '"></div>' +
			'  <div id="eai-chat" class="eai-chat" style="' + st({
				height: '330px', overflowY: 'auto', padding: '14px 16px',
				background: '#f8fafd'
			}) + '"></div>' +
			composeHtml() +
			'</div>' +

			'<div class="eai-pane" data-pane="log" style="display:none">' +
			'  <div id="eai-log" class="eai-log" style="' + st({
				height: '418px', overflowY: 'auto', background: '#101926', color: '#c3d3e6',
				padding: '12px 14px', fontFamily: MONO, fontSize: '11.5px',
				whiteSpace: 'pre-wrap', lineHeight: '1.55'
			}) + '"></div>' +
			'</div>' +
			'</div>';
	}

	function composeHtml() {
		return '  <div style="' + st({
			padding: '12px 16px 14px', borderTop: '1px solid ' + C.border, background: C.bg
		}) + '">' +
			'    <textarea id="eai-input" class="eai-in" style="' + st({
				width: '100%', height: '76px', resize: 'vertical', boxSizing: 'border-box',
				border: '1px solid ' + C.borderStrong, borderRadius: '10px',
				padding: '10px 12px', fontSize: '13px', fontFamily: FONT,
				color: C.text, outline: 'none'
			}) + '" placeholder="描述你的需求，或点击上面的胶囊按钮填入提示词…"></textarea>' +
			'    <div style="' + st({
				display: 'flex', alignItems: 'center', gap: '8px', marginTop: '9px'
			}) + '">' +
			'      <span id="eai-imgbadge" style="' + st({
				display: 'none', fontSize: '11px', background: '#e8eefb', color: '#2f5fa8',
				borderRadius: '12px', padding: '3px 10px'
			}) + '">已附加图片</span>' +
			'      <span style="' + st({ fontSize: '11px', color: C.muted }) + '">Ctrl + Enter 发送</span>' +
			'      <span style="flex:1"></span>' +
			'      <button id="eai-stop" class="eai-btn" style="' + st({
				display: 'none', background: '#fff', border: '1px solid #e3a9a9', color: '#a83232',
				borderRadius: '9px', padding: '8px 16px', fontSize: '12.5px', fontFamily: FONT
			}) + '">停止</button>' +
			'      <button id="eai-send" class="eai-btn" style="' + st({
				background: C.primary, border: '1px solid ' + C.primary, color: '#fff',
				borderRadius: '9px', padding: '8px 22px', fontSize: '12.5px', fontWeight: '600',
				fontFamily: FONT, boxShadow: '0 2px 8px rgba(47,111,191,.28)'
			}) + '">发送</button>' +
			'    </div>' +
			'  </div>';
	}

	function segCss(active) {
		return st({
			padding: '6px 18px', borderRadius: '999px',
			background: active ? C.primary : '#eef3fa',
			color: active ? '#ffffff' : '#4a5f7d',
			fontWeight: active ? '600' : '400',
			textDecoration: 'none', fontSize: '12.5px'
		});
	}

	function ghostBtn() {
		return st({
			background: '#fff', border: '1px solid ' + C.borderStrong, color: '#23405f',
			borderRadius: '9px', padding: '7px 15px', fontSize: '12.5px', fontFamily: FONT
		});
	}

	/* ------------------------------------------------------------ panel -- */

	UI.openPanel = function () {
		injectStyle();
		var $ = EAI.jq;

		if (UI.dlgPanel) {
			try { UI.dlgPanelCtl.open(); } catch (e) { /* ignore */ }
			UI.refreshStatus();
			return UI.dlgPanel;
		}

		var ctl = EAI.dlg({
			title: 'AI 助手',
			width: 920,
			height: 700,
			modal: false,
			content: panelHtml()
		});
		if (!ctl) {
			EAI.toast('AI 助手面板打开失败，请看「设置 → 诊断」。', 'error');
			return null;
		}
		UI.dlgPanelCtl = ctl;
		var $d = ctl.el;
		UI.dlgPanel = $d;

		$('#eai-btn-settings', $d).on('click', function (e) {
			e.preventDefault(); UI.openSettings();
		});
		$('#eai-btn-clear', $d).on('click', function (e) {
			e.preventDefault();
			UI.clearChat();
		});

		$('#eai-btn-image', $d).on('click', function (e) {
			e.preventDefault();
			$('#eai-file', $d).trigger('click');
		});
		$('#eai-file', $d).on('change', function () {
			var f = this.files && this.files[0];
			if (!f) return;
			var reader = new FileReader();
			reader.onload = function () {
				var dataUrl = String(reader.result || '');
				pendingImage = {
					dataUrl: dataUrl,
					base64: dataUrl.split(',')[1] || '',
					mediaType: f.type || 'image/png'
				};
				$('#eai-imgbadge', $d).css('display', 'inline-block');
				UI.appendMsg('sys', '已附加图片：' + f.name);
			};
			reader.readAsDataURL(f);
			this.value = '';
		});

		$('.eai-tab', $d).on('click', function (e) {
			e.preventDefault();
			UI.activateTab($(this).data('tab'));
		});

		$('#eai-send', $d).on('click', function () { UI.send(); });
		$('#eai-stop', $d).on('click', function () {
			EAI.agent.stop();
			UI.appendMsg('sys', '已请求停止。');
		});
		$('#eai-input', $d).on('keydown', function (e) {
			if (e.keyCode === 13 && (e.ctrlKey || e.metaKey)) { e.preventDefault(); UI.send(); }
		});

		/* designator links and the report card live inside the chat stream */
		$('#eai-chat', $d).on('click', '.eai-locate', function (e) {
			e.preventDefault();
			var pre = $(this).data('pre');
			var found = EAI.eda.locateComponent(pre) || EAI.eda.locateFootprint(pre);
			UI.appendMsg(found ? 'sys' : 'err', found ? ('已定位 ' + pre) : ('未找到 ' + pre));
		});

		$('#eai-chat', $d).on('click', '[data-eai-act]', function (e) {
			e.preventDefault();
			var act = $(this).attr('data-eai-act');
			var card = $(this).closest('[data-eai-card]');
			var md = card.length ? card.data('eai-report') : lastReport;
			if (act === 'preview') UI.openReportDialog(md);
			else { UI._previewMd = md || ''; UI.downloadReport(act); }
		});

		UI.renderPills();
		UI.refreshStatus();
		UI.appendMsg('sys', '你好！当前文档：' + EAI.eda.docKindLabel() +
			'。点上面的胶囊按钮可以快速填入提示词，然后点「发送」。');
		return $d;
	};

	/** Wipes the conversation so the context does not grow forever. */
	UI.clearChat = function () {
		if (!UI.dlgPanel) return;
		var $ = EAI.jq;
		history.length = 0;
		lastReport = '';
		pendingImage = null;
		UI._presetReport = false;
		UI._previewMd = '';
		$('#eai-chat', UI.dlgPanel).empty();
		$('#eai-imgbadge', UI.dlgPanel).css('display', 'none');
		var ta = $('#eai-input', UI.dlgPanel);
		if (ta.length) ta.val('');
		UI.appendMsg('sys', '会话已清空，可以开始新的对话。');
		EAI.log('chat cleared');
	};

	UI.activateTab = function (name) {
		if (!UI.dlgPanel) return;
		var $ = EAI.jq;
		$('.eai-tab', UI.dlgPanel).each(function () {
			var active = $(this).data('tab') === name;
			$(this).attr('style', segCss(active));
			if (active) $(this).addClass('eai-active'); else $(this).removeClass('eai-active');
		});
		$('.eai-pane', UI.dlgPanel).each(function () {
			if ($(this).data('pane') === name) $(this).css('display', 'block');
			else $(this).css('display', 'none');
		});
	};

	/* ------------------------------------------------------------ pills -- */

	UI.renderPills = function () {
		if (!UI.dlgPanel) return;
		var $ = EAI.jq;
		var box = $('#eai-pills', UI.dlgPanel);
		if (!box.length) return;
		box.empty();
		EAI.agent.presets().forEach(function (p) {
			var el = $('<span class="eai-pill"></span>');
			el.attr('data-preset', p.id);
			el.attr('style', st({
				display: 'inline-flex', alignItems: 'center', gap: '6px',
				padding: '7px 14px', borderRadius: '999px',
				border: '1px solid #d6e0f0', background: '#ffffff',
				color: '#25405f', fontSize: '12.5px', userSelect: 'none',
				whiteSpace: 'nowrap', cursor: 'pointer'
			}));
			el.append('<span style="font-size:13px">' + (p.icon || '•') + '</span>');
			el.append(document.createTextNode(p.label));
			el.on('click', function () { UI.usePreset(p); });
			box.append(el);
		});
	};

	UI.usePreset = function (p) {
		if (!UI.dlgPanel) return;
		UI._presetReport = !!p.report;
		var $ = EAI.jq;
		var ta = $('#eai-input', UI.dlgPanel);
		if (!ta.length) return;
		ta.val(p.prompt || '');
		ta.focus();
		try {
			var el = ta[0];
			el.setSelectionRange(el.value.length, el.value.length);
		} catch (e) { /* ignore */ }
		UI.appendMsg('sys', p.prompt
			? ('已填入「' + p.label + '」提示词，可自行修改后发送。')
			: '直接输入你的问题即可。');
	};

	/* ----------------------------------------------------------- status -- */

	UI.refreshStatus = function () {
		if (!UI.dlgPanel) return;
		var $ = EAI.jq;
		var cfg = EAI.cfg.current();
		var txt = cfg.model
			? ((cfg.provider === 'anthropic' ? 'Claude' : 'OpenAI') + ' · ' + cfg.model)
			: '未配置';
		if (!cfg.apiKey) txt = '未配置';
		var stEl = $('#eai-state', UI.dlgPanel);
		if (stEl.length) stEl.text(txt).attr('title', EAI.llm.endpoint(cfg));
		var sub = $('#eai-sub', UI.dlgPanel);
		if (sub.length) {
			try {
				sub.text(EAI.eda.docKindLabel() + ' · ' + (EAI.eda.activeTitle() || '未打开文档'));
			} catch (e) { /* ignore */ }
		}
	};

	/* ----------------------------------------------------------- output -- */

	function bubbleStyle(role) {
		var base = {
			padding: '9px 12px', borderRadius: '11px',
			background: '#ffffff', border: '1px solid ' + C.border,
			color: C.text, wordBreak: 'break-word', overflowWrap: 'anywhere'
		};
		if (role === 'user') { base.background = '#eef5ff'; base.borderColor = '#cfe0fb'; }
		if (role === 'sys') { base.background = '#fff8e9'; base.borderColor = '#f0dfb6'; base.color = '#7a5b16'; base.fontSize = '12.5px'; }
		if (role === 'err') { base.background = '#fdeeee'; base.borderColor = '#f2c8c8'; base.color = '#932626'; }
		return st(base);
	}

	function avatarStyle(role) {
		var bg = role === 'user' ? '#5b8fd6'
			: role === 'ai' ? C.primaryDark
				: role === 'err' ? '#c0392b' : '#8c9aad';
		return st({
			width: '28px', height: '28px', borderRadius: '9px', flex: '0 0 auto',
			background: bg, color: '#fff', display: 'flex',
			alignItems: 'center', justifyContent: 'center', fontSize: '13px'
		});
	}

	UI.appendMsg = function (role, text, opts) {
		if (!UI.dlgPanel) return null;
		var $ = EAI.jq;
		var box = $('#eai-chat', UI.dlgPanel);
		if (!box.length) return null;
		opts = opts || {};

		var icon = role === 'user' ? '&#128100;' : role === 'ai' ? '&#129302;' : role === 'err' ? '!' : 'i';
		var who = role === 'user' ? '你' : role === 'ai' ? 'AI' : role === 'err' ? '错误' : '系统';

		var el = $('<div class="eai-msg">');
		el.attr('style', st({ display: 'flex', gap: '10px', marginBottom: '11px', alignItems: 'flex-start' }));
		el.append('<div style="' + avatarStyle(role) + '">' + icon + '</div>');

		var body = $('<div style="' + st({ flex: '1 1 auto', minWidth: '0' }) + '"></div>');
		body.append('<div style="' + st({ fontSize: '11px', color: C.muted, marginBottom: '3px' }) + '">' + who + '</div>');
		var bubble = $('<div class="eai-bubble" style="' + bubbleStyle(role) + '"></div>');
		if (opts.html) bubble.html(opts.html);
		else bubble.text(text || '');

		body.append(bubble);
		el.append(body);
		box.append(el);
		box[0].scrollTop = box[0].scrollHeight;
		return bubble;
	};

	UI.appendTool = function (name, args) {
		if (!UI.dlgPanel) return null;
		var $ = EAI.jq;
		var box = $('#eai-chat', UI.dlgPanel);
		if (!box.length) return null;

		var el = $('<div class="eai-tool">');
		el.attr('style', st({ display: 'flex', gap: '10px', marginBottom: '9px', alignItems: 'flex-start' }));
		el.append('<div style="' + st({
			width: '28px', height: '28px', borderRadius: '9px', background: C.green,
			color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
			fontSize: '12px', flex: '0 0 auto'
		}) + '">&#9881;</div>');

		var chip = $('<div class="eai-chip"></div>');
		chip.attr('style', st({
			fontSize: '12px', color: C.green, background: '#e8f7f4', border: '1px solid #bfe6df',
			borderRadius: '8px', padding: '5px 11px', maxWidth: '100%',
			overflow: 'hidden', textOverflow: 'ellipsis'
		}));
		chip.append('<b>' + U.esc(name) + '</b> ');
		var a = args === undefined ? '' : U.fmt(args, 150).replace(/\s+/g, ' ');
		chip.append('<span style="color:#5f7a76;font-family:' + MONO + ';font-size:11px">' +
			U.esc(a) + '</span>');

		el.append(chip);
		box.append(el);
		box[0].scrollTop = box[0].scrollHeight;
		return chip;
	};

	UI.appendLog = function (line) {
		if (!UI.dlgPanel) return;
		var $ = EAI.jq;
		var box = $('#eai-log', UI.dlgPanel);
		if (!box.length) return;
		box.append(document.createTextNode(line + '\n'));
		box[0].scrollTop = box[0].scrollHeight;
	};

	/**
	 * A review / analysis produced a report: drop a card into the chat stream.
	 * The card offers a preview dialog and direct downloads; there is no
	 * separate "report" tab any more.
	 */
	UI.showReport = function (markdown) {
		lastReport = markdown || '';
		if (!lastReport || !UI.dlgPanel) return null;
		return UI.appendReportCard(lastReport);
	};

	UI.appendReportCard = function (md) {
		var $ = EAI.jq;
		var box = $('#eai-chat', UI.dlgPanel);
		if (!box.length) return null;

		var size = (md.length / 1024).toFixed(1) + ' KB';

		var card = $('<div data-eai-card="1"></div>');
		card.attr('style', st({
			display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '12px'
		}));
		card.append('<div style="' + st({
			width: '28px', height: '28px', borderRadius: '9px', background: '#b45309',
			color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
			fontSize: '13px', flex: '0 0 auto'
		}) + '">&#128196;</div>');

		var body = $('<div></div>');
		body.attr('style', st({
			flex: '1 1 auto', minWidth: '0',
			border: '1px solid #f0d9a8', borderRadius: '12px', padding: '11px 13px',
			background: 'linear-gradient(180deg,#fffdf6 0%,#fff8e8 100%)'
		}));
		body.append('<div style="' + st({
			fontWeight: '600', color: '#8a5a12', fontSize: '13px'
		}) + '">评审报告已生成</div>');
		body.append('<div style="' + st({
			fontSize: '11.5px', color: '#9a7b45', marginTop: '2px'
		}) + '">' + size + ' · 可在弹窗中预览，或直接下载</div>');

		var row = $('<div style="' + st({ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }) + '"></div>');
		row.append('<button class="eai-btn" data-eai-act="preview" style="' + st({
			background: '#b45309', border: '1px solid #b45309', color: '#fff',
			borderRadius: '8px', padding: '6px 15px', fontSize: '12px', fontFamily: FONT,
			fontWeight: '600'
		}) + '">预览报告</button>');
		row.append('<button class="eai-btn" data-eai-act="md" style="' + ghostBtn() + '">下载 Markdown</button>');
		row.append('<button class="eai-btn" data-eai-act="html" style="' + ghostBtn() + '">下载 HTML</button>');
		body.append(row);

		card.append(body);
		card.data('eai-report', md);
		box.append(card);
		box[0].scrollTop = box[0].scrollHeight;
		return card;
	};

	/** Stand-alone preview window (created once, re-used afterwards). */
	UI.openReportDialog = function (md) {
		var $ = EAI.jq;
		var content = md || lastReport || '';
		UI._previewMd = content;

		if (!UI.dlgReport) {
			var html = styleBlock() + '<div class="eai-root" style="' + st({
				fontFamily: FONT, fontSize: '13px', color: C.text, background: C.bg,
				boxSizing: 'border-box', width: '100%'
			}) + '">' +
				'<div id="eai-report-body" style="' + st({
					padding: '18px 22px', boxSizing: 'border-box', width: '100%'
				}) + '"></div>' +
				'<div style="' + st({
					padding: '10px 22px', borderTop: '1px solid ' + C.border,
					background: C.surface, display: 'flex', gap: '8px'
				}) + '">' +
				'<button class="eai-btn" data-eai-dl="md" style="' + ghostBtn() + '">下载 Markdown</button>' +
				'<button class="eai-btn" data-eai-dl="html" style="' + ghostBtn() + '">下载 HTML</button>' +
				'</div></div>';

			var ctlR = EAI.dlg({
				title: '评审报告', width: 780, height: 660,
				modal: true, content: html
			});
			UI.dlgReportCtl = ctlR;
			UI.dlgReport = ctlR ? ctlR.el : null;
			if (UI.dlgReport) {
				UI.dlgReport.on('click', '[data-eai-dl]', function (e) {
					e.preventDefault();
					UI.downloadReport($(this).attr('data-eai-dl'));
				});
			}
		}
		if (!UI.dlgReport) return null;
		$('#eai-report-body', UI.dlgReport).html(linkify(UI.mdToHtml(content)));
		try { UI.dlgReportCtl.open(); } catch (e) { /* ignore */ }
		return UI.dlgReport;
	};

	UI.downloadReport = function (kind) {
		var md = UI._previewMd || lastReport || '';
		if (kind === 'html') {
			var html = '<!doctype html><meta charset="utf-8"><title>AI 评审报告</title>' +
				'<body style="font-family:\'Microsoft YaHei\',sans-serif;max-width:1040px;' +
				'margin:0 auto;padding:32px;line-height:1.7;color:#1f2733">' +
				UI.mdToHtml(md) + '</body>';
			U.download('ai-report-' + Date.now() + '.html', html, 'text/html;charset=utf-8');
		} else {
			U.download('ai-report-' + Date.now() + '.md', md);
		}
	};

	/* ------------------------------------------------------------- send -- */

	UI.send = function () {
		if (busy) { UI.appendMsg('sys', '正在处理，请稍候或点「停止」。'); return; }
		if (!UI.dlgPanel) { UI.openPanel(); return; }
		var $ = EAI.jq;

		var ta = $('#eai-input', UI.dlgPanel);
		var text = (ta.val() || '').trim();
		if (!text && !pendingImage) return;

		if (!EAI.cfg.ready()) {
			UI.appendMsg('err', '还没有配置模型。请先在「设置」里填写接口地址、API Key 和模型名。');
			UI.openSettings();
			return;
		}

		var userMsg = { role: 'user', content: [] };
		if (text) userMsg.content.push({ type: 'text', text: text });
		if (pendingImage) {
			userMsg.content.push({
				type: 'image', mediaType: pendingImage.mediaType, data: pendingImage.base64
			});
		}

		ta.val('');
		pendingImage = null;
		$('#eai-imgbadge', UI.dlgPanel).css('display', 'none');

		UI.appendMsg('user', text || '(图片)');
		history.push(userMsg);
		UI.runAgent(history);
	};

	UI.runAgent = function (msgs) {
		var $ = EAI.jq;
		busy = true;
		$('#eai-send', UI.dlgPanel).prop('disabled', true).css('opacity', '.55');
		$('#eai-stop', UI.dlgPanel).css('display', 'inline-block');

		var cfg = EAI.cfg.current();
		var system = {
			role: 'system',
			content: [{
				type: 'text',
				text: [
					'你是一位资深硬件工程师，作为插件运行在 EasyEDA（嘉立创EDA 标准版）里。',
					'你可以通过工具直接读取和修改用户当前打开的文档。',
					'当前文档类型：' + EAI.eda.docKindLabel() + '。',
					'回答语言：' + (cfg.language === 'en' ? 'English' : '中文') + '。',
					'规则：',
					'1. 需要数据时先调用工具，不要凭空猜测电路内容；',
					'2. 提到元件时使用准确位号（R12、C3、U1），这样用户能点它定位；',
					'3. 修改文档前先说明你打算改什么；修改后用简短话语汇报；',
					'4. 用 Markdown 输出，网表/BOM 用表格；评审结论按「严重 / 一般 / 建议」分级。'
				].join('\n')
			}]
		};

		var aiBubble = null;
		var lastText = '';

		EAI.agent.run({
			messages: [system].concat(msgs),
			onEvent: function (ev) {
				if (!UI.dlgPanel) return;
				if (ev.type === 'text' && ev.text) {
					lastText = ev.text;
					if (!aiBubble) aiBubble = UI.appendMsg('ai', '', { html: UI.mdToHtml(ev.text) });
					else aiBubble.html(UI.mdToHtml(ev.text));
					var box = $('#eai-chat', UI.dlgPanel);
					if (box.length) box[0].scrollTop = box[0].scrollHeight;
				} else if (ev.type === 'tool') {
					UI.appendTool(ev.name, ev.args);
				} else if (ev.type === 'image') {
					UI.appendMsg('sys', '已截取画布 ' + ev.width + 'x' + ev.height + ' 并发送给模型。');
				}
			}
		}).then(function (r) {
			var text = r.text || lastText;
			if (text) {
				history.push({ role: 'assistant', content: [{ type: 'text', text: text }] });
				if (!aiBubble) UI.appendMsg('ai', '', { html: UI.mdToHtml(text) });
				/* only the review / analysis features produce a report card */
				if (UI._presetReport) UI.showReport(text);
			}
			if (r.aborted) UI.appendMsg('sys', '已停止。');
			else if (!text) UI.appendMsg('err', '模型没有返回内容。');
		}).catch(function (err) {
			var msg = err && err.message ? err.message : String(err);
			UI.appendMsg('err', msg);
			if (err && err.isCors) {
				UI.appendMsg('sys', '这是浏览器跨域（CORS）限制。请确认接口地址允许跨域访问，或改用官方域名。');
			}
			EAI.log('agent failed: ' + msg, 'error');
		}).then(function () {
			busy = false;
			UI._presetReport = false;
			if (UI.dlgPanel) {
				$('#eai-send', UI.dlgPanel).prop('disabled', false).css('opacity', '1');
				$('#eai-stop', UI.dlgPanel).css('display', 'none');
			}
			UI.refreshStatus();
		});
	};

	/* --------------------------------------------------------- settings -- */

	var PROVIDERS = [
		{ id: 'openai', label: 'OpenAI', protocol: 'openai', base: 'https://api.openai.com/v1', model: 'gpt-4o' },
		{ id: 'anthropic', label: 'Anthropic Claude', protocol: 'anthropic', base: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-5' },
		{ id: 'deepseek', label: 'DeepSeek', protocol: 'openai', base: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
		{ id: 'moonshot', label: 'Moonshot / Kimi', protocol: 'openai', base: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
		{ id: 'qwen', label: 'DashScope Qwen', protocol: 'openai', base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
		{ id: 'zhipu', label: 'BigModel GLM', protocol: 'openai', base: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-plus' },
		{ id: 'siliconflow', label: 'SiliconFlow', protocol: 'openai', base: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-72B-Instruct' },
		{ id: 'openrouter', label: 'OpenRouter', protocol: 'openai', base: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-sonnet-4.5' },
		{ id: 'ollama', label: '本地 Ollama', protocol: 'openai', base: 'http://127.0.0.1:11434/v1', model: 'qwen2.5:7b' },
		{ id: 'azure', label: 'Azure OpenAI', protocol: 'openai', base: 'https://<resource>.openai.azure.com/openai/deployments/<deployment>', model: 'gpt-4o' },
		{ id: 'custom-openai', label: '自定义 OpenAI 兼容接口', protocol: 'openai', base: 'https://<your-gateway>/v1', model: '' },
		{ id: 'custom-anthropic', label: '自定义 Claude 兼容接口', protocol: 'anthropic', base: 'https://<your-gateway>/v1', model: 'claude-sonnet-4-5' }
	];

	function labelCss() {
		return st({
			display: 'block', fontSize: '12.5px', fontWeight: '600',
			color: '#3a4a63', marginBottom: '6px'
		});
	}

	function inputCss() {
		return st({
			width: '100%', boxSizing: 'border-box', height: '36px', padding: '0 11px',
			border: '1px solid #d8e0ec', borderRadius: '9px', fontSize: '12.5px',
			fontFamily: FONT, color: C.text, background: '#fff', outline: 'none'
		});
	}

	function field(label, inner, note) {
		return '<div style="' + st({ marginBottom: '13px' }) + '">' +
			'<label style="' + labelCss() + '">' + label + '</label>' + inner +
			(note ? '<div style="' + st({
				fontSize: '11px', color: C.muted, marginTop: '5px',
				wordBreak: 'break-all', lineHeight: '1.5'
			}) + '">' + note + '</div>' : '') +
			'</div>';
	}

	function numField(label, id, value, step, min) {
		return '<div style="' + st({ flex: '1 1 0', minWidth: '0' }) + '">' +
			'<label style="' + labelCss() + '">' + label + '</label>' +
			'<input class="eai-in" type="number" id="' + id + '" value="' + U.esc(String(value)) + '"' +
			' step="' + step + '" min="' + min + '" style="' + inputCss() + '">' +
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

		if (UI.dlgSettings) {
			try { UI.dlgSettingsCtl.open(); } catch (e) { /* ignore */ }
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
			sectionTitle('生成参数') +

			'<div style="' + st({ display: 'flex', gap: '12px', marginBottom: '13px' }) + '">' +
			numField('Temperature', 'eai-temp', cfg.temperature, '0.1', '0') +
			numField('Max tokens', 'eai-maxtok', cfg.maxTokens, '512', '256') +
			numField('超时（秒）', 'eai-timeout', cfg.timeout, '30', '20') +
			'</div>' +

			'<div style="' + st({ display: 'flex', gap: '12px', marginBottom: '13px' }) + '">' +
			'<div style="' + st({ flex: '1 1 0', minWidth: '0' }) + '">' +
			'<label style="' + labelCss() + '">回答语言</label>' +
			'<select id="eai-lang" class="eai-in" style="' + inputCss() + '">' +
			opt('zh', '中文', cfg.language) + opt('en', 'English', cfg.language) +
			'</select></div>' +
			numField('最大工具步数', 'eai-steps', cfg.maxSteps, '1', '1') +
			'<div style="' + st({ flex: '1 1 0' }) + '"></div>' +
			'</div>' +

			field('额外请求头',
				'<input class="eai-in" type="text" id="eai-headers" value="' + U.esc(cfg.extraHeaders) +
				'" placeholder="X-Custom: 1" style="' + inputCss() + '">',
				'可选，一行一个 Key: Value') +
			'</div>' +

			/* ---------------- diagnostics ---------------- */
			'<div style="' + st({ height: '1px', background: C.border, margin: '2px 22px 16px' }) + '"></div>' +
			'<div style="' + st({ padding: '0 22px 16px' }) + '">' +
			sectionTitle('诊断', '反馈问题时请附上这段信息') +
			'<div id="eai-diag" style="' + st({
				fontFamily: MONO, fontSize: '11px', background: C.surface,
				border: '1px solid ' + C.border, borderRadius: '9px', padding: '10px 12px',
				whiteSpace: 'pre-wrap', wordBreak: 'break-all',
				color: '#43536b', maxHeight: '110px', overflow: 'auto', lineHeight: '1.6'
			}) + '">' + U.esc(EAI.diagnostics()) + '</div>' +
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

		refreshEndpoint();
		return $d;
	};

	/* ------------------------------------------------------------ about -- */

	UI.openAbout = function () {
		injectStyle();
		if (UI.dlgAbout) {
			try { UI.dlgAboutCtl.open(); } catch (e) { /* ignore */ }
			return UI.dlgAbout;
		}

		function card(icon, title, desc) {
			return '<div style="' + st({
				flex: '1 1 200px', minWidth: '190px', border: '1px solid ' + C.border,
				borderRadius: '12px', padding: '12px 14px', background: '#fbfcfe'
			}) + '">' +
				'<div style="' + st({
					fontWeight: '600', color: C.primaryDark, fontSize: '13px', marginBottom: '4px'
				}) + '">' + icon + ' ' + title + '</div>' +
				'<div style="' + st({ fontSize: '12px', color: '#5f6f86', lineHeight: '1.6' }) + '">' +
				desc + '</div></div>';
		}

		function h2(t) {
			return '<div style="' + st({
				display: 'flex', alignItems: 'center', gap: '8px',
				fontSize: '14px', fontWeight: '600', color: C.primaryDark,
				margin: '22px 0 10px'
			}) + '"><span style="' + st({
				width: '3px', height: '15px', background: C.primary,
				borderRadius: '2px', display: 'inline-block'
			}) + '"></span>' + t + '</div>';
		}

		function ul(items) {
			return '<ul style="' + st({
				margin: '0 0 0 18px', padding: '0', fontSize: '12.5px',
				color: '#3d4d66', lineHeight: '1.8'
			}) + '">' + items.map(function (t) {
				return '<li style="margin:3px 0">' + t + '</li>';
			}).join('') + '</ul>';
		}

		var html = styleBlock() + '<div class="eai-root" style="' + st({
			fontFamily: FONT, fontSize: '13px', color: C.text, background: C.bg
		}) + '">' +

			'<div style="' + st({
				background: 'linear-gradient(135deg,#0f1f3a 0%,#1e3a68 50%,#2f6fbf 100%)',
				color: '#fff', padding: '26px 28px 24px', display: 'flex',
				gap: '20px', alignItems: 'center'
			}) + '">' +
			'<div style="' + st({
				width: '76px', height: '76px', borderRadius: '20px', background: '#0b1729',
				display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto',
				boxShadow: '0 8px 24px rgba(0,0,0,.35)'
			}) + '">' + logoSvg(60) + '</div>' +
			'<div>' +
			'<div style="' + st({ fontSize: '23px', fontWeight: '600', letterSpacing: '.6px' }) + '">AI 助手</div>' +
			'<div style="' + st({ fontSize: '12.5px', opacity: '.85', marginTop: '3px' }) +
			'">EasyEDA 标准版 · 智能原理图与 PCB 设计助手</div>' +
			'<div style="' + st({
				display: 'inline-block', marginTop: '10px', fontSize: '11.5px',
				background: 'rgba(255,255,255,.16)', padding: '4px 12px', borderRadius: '20px'
			}) + '">v' + EAI.ver + ' · 扩展 ID：' + U.esc(EAI.discoverExtId()) + '</div>' +
			'</div></div>' +

			'<div style="' + st({ padding: '20px 28px 26px' }) + '">' +
			h2('它能做什么') +
			'<div style="' + st({ display: 'flex', flexWrap: 'wrap', gap: '10px' }) + '">' +
			card('📐', '原理图审查', '读取整个工程的网表，检查悬空引脚、缺去耦、网络冲突、上下拉与复位电路。') +
			card('🔧', 'PCB 审查', '解析板框、器件布局与网络，结合截图评审布线、回流路径与工艺。') +
			card('📦', 'BOM 分析', '缺值 / 缺封装 / 重复物料检查，给出采购与贴片建议。') +
			card('✨', '生成原理图', '按自然语言需求放置器件、连线和网络标签，直接落到画布。') +
			card('🧩', '图片生成符号', '识别符号图片的引脚与形状，生成带引脚的原理图符号。') +
			card('✏️', '批量修改', '按位号批量改值、改位号，报告中的位号可点击定位。') +
			'</div>' +

			h2('工作原理') +
			ul([
				'内置 <b>Agent 循环</b>：模型会调用扩展封装好的工具（读网表、BOM、截图、放置器件、改值等），而不是凭空回答。',
				'自动识别当前文档类型（<b>原理图 / PCB / 符号库</b>），只暴露与之匹配的工具。',
				'网表由扩展本地解析文档 JSON 得到，并用编辑器自身的 <code>getWireNetName</code> 校核网络名。',
				'兼容 <b>OpenAI</b> 与 <b>Anthropic</b> 两种协议，接口地址可完全自定义（支持第三方网关与本地模型）。'
			]) +

			h2('快速上手') +
			ul([
				'打开原理图 → 工具栏「AI助手」→ 点 <b>原理图审查</b> → 发送。',
				'首次使用请先在 <b>设置</b> 里填写接口地址、API Key 与模型名，可点「测试连接」验证。',
				'输入框支持 <b>Ctrl + Enter</b> 发送。',
				'报告页可导出 Markdown / HTML；日志页保留每次工具调用，便于排查。'
			]) +

			h2('隐私') +
			ul([
				'API Key 保存在扩展配置与本机，不会上传到任何第三方（除了你配置的模型接口）。',
				'只有在执行审查 / 生成时，设计数据才会发送给你所选择的模型服务。'
			]) +

			'<div style="' + st({
				fontSize: '11.5px', color: C.muted, borderTop: '1px solid #e9eef6',
				marginTop: '20px', paddingTop: '14px', lineHeight: '1.7'
			}) + '">' +
			'<b style="color:#3d4d66">扩展 ID</b>：' + U.esc(EAI.discoverExtId()) +
			' ｜ <b style="color:#3d4d66">文档</b>：' + U.esc(EAI.eda.docKindLabel()) +
			' ｜ <b style="color:#3d4d66">构建</b>：EasyEDA Std 扩展 API' +
			'<br/>本扩展基于嘉立创EDA（EasyEDA）标准版的扩展 API 开发，与专业版扩展不通用。' +
			'</div></div></div>';

		var ctl = EAI.dlg({
			title: '关于 AI 助手',
			width: 740,
			height: 700,
			modal: true,
			content: html
		});
		if (!ctl) return null;
		UI.dlgAboutCtl = ctl;
		UI.dlgAbout = ctl.el;
		return UI.dlgAbout;
	};
})();
