/* =====================================================================
 * EasyEDA Std extension — "AI Assistant" / AI 助手
 * core.js — namespace, utilities, configuration store, extension identity,
 *           diagnostics
 *
 * Every file of a Std extension is evaluated as
 *     function (api, $, Locale) { <file contents> }
 * in the top window of the editor, so all state lives on window.EAI.
 * ===================================================================== */
(function () {
	'use strict';

	/*
	 * NOTE: a fresh namespace per extension instance.  Two different extension
	 * ids are two different instances and both scripts run in the same window;
	 * sharing one object made the second id read the first one's config,
	 * conversation and cached extension id.
	 */
	var EAI = (window.EAI = {});

	EAI.ver = '0.0.1';   /* fallback — replaced by manifest.version below */
	EAI.L = typeof Locale !== 'undefined' ? Locale : null;
	EAI.jq = typeof $ !== 'undefined' ? $ : null;
	EAI.api = typeof api !== 'undefined' ? api : null;

	/* ----------------------------------------------------------- utils -- */

	var U = (EAI.util = {});

	U.t = function (key, fallback) {
		try {
			if (EAI.L && typeof EAI.L.i18n === 'function') {
				var v = EAI.L.i18n(key);
				if (v && v !== key) return v;
			}
		} catch (e) { /* ignore */ }
		return fallback || key;
	};

	U.esc = function (s) {
		return String(s == null ? '' : s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	};

	U.uid = function (prefix) {
		return (prefix || 'eai') + '-' + Date.now().toString(36) + '-' +
			Math.random().toString(36).slice(2, 8);
	};

	U.clamp = function (v, lo, hi) {
		v = Number(v);
		if (!isFinite(v)) return lo;
		return v < lo ? lo : v > hi ? hi : v;
	};

	U.clone = function (o) {
		try { return JSON.parse(JSON.stringify(o)); }
		catch (e) { return o; }
	};

	U.sleep = function (ms) {
		return new Promise(function (r) { setTimeout(r, ms); });
	};

	U.fmt = function (obj, max) {
		var s;
		try { s = JSON.stringify(obj, null, 2); }
		catch (e) { s = String(obj); }
		if (max && s.length > max) s = s.slice(0, max) + '\n…(truncated)';
		return s;
	};

	/* ------------------------------------------------------------ log --- */

	var logLines = [];
	EAI.logLines = logLines;

	EAI.log = function (msg, level) {
		var line = '[' + new Date().toLocaleTimeString() + '] ' +
			(level || 'info').toUpperCase() + '  ' + msg;
		logLines.push(line);
		if (logLines.length > 800) logLines.shift();
		try {
			if (level === 'error') console.error('[EAI] ' + msg);
			else console.log('[EAI] ' + msg);
		} catch (e) { /* ignore */ }
		try {
			if (EAI.ui && EAI.ui.appendLog) EAI.ui.appendLog(line, level);
		} catch (e) { /* ignore */ }
		return line;
	};

	/**
	 * Traces one API call: logs the call, the failure and the stack.
	 * This exists because the Std API is under-documented and a silent
	 * failure is otherwise indistinguishable from "nothing happened".
	 */
	EAI.call = function (name, arg) {
		try {
			var r = EAI.api(name, arg);
			return r;
		} catch (e) {
			EAI.log('api("' + name + '") threw: ' + (e && e.message ? e.message : e) +
				'  ' + ((e && e.stack) ? String(e.stack).split('\n')[1] : ''), 'error');
			throw e;
		}
	};

	/* a single global error trap that feeds our log */
	if (!EAI._errTrap) {
		EAI._errTrap = true;
		try {
			window.addEventListener('error', function (ev) {
				if (!ev || !ev.message) return;
				EAI.log('window error: ' + ev.message + '  @' +
					(ev.filename || '') + ':' + (ev.lineno || ''), 'error');
			});
			window.addEventListener('unhandledrejection', function (ev) {
				var r = ev && ev.reason;
				EAI.log('unhandled rejection: ' + (r && r.message ? r.message : r), 'error');
			});
		} catch (e) { /* ignore */ }
	}

	EAI.toast = function (msg, level) {
		try {
			if (EAI.jq && EAI.jq.messager) {
				if (level === 'error') EAI.jq.messager.error(msg);
				else if (level === 'warn') EAI.jq.messager.warn(msg);
				else EAI.jq.messager.info(msg);
				return;
			}
		} catch (e) { /* ignore */ }
		alert(msg);
	};

	/* ------------------------------------------------- extension identity */

	/**
	 * The Std loader never hands the extension its own id — the id is typed
	 * by the user when the extension is installed.  It is required to build
	 * command names ("extension-<id>-<cmd>"), so it has to be recovered:
	 *
	 *  1. find the registered instance whose manifest loads our scripts;
	 *  2. otherwise probe: createCommand() silently drops every key that is
	 *     not prefixed with "extension-<id>-", so registering one key per
	 *     candidate id leaves exactly one survivor.
	 */
	EAI.discoverExtId = function () {
		if (EAI.extId) return EAI.extId;

		var insts = {};
		try {
			insts = (window.easyeda && window.easyeda.extension &&
				window.easyeda.extension.instances) || {};
		} catch (e) { /* ignore */ }
		EAI.instances = insts;

		var id = null, k, inst;
		var ids = Object.keys(insts);

		/* 1 — manifest heuristic */
		for (k = 0; k < ids.length; k++) {
			inst = insts[ids[k]];
			var sc = inst && inst.manifest && inst.manifest.scripts;
			if (sc && Object.prototype.toString.call(sc) === '[object Array]' &&
				sc.indexOf('core.js') >= 0) { id = ids[k]; break; }
		}

		/* 2 — probe every candidate id */
		if (!id && ids.length) {
			var MARK = '__eai_probe__';
			ids.forEach(function (cand) {
				try {
					var c = {};
					c['extension-' + cand + '-' + MARK] = function () { /* noop */ };
					EAI.api('createCommand', c);
				} catch (e) { /* ignore */ }
			});
			for (k = 0; k < ids.length; k++) {
				inst = insts[ids[k]];
				if (!inst || !inst.commands) continue;
				for (var cmdName in inst.commands) {
					if (!Object.prototype.hasOwnProperty.call(inst.commands, cmdName)) continue;
					if (cmdName.indexOf(MARK) >= 0) { id = ids[k]; break; }
				}
				if (id) break;
			}
			/* clean up the probe commands */
			ids.forEach(function (cand) {
				try {
					var cmds = insts[cand] && insts[cand].commands;
					if (!cmds) return;
					Object.keys(cmds).forEach(function (n) {
						if (n.indexOf(MARK) >= 0) delete cmds[n];
					});
				} catch (e) { /* ignore */ }
			});
		}

		EAI.extId = id || 'eai';
		EAI.idKnown = !!id;
		EAI.log('extension id = ' + EAI.extId +
			(id ? '' : ' (not detected — commands may not fire)'));
		return EAI.extId;
	};

	EAI.cmd = function (name) {
		return 'extension-' + EAI.discoverExtId() + '-' + name;
	};

	/* ------------------------------------------------------ config store -- */

	var CFG_STORE_KEY = 'config';
	var CFG_LOCAL_PREFIX = 'eai.config.v2.';

	/** localStorage is shared by every extension — namespace it by id. */
	function localCfgKey() {
		return CFG_LOCAL_PREFIX + EAI.discoverExtId();
	}

	EAI.cfgDefaults = {
		provider: 'openai',
		baseUrl: '',
		apiKey: '',
		model: '',
		temperature: 0.2,
		maxTokens: 8192,
		language: 'zh',
		timeout: 300,
		extraHeaders: '',
		maxSteps: 12
	};

	EAI.cfg = {
		load: function () {
			var raw = null, c = null;
			try {
				raw = window.localStorage.getItem(localCfgKey());
				if (raw) c = JSON.parse(raw);
			} catch (e) { /* ignore */ }
			if (!c) {
				try {
					var v = EAI.api('readConfig', CFG_STORE_KEY);
					if (v) c = (typeof v === 'string') ? JSON.parse(v) : v;
				} catch (e) { /* ignore */ }
			}
			var out = {}, key;
			for (key in EAI.cfgDefaults) {
				if (Object.prototype.hasOwnProperty.call(EAI.cfgDefaults, key)) {
					out[key] = EAI.cfgDefaults[key];
				}
			}
			if (c && typeof c === 'object') {
				for (key in c) {
					if (Object.prototype.hasOwnProperty.call(c, key) &&
						c[key] !== undefined && c[key] !== null) out[key] = c[key];
				}
			}
			return out;
		},

		save: function (cfg) {
			try { window.localStorage.setItem(localCfgKey(), JSON.stringify(cfg)); }
			catch (e) { /* ignore */ }
			try {
				var id = EAI.discoverExtId();
				var payload = {};
				payload[id] = {};
				payload[id][CFG_STORE_KEY] = JSON.stringify(cfg);
				EAI.api('saveConfig', payload);
			} catch (e) { EAI.log('saveConfig failed: ' + e, 'error'); }
			return cfg;
		},

		current: function () {
			if (!EAI._cfg) EAI._cfg = EAI.cfg.load();
			return EAI._cfg;
		},

		update: function (patch) {
			var c = EAI.cfg.current(), k;
			for (k in patch) {
				if (Object.prototype.hasOwnProperty.call(patch, k)) c[k] = patch[k];
			}
			EAI.cfg.save(c);
			return c;
		},

		ready: function () {
			var c = EAI.cfg.current();
			return !!(c.apiKey && c.baseUrl && c.model);
		}
	};

	/* ----------------------------------------------------------- dialogs -- */

	/**
	 * Creates a floating window of our own.
	 *
	 * The platform's api('createDialog') is an EasyUI dialog: it starts
	 * closed, it lives inside the editor's own DOM and it did not reliably
	 * pick up our styling.  Rendering our own overlay removes all of that
	 * uncertainty — and it looks better.
	 *
	 * @param {Object} opts {title, width, height, modal, content, dismissible}
	 * @returns {{el, root, card, open, close, isOpen, setTitle}}
	 *          `el` is the scrollable content container (a jQuery object),
	 *          so existing $("#id", dlg.el) lookups keep working.
	 */
	EAI.dlg = function (opts) {
		opts = opts || {};
		var $ = EAI.jq;
		if (!$ || typeof $ !== 'function') {
			EAI.log('jQuery is missing — cannot create a dialog', 'error');
			return null;
		}

		var width = Number(opts.width) || 720;
		var height = Number(opts.height) || 640;
		var modal = opts.modal !== false;
		var dismissible = opts.dismissible !== false;
		var z = (EAI._dlgZ = (EAI._dlgZ || 2147483000) + 2);

		var maskCss = [
			'position:fixed', 'top:0', 'right:0', 'bottom:0', 'left:0',
			'z-index:' + z,
			'display:flex', 'align-items:center', 'justify-content:center',
			'padding:18px', 'box-sizing:border-box',
			modal ? 'background:rgba(10,20,36,.45)' : 'background:transparent;pointer-events:none'
		].join(';');

		var cardCss = [
			'pointer-events:auto',
			'width:' + width + 'px', 'max-width:100%',
			'height:' + height + 'px', 'max-height:92vh',
			'background:#ffffff', 'border-radius:14px',
			'box-shadow:0 24px 70px rgba(9,20,38,.38)',
			'display:flex', 'flex-direction:column', 'overflow:hidden',
			"font-family:'Microsoft YaHei','Segoe UI',Verdana,sans-serif"
		].join(';');

		var headCss = [
			'flex:0 0 auto', 'height:42px', 'display:flex', 'align-items:center',
			'gap:8px', 'padding:0 8px 0 16px', 'background:#f7f9fc',
			'border-bottom:1px solid #e3e8f0', 'cursor:move', 'user-select:none'
		].join(';');

		var titleCss = [
			'flex:1 1 auto', 'min-width:0', 'font-size:13px', 'font-weight:600',
			'color:#1e3a68', 'overflow:hidden', 'text-overflow:ellipsis',
			'white-space:nowrap'
		].join(';');

		var xCss = [
			'width:30px', 'height:30px', 'border-radius:8px', 'display:flex',
			'align-items:center', 'justify-content:center', 'color:#6b7a90',
			'text-decoration:none', 'font-size:15px', 'line-height:1', 'flex:0 0 auto'
		].join(';');

		/* the editor disables text selection globally; turn it back on for
		   the dialog content so the log / report can be copied */
		var bodyCss = 'flex:1 1 auto;overflow:auto;position:relative;min-height:0;' +
			'user-select:text !important;-webkit-user-select:text !important;cursor:auto';

		var root = $('<div>').attr('style', maskCss).attr('class', 'eai-mask');
		var card = $('<div>').attr('style', cardCss).attr('class', 'eai-window');
		var head = $('<div>').attr('style', headCss).attr('class', 'eai-window-head');
		var title = $('<div>').attr('style', titleCss).attr('class', 'eai-window-title')
			.text(opts.title || 'AI 助手');
		var closeBtn = $('<a href="#">').attr('style', xCss).attr('class', 'eai-window-x')
			.html('&#10005;');
		var body = $('<div>').attr('style', bodyCss).attr('class', 'eai-window-body');

		head.append(title).append(closeBtn);
		card.append(head).append(body);
		root.append(card);
		$('body').append(root);

		if (opts.content) body.html(opts.content);

		var ctl = {
			el: body,
			root: root,
			card: card,
			open: function () {
				root.css('display', 'flex').css('z-index', (EAI._dlgZ = (EAI._dlgZ || 2147483000) + 2));
				return ctl;
			},
			close: function () {
				root.css('display', 'none');
				try { if (opts.onClose) opts.onClose(); } catch (e) { /* ignore */ }
				return ctl;
			},
			isOpen: function () { return root.css('display') !== 'none'; },
			setTitle: function (t) { title.text(t || ''); return ctl; }
		};

		closeBtn.on('click', function (e) {
			e.preventDefault();
			ctl.close();
		});

		/* clicking the dimmed area closes a modal dialog */
		if (modal && dismissible) {
			root.on('click', function (e) {
				if (e.target === root[0]) ctl.close();
			});
		}

		/* dragging by the title bar */
		(function enableDrag() {
			var dragging = false, startX = 0, startY = 0;
			var pos = { left: null, top: null };

			head.on('mousedown', function (e) {
				if ($(e.target).is('.eai-window-x')) return;
				dragging = true;
				var rect = card[0].getBoundingClientRect();
				pos.left = rect.left;
				pos.top = rect.top;
				startX = e.clientX;
				startY = e.clientY;
				root.css({ display: 'block', padding: '0' });
				card.css({ position: 'fixed', margin: '0' });
				e.preventDefault();
			});

			$(document).on('mousemove.eaidrag', function (e) {
				if (!dragging) return;
				var w = card[0].offsetWidth || width;
				var h = card[0].offsetHeight || height;
				var vw = window.innerWidth || 1200;
				var vh = window.innerHeight || 800;
				/* never let the window be dragged completely off screen */
				var left = Math.min(Math.max(-w + 80, pos.left + e.clientX - startX), vw - 80);
				var top = Math.min(Math.max(0, pos.top + e.clientY - startY), vh - 42);
				card.css({ left: left + 'px', top: top + 'px' });
			}).on('mouseup.eaidrag', function () {
				dragging = false;
			});
		})();

		/* ESC closes the newest dialog */
		if (!EAI._dlgEscBound) {
			EAI._dlgEscBound = true;
			$(document).on('keydown.eaiesc', function (e) {
				if (e.keyCode !== 27) return;
				var list = EAI._dlgList || [];
				for (var i = list.length - 1; i >= 0; i--) {
					if (list[i].isOpen()) { list[i].close(); return; }
				}
			});
		}
		EAI._dlgList = EAI._dlgList || [];
		EAI._dlgList.push(ctl);

		ctl.open();
		EAI.log('dialog opened: ' + (opts.title || '') + ' (' + width + 'x' + height + ')');
		return ctl;
	};

	/* ---------------------------------------------------------- download -- */

	EAI.download = function (filename, content, mime) {
		var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
		var url = URL.createObjectURL(blob);
		var a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
	};

	/* ------------------------------------------------------- diagnostics -- */

	EAI.diagnostics = function () {
		var cfg = EAI.cfg.current();
		var lines = [];
		lines.push('AI Assistant v' + EAI.ver);
		lines.push('extension id : ' + EAI.discoverExtId() +
			(EAI.idKnown ? '' : '  (not detected!)'));
		lines.push('instances    : ' + Object.keys(EAI.instances || {}).join(', '));
		lines.push('api available: ' + (typeof EAI.api === 'function'));
		lines.push('jQuery       : ' + (EAI.jq ? (EAI.jq.fn && EAI.jq.fn.jquery) : 'missing'));
		lines.push('dialog fn    : ' + (EAI.jq && EAI.jq.fn && typeof EAI.jq.fn.dialog));
		lines.push('dialogsContainer: ' + !!document.getElementById('dialogsContainer'));
		lines.push('doc kind     : ' + (EAI.eda ? EAI.eda.docKind() : '?'));
		lines.push('provider     : ' + cfg.provider);
		lines.push('model        : ' + (cfg.model || '-'));
		lines.push('base url     : ' + (cfg.baseUrl || '-'));
		lines.push('api key      : ' + (cfg.apiKey ? 'set (' + cfg.apiKey.length + ' chars)' : 'missing'));
		return lines.join('\n');
	};
	/* the real version lives in manifest.json and is bumped by tools/pack.js */
	try {
		var _inst = (window.easyeda && window.easyeda.extension &&
			window.easyeda.extension.instances || {})[EAI.discoverExtId()];
		if (_inst && _inst.manifest && _inst.manifest.version) {
			EAI.ver = String(_inst.manifest.version);
		}
	} catch (e) { /* keep the fallback */ }

})();
