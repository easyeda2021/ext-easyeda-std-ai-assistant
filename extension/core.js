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

	/** Current editor language code, e.g. "en" / "zh-hans". */
	EAI.lang = function () {
		/* unknown -> English */
		try { return (EAI.L && EAI.L._curr) || 'en'; } catch (e) { return 'en'; }
	};

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

		var ids = Object.keys(insts);
		var id = null, k, i, inst;

		/*
		 * 1) Probe — authoritative.  createCommand() drops every key that is not
		 *    prefixed with "extension-<the real id>-", so registering one key per
		 *    candidate leaves exactly one survivor.
		 *
		 *    This order matters after "remove extension → load again with a new
		 *    id": the stale instance is still listed in `instances`, and a
		 *    manifest scan would happily return the OLD id, registering our
		 *    commands under a name the new menu never fires.
		 */
		if (ids.length) {
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

		/* 2) Fallback — the NEWEST instance that loads our scripts. */
		if (!id && ids.length) {
			for (i = ids.length - 1; i >= 0; i--) {
				inst = insts[ids[i]];
				var sc = inst && inst.manifest && inst.manifest.scripts;
				if (sc && Object.prototype.toString.call(sc) === '[object Array]' &&
					sc.indexOf('core.js') >= 0) { id = ids[i]; break; }
			}
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

	/*
	 * Configuration model (multi provider / multi model)
	 *
	 * {
	 *   language, temperature, maxTokens, timeout, maxSteps, extraHeaders,
	 *   active: { providerId, modelId },
	 *   providers: [
	 *     { id, name, protocol:'openai'|'anthropic', baseUrl, apiKey,
	 *       collapsed:false, models:[{ id, name }] }
	 *   ]
	 * }
	 */
	var cfgSeq = 0;
	function cfgId(prefix) {
		cfgSeq++;
		return prefix + '-' + Date.now().toString(36) + cfgSeq.toString(36);
	}

	EAI.cfgId = cfgId;

	function newModel(name) {
		return { id: cfgId('m'), name: String(name || '').trim() };
	}

	EAI.cfgDefaults = {
		language: 'zh',
		temperature: 0.2,
		maxTokens: 8192,
		timeout: 300,
		maxSteps: 12,
		extraHeaders: '',
		active: { providerId: '', modelId: '' },
		providers: []
	};

	function defaultConfig() {
		/* no provider out of the box — the user adds their own */
		return {
			language: 'zh',
			temperature: 0.2,
			maxTokens: 8192,
			timeout: 300,
			maxSteps: 12,
			extraHeaders: '',
			providers: [],
			active: { providerId: '', modelId: '' }
		};
	}

	/** Old flat configs (provider/baseUrl/apiKey/model) → new shape. */
	function migrateConfig(c) {
		if (!c || typeof c !== 'object') return null;
		if (Object.prototype.toString.call(c.providers) === '[object Array]') return c;

		var p = {
			id: cfgId('p'),
			name: c.provider === 'anthropic' ? 'Anthropic Claude' : 'OpenAI',
			protocol: c.provider === 'anthropic' ? 'anthropic' : 'openai',
			baseUrl: c.baseUrl || '',
			apiKey: c.apiKey || '',
			collapsed: false,
			models: c.model ? [newModel(c.model)] : []
		};
		var hasData = !!(p.baseUrl || p.apiKey || p.models.length);
		return {
			language: c.language || 'zh',
			temperature: c.temperature != null ? c.temperature : 0.2,
			maxTokens: c.maxTokens || 8192,
			timeout: c.timeout || 300,
			maxSteps: c.maxSteps || 12,
			extraHeaders: c.extraHeaders || '',
			providers: hasData ? [p] : [],
			active: { providerId: hasData ? p.id : '', modelId: p.models[0] ? p.models[0].id : '' }
		};
	}

	EAI.cfg = {
		/** raw configuration (providers + global options) */
		raw: function (force) {
			if (EAI._cfg && !force) return EAI._cfg;

			var c = null;
			try {
				var stored = window.localStorage.getItem(localCfgKey());
				if (stored) c = JSON.parse(stored);
			} catch (e) { /* ignore */ }

			if (!c) {
				try {
					var v = EAI.api('readConfig', CFG_STORE_KEY);
					if (v) c = (typeof v === 'string') ? JSON.parse(v) : v;
				} catch (e) { /* ignore */ }
			}

			var out = migrateConfig(c) || defaultConfig();
			EAI._cfg = out;
			return out;
		},

		/** flat runtime configuration used by llm.js / agent.js */
		resolve: function (raw) {
			raw = raw || EAI.cfg.raw();
			var provs = raw.providers || [];
			var p = null, i;

			for (i = 0; i < provs.length; i++) {
				if (provs[i].id === (raw.active && raw.active.providerId)) { p = provs[i]; break; }
			}
			if (!p) p = provs[0] || null;

			var m = null;
			if (p) {
				var models = p.models || [];
				for (i = 0; i < models.length; i++) {
					if (models[i].id === (raw.active && raw.active.modelId)) { m = models[i]; break; }
				}
				if (!m) m = models[0] || null;
			}

			return {
				provider: (p && p.protocol) || 'openai',
				baseUrl: (p && p.baseUrl) || '',
				apiKey: (p && p.apiKey) || '',
				model: (m && m.name) || '',
				providerName: (p && p.name) || '',
				providerId: (p && p.id) || '',
				modelId: (m && m.id) || '',
				language: raw.language || 'zh',
				temperature: raw.temperature,
				maxTokens: raw.maxTokens,
				timeout: raw.timeout,
				maxSteps: raw.maxSteps,
				extraHeaders: raw.extraHeaders || ''
			};
		},

		/** runtime config (previous `current()` contract) */
		current: function () {
			return EAI.cfg.resolve(EAI.cfg.raw());
		},

		save: function (raw) {
			raw = migrateConfig(raw) || raw;
			EAI._cfg = raw;
			try { window.localStorage.setItem(localCfgKey(), JSON.stringify(raw)); }
			catch (e) { /* ignore */ }
			try {
				var payload = {};
				payload[EAI.discoverExtId()] = {};
				payload[EAI.discoverExtId()][CFG_STORE_KEY] = JSON.stringify(raw);
				EAI.api('saveConfig', payload);
			} catch (e) { EAI.log('saveConfig failed: ' + e, 'error'); }
			return raw;
		},

		ready: function () {
			var c = EAI.cfg.current();
			return !!(c.apiKey && c.baseUrl && c.model);
		},

		/** switch the model used by the panel */
		setActive: function (providerId, modelId) {
			var raw = U_clone(EAI.cfg.raw());
			raw.active = { providerId: providerId, modelId: modelId };
			EAI.cfg.save(raw);
			return raw;
		},

		/** true when another provider already uses this name */
		nameTaken: function (raw, name, exceptId) {
			var n = String(name || '').trim().toLowerCase();
			if (!n) return false;
			return (raw.providers || []).some(function (p) {
				return p.id !== exceptId && String(p.name || '').trim().toLowerCase() === n;
			});
		},

		/** true when the provider already has this model name */
		modelTaken: function (provider, name, exceptId) {
			var n = String(name || '').trim().toLowerCase();
			if (!n) return false;
			return ((provider && provider.models) || []).some(function (m) {
				return m.id !== exceptId && String(m.name || '').trim().toLowerCase() === n;
			});
		}
	};

	function U_clone(o) {
		try { return JSON.parse(JSON.stringify(o)); }
		catch (e) { return o; }
	}

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
			'pointer-events:auto', 'position:relative',
			'width:' + width + 'px', 'max-width:100%',
			'height:' + height + 'px', 'max-height:92vh',
			'background:#ffffff', 'border-radius:8px',
			'box-shadow:0 24px 70px rgba(9,20,38,.38)',
			'display:flex', 'flex-direction:column', 'overflow:hidden',
			"font-family:'Microsoft YaHei','Segoe UI',Verdana,sans-serif", 'font-size:12px'
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
		/* overflow-x is hidden on purpose: a horizontal scrollbar would sit
		   exactly over the bottom resize grip and swallow the drag */
		var bodyCss = 'flex:1 1 auto;overflow-y:auto;overflow-x:hidden;position:relative;min-height:0;' +
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

		/* translate the rendered UI when the editor is not Chinese */
		if (EAI.i18n && EAI.i18n.apply) {
			EAI.i18n.apply(body[0]);
			if (EAI.i18n.watch) EAI.i18n.watch(body[0]);
		}

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

		/* ---- move + resize ------------------------------------------------
		 * Listeners live in the CAPTURE phase on window: the editor's own
		 * handlers call stopPropagation() on mouseup, which used to leave a
		 * drag stuck (the "release is broken" bug).
		 */
		function beginDrag(mode, e) {
			if (e.button) return;
			e.preventDefault();
			e.stopPropagation();

			/* a previous drag that never got its mouseup must not linger */
			if (card[0].__eaiDragEnd) {
				try { card[0].__eaiDragEnd(); } catch (err) { /* ignore */ }
				card[0].__eaiDragEnd = null;
			}

			/* keep the mask exactly as it is — switching it to block made the
			   card jump to the left for a frame on the very first drag */
			var rect = card[0].getBoundingClientRect();
			card[0].style.maxWidth = 'none';
			card[0].style.maxHeight = 'none';
			card.css({
				position: 'fixed', margin: '0',
				left: rect.left + 'px', top: rect.top + 'px',
				width: rect.width + 'px', height: rect.height + 'px'
			});

			/*
			 * A non-modal dialog's mask is pointer-events:none, so the mouse
			 * would leave our document and enter the editor iframe while
			 * dragging — mouseup never comes back and the drag sticks.
			 * Swallow pointer events for the whole viewport until release.
			 */
			var maskEvents = root[0].style.pointerEvents;
			root[0].style.pointerEvents = 'auto';

			var startX = e.clientX, startY = e.clientY;
			var startL = rect.left, startT = rect.top;
			var startW = rect.width, startH = rect.height;

			/* the offsets are tiny and glitchy on some high-DPI setups; keep a
			   small dead zone on the first pixels of a resize */
			var MIN_W = 380, MIN_H = 260;

			function onMove(ev) {
				var vw = window.innerWidth || 1200;
				var vh = window.innerHeight || 800;
				var el = card[0];

				if (mode === 'move') {
					var left = Math.min(Math.max(-startW + 80, startL + ev.clientX - startX), vw - 80);
					var top = Math.min(Math.max(0, startT + ev.clientY - startY), vh - 42);
					el.style.left = left + 'px';
					el.style.top = top + 'px';
					return;
				}

				/* absolute sizes from the pinned top/left corner — no drift, and
				   the result never depends on the previous size */
				if (mode !== 'b') {
					var w = ev.clientX - startL;
					w = Math.max(MIN_W, Math.min(vw - startL - 10, w));
					el.style.width = w + 'px';
				}
				if (mode !== 'r') {
					var h = ev.clientY - startT;
					h = Math.max(MIN_H, Math.min(vh - startT - 10, h));
					el.style.height = h + 'px';
				}
			}

			function onUp() {
				window.removeEventListener('mousemove', onMove, true);
				window.removeEventListener('mouseup', onUp, true);
				card[0].__eaiDragEnd = null;
				root[0].style.pointerEvents = maskEvents;
				if (mode !== 'move') {
					try {
						if (opts.onResize) opts.onResize(card[0].offsetWidth, card[0].offsetHeight);
					} catch (err) { /* ignore */ }
				}
			}

			window.addEventListener('mousemove', onMove, true);
			window.addEventListener('mouseup', onUp, true);
			card[0].__eaiDragEnd = onUp;
		}

		head.on('mousedown', function (e) {
			if ($(e.target).is('.eai-window-x')) return;
			beginDrag('move', e);
		});

		if (opts.resizable !== false) {
			[
				['r', 'position:absolute;top:0;right:0;width:7px;height:100%;cursor:ew-resize;z-index:20'],
				['b', 'position:absolute;left:0;bottom:0;height:8px;width:100%;cursor:ns-resize;z-index:20'],
				['both', 'position:absolute;right:0;bottom:0;width:18px;height:18px;cursor:nwse-resize;z-index:21;' +
					'background:linear-gradient(135deg,transparent 50%,#c9d4e4 50%);border-radius:0 0 6px 0']
			].forEach(function (g) {
				var grip = $('<div>').attr('style', g[1]);
				card.append(grip);
				grip.on('mousedown', function (e) { beginDrag(g[0], e); });
			});
		}

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
