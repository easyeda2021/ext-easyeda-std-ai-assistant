(function () {
	'use strict';

	var EAI = (window.EAI = window.EAI || {});
	var UI = (EAI.ui = EAI.ui || {});
	var U = EAI.util;
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
			/* a raw " would terminate the enclosing style="..." attribute */
			out.push(name + ':' + String(o[k]).replace(/"/g, '&quot;'));
		}
		return out.join(';');
	}

	/* NOTE: these values land inside style="..." attributes, so they must not
	   contain double quotes — otherwise the attribute is truncated and every
	   property after font-family silently disappears. */
	var FONT = "'Microsoft YaHei','Segoe UI',Verdana,sans-serif";
	var MONO = "Consolas,Monaco,'Courier New',monospace";

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

	/* ------------------------------------------------------ line icons -- */

	function svgIcon(paths, size, color) {
		return '<svg width="' + (size || 16) + '" height="' + (size || 16) + '" ' +
			'viewBox="0 0 24 24" fill="none" stroke="' + (color || 'currentColor') + '" ' +
			'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ' +
			'style="display:block;pointer-events:none">' + paths + '</svg>';
	}

	var ICONS = {
		trash: '<path d="M3 6h18"/><path d="M8 6V4.5a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 1 16 4.5V6"/>' +
			'<path d="M18.5 6l-.9 13.2a1.8 1.8 0 0 1-1.8 1.8H8.2a1.8 1.8 0 0 1-1.8-1.8L5.5 6"/>' +
			'<path d="M10 11v5"/><path d="M14 11v5"/>',
		settings: '<circle cx="12" cy="12" r="3"/>' +
			'<path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06' +
			'a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.1' +
			'a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06' +
			'A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.1' +
			'A1.7 1.7 0 0 0 4.6 8.86a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06' +
			'A1.7 1.7 0 0 0 8.96 4.5a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.1' +
			'a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06' +
			'a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.1' +
			'a1.7 1.7 0 0 0-1.5 1z"/>',
		image: '<rect x="3" y="3.5" width="18" height="17" rx="2.5"/>' +
			'<circle cx="8.6" cy="8.8" r="1.5"/><path d="M21 15.2l-4.3-4.3L5.6 21"/>',
		send: '<path d="M12 19.5V5.2"/><path d="M6.4 10.8L12 5.2l5.6 5.6"/>',
		stop: '<rect x="7" y="7" width="10" height="10" rx="2" fill="#ffffff" stroke="none"/>',
		copy: '<rect x="9" y="9" width="11" height="11" rx="2.4"/>' +
			'<path d="M5.4 15.2V6a1.6 1.6 0 0 1 1.6-1.6h8.4"/>',
		log: '<path d="M4.5 6.5h15"/><path d="M4.5 12h15"/><path d="M4.5 17.5h9.5"/>'
	};

	function iconBtn(id, title, paths) {
		return '<a href="#" id="' + id + '" title="' + title + '" style="' + st({
			color: '#ffffff', textDecoration: 'none', padding: '7px',
			borderRadius: '9px', background: 'rgba(255,255,255,.12)',
			display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
			flex: '0 0 auto', lineHeight: '0'
		}) + '">' + svgIcon(paths, 16) + '</a>';
	}

	function segCss(active) {
		return st({
			padding: '5px 13px', borderRadius: '999px',
			background: active ? '#ffffff' : 'rgba(255,255,255,.12)',
			color: active ? C.primaryDark : '#e6eefc',
			fontWeight: active ? '600' : '400',
			textDecoration: 'none', fontSize: '12px', whiteSpace: 'nowrap',
			display: 'inline-block'
		});
	}

	function ghostBtn() {
		return st({
			background: '#fff', border: '1px solid ' + C.borderStrong, color: '#23405f',
			borderRadius: '9px', padding: '7px 15px', fontSize: '12.5px', fontFamily: FONT
		});
	}

	/** A cached dialog is unusable once its DOM is gone (extension reload). */
	function isAlive(ctl) {
		try {
			return !!(ctl && ctl.root && ctl.root.length && document.body &&
				document.body.contains(ctl.root[0]));
		} catch (e) { return false; }
	}

	/** Clipboard write with a graceful fallback + inline feedback. */
	UI.copyText = function (text, btn) {
		var label = (btn && btn.length && btn[0]) ? btn[0].innerHTML : '';

		function feedback(ok) {
			if (!btn || !btn.length) return;
			btn.text(ok ? '已复制' : '复制失败')
				.css('color', ok ? '#1d7a3e' : '#932626');
			setTimeout(function () {
				btn.html(label).css('color', '#8794a8');
			}, 1500);
		}

		function legacy() {
			try {
				var ta = document.createElement('textarea');
				ta.value = text;
				ta.setAttribute('readonly', 'readonly');
				ta.style.position = 'fixed';
				ta.style.top = '-1000px';
				ta.style.opacity = '0';
				document.body.appendChild(ta);
				ta.select();
				var ok = document.execCommand('copy');
				document.body.removeChild(ta);
				return ok;
			} catch (e) { return false; }
		}

		try {
			if (navigator.clipboard && navigator.clipboard.writeText) {
				navigator.clipboard.writeText(String(text)).then(
					function () { feedback(true); },
					function () { feedback(legacy()); });
			} else {
				feedback(legacy());
			}
		} catch (e) {
			feedback(legacy());
		}
	};

	/* ---- shared with ui.js / ui-report.js / ui-settings.js / ui-about.js ---- */
	UI.st = st;
	UI.C = C;
	UI.FONT = FONT;
	UI.MONO = MONO;
	UI.styleBlock = styleBlock;
	UI.injectStyle = injectStyle;
	UI.svgIcon = svgIcon;
	UI.ICONS = ICONS;
	UI.iconBtn = iconBtn;
	UI.segCss = segCss;
	UI.ghostBtn = ghostBtn;
	UI.linkify = linkify;
	UI.isAlive = isAlive;
})();
