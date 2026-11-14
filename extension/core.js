/* =====================================================================
 * EasyEDA Std extension — "AI Assistant"
 * core.js — namespace, utilities, configuration store, extension identity
 *
 * Every file of a Std extension is evaluated as
 *     function (api, $, Locale) { <file contents> }
 * in the top window of the editor, so all state has to live on
 * window.EAI to be shared between the files.
 * ===================================================================== */
(function () {
	'use strict';

	var EAI = (window.EAI = window.EAI || {});

	EAI.ver = '1.0.0';
	EAI.L = typeof Locale !== 'undefined' ? Locale : null;
	EAI.jq = typeof $ !== 'undefined' ? $ : null;
	EAI.api = typeof api !== 'undefined' ? api : null;

	/* ----------------------------------------------------------- utils -- */

	var U = (EAI.util = {});

	/** Localised string with a fallback to the literal default. */
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

	/** Deep-ish clone for plain JSON data. */
	U.clone = function (o) {
		try { return JSON.parse(JSON.stringify(o)); }
		catch (e) { return o; }
	};

	U.sleep = function (ms) {
		return new Promise(function (r) { setTimeout(r, ms); });
	};

	/** Pretty print with a stable, human friendly key order. */
	U.fmt = function (obj) {
		try { return JSON.stringify(obj, null, 2); }
		catch (e) { return String(obj); }
	};

	/** Truncate long strings so that prompts stay small. */
	U.truncate = function (s, max) {
		s = String(s == null ? '' : s);
		return s.length > max ? s.slice(0, max) + '\n…(truncated)' : s;
	};

	U.isSch = function (t) { return t === 'sch'; };
	U.isPcb = function (t) { return t === 'pcb'; };

	/* ------------------------------------------------------------ log --- */

	var logLines = [];
	(EAI.log = function (msg, level) {
		var line = '[' + new Date().toLocaleTimeString() + '] ' +
			(level || 'info') + ': ' + msg;
		logLines.push(line);
		if (logLines.length > 500) logLines.shift();
		try { (level === 'error' ? console.error : console.log)('[EAI] ' + msg); }
		catch (e) { /* ignore */ }
		try {
			if (EAI.ui && EAI.ui.appendLog) EAI.ui.appendLog(line, level);
		} catch (e) { /* ignore */ }
		return line;
	});
	EAI.logLines = logLines;

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
	 * A Std extension does not receive its own id from the loader — the id is
	 * chosen by the user when the extension is installed.  The only reliable
	 * way to learn it at runtime is to register a throw-away command and see
	 * which instance picks it up.
	 */
	EAI.discoverExtId = function () {
		if (EAI.extId) return EAI.extId;

		var marker = '__eai_id_probe__';
		try {
			var probe = {};
			probe[marker] = function () { /* noop */ };
			EAI.api('createCommand', probe);
		} catch (e) { /* fall through to the heuristics below */ }

		var insts = (window.easyeda && window.easyeda.extension &&
			window.easyeda.extension.instances) || {};
		var id = null, k, inst;

		for (k in insts) {
			if (!Object.prototype.hasOwnProperty.call(insts, k)) continue;
			inst = insts[k];
			if (inst && inst.commands &&
				Object.prototype.hasOwnProperty.call(inst.commands, marker)) {
				id = k;
				break;
			}
		}

		if (!id) {
			/* second chance: find the instance that loads our own scripts */
			for (k in insts) {
				if (!Object.prototype.hasOwnProperty.call(insts, k)) continue;
				inst = insts[k];
				var sc = inst && inst.manifest && inst.manifest.scripts;
				if (sc && Object.prototype.toString.call(sc) === '[object Array]' &&
					sc.indexOf('core.js') >= 0) { id = k; break; }
			}
		}

		if (id) {
			try { delete insts[id].commands[marker]; } catch (e) { /* ignore */ }
		}
		EAI.extId = id || 'eai';
		EAI.log('extension id = ' + EAI.extId +
			(id ? '' : ' (probe failed, using fallback)'));
		return EAI.extId;
	};

	/** Fully qualified command name understood by the Std command bus. */
	EAI.cmd = function (name) {
		return 'extension-' + EAI.discoverExtId() + '-' + name;
	};

	/* ------------------------------------------------------ config store -- */

	var CFG_STORE_KEY = 'config';        /* key inside extensionConfig[extId] */
	var CFG_LOCAL_KEY = 'eai.config.v1'; /* localStorage mirror           */

	EAI.cfgDefaults = {
		provider: 'openai',   /* 'openai' | 'anthropic' */
		baseUrl: '',
		apiKey: '',
		model: '',
		temperature: 0.2,
		maxTokens: 4096,
		language: 'zh',       /* 'zh' | 'en' — language of the AI answers */
		timeout: 180,         /* seconds */
		extraHeaders: ''
	};

	EAI.cfg = {
		load: function () {
			var raw = null, c = null;

			try {
				raw = window.localStorage.getItem(CFG_LOCAL_KEY);
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
						c[key] !== undefined && c[key] !== null) {
						out[key] = c[key];
					}
				}
			}
			return out;
		},

		save: function (cfg) {
			var payload = {};
			try { window.localStorage.setItem(CFG_LOCAL_KEY, JSON.stringify(cfg)); }
			catch (e) { /* ignore */ }
			try {
				var id = EAI.discoverExtId();
				payload[id] = {};
				payload[id][CFG_STORE_KEY] = JSON.stringify(cfg);
				EAI.api('saveConfig', payload);
			} catch (e) { /* ignore */ }
			return cfg;
		},

		/** Current configuration (read-through cache). */
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

		/** True when the configuration is complete enough to talk to a model. */
		ready: function () {
			var c = EAI.cfg.current();
			return !!(c.apiKey && c.baseUrl && c.model);
		}
	};

	/* ----------------------------------------------------------- dialogs -- */

	/** Small helper that creates a jQuery-UI dialog through the Std API. */
	EAI.dialog = function (opts) {
		var dlg = EAI.api('createDialog', opts);
		return dlg;
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
})();
