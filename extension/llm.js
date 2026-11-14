/* =====================================================================
 * EasyEDA Std extension — "AI Assistant"
 * llm.js — OpenAI / Anthropic protocol clients (streaming, vision ready)
 *
 * Internal message shape (provider agnostic):
 *   { role: 'system' | 'user' | 'assistant',
 *     content: [ { type: 'text',  text: '...' },
 *                { type: 'image', mediaType: 'image/png', data: '<base64>' } ] }
 * ===================================================================== */
(function () {
	'use strict';

	var EAI = (window.EAI = window.EAI || {});
	var L = (EAI.llm = {});

	var DEFAULT_BASE = {
		openai: 'https://api.openai.com/v1',
		anthropic: 'https://api.anthropic.com/v1'
	};

	L.defaultBase = function (provider) {
		return DEFAULT_BASE[provider] || DEFAULT_BASE.openai;
	};

	function trimSlash(s) {
		return String(s || '').replace(/\/+$/, '');
	}

	function pathOf(url) {
		var m = String(url || '').match(/^https?:\/\/[^/?#]+([^?#]*)/i);
		return m ? m[1] : '';
	}

	/**
	 * Turns the user supplied base url into a concrete chat endpoint.
	 * Handles the common shapes:  https://host  |  https://host/v1  |
	 * https://host/v1/chat/completions  |  https://host/api
	 */
	L.endpoint = function (cfg) {
		var provider = cfg.provider === 'anthropic' ? 'anthropic' : 'openai';
		var base = trimSlash(cfg.baseUrl) || L.defaultBase(provider);

		if (provider === 'anthropic') {
			if (/\/messages$/i.test(base)) return base;
			if (/\/v1$/i.test(base)) return base + '/messages';
			if (!pathOf(base)) return base + '/v1/messages';
			return base + '/messages';
		}
		if (/\/chat\/completions$/i.test(base)) return base;
		if (/\/v1$/i.test(base)) return base + '/chat/completions';
		if (!pathOf(base)) return base + '/v1/chat/completions';
		return base + '/chat/completions';
	};

	function parseExtraHeaders(cfg) {
		var out = {};
		var raw = String(cfg.extraHeaders || '').trim();
		if (!raw) return out;
		raw.split(/[\n;]+/).forEach(function (line) {
			var i = line.indexOf(':');
			if (i > 0) {
				var k = line.slice(0, i).trim();
				var v = line.slice(i + 1).trim();
				if (k) out[k] = v;
			}
		});
		return out;
	}

	/* ------------------------------------------------------ message shaping */

	function splitSystem(messages) {
		var sys = [], rest = [], i, m, txt;
		for (i = 0; i < (messages || []).length; i++) {
			m = messages[i];
			if (m.role === 'system') {
				txt = (m.content || []).map(function (p) {
					return p.type === 'text' ? (p.text || '') : '';
				}).join('\n');
				sys.push(txt);
			} else {
				rest.push(m);
			}
		}
		return { system: sys.join('\n\n'), messages: rest };
	}

	function toOpenAI(messages) {
		var s = splitSystem(messages), out = [];
		if (s.system) out.push({ role: 'system', content: s.system });
		s.messages.forEach(function (m) {
			var parts = (m.content || []).map(function (p) {
				if (p.type === 'image') {
					return {
						type: 'image_url',
						image_url: { url: 'data:' + (p.mediaType || 'image/png') + ';base64,' + p.data }
					};
				}
				return { type: 'text', text: p.text || '' };
			});
			if (!parts.length) return;
			/* plain text messages are cheaper and better understood */
			if (parts.every(function (p) { return p.type === 'text'; })) {
				out.push({
					role: m.role === 'assistant' ? 'assistant' : 'user',
					content: parts.map(function (p) { return p.text; }).join('\n')
				});
			} else {
				out.push({
					role: m.role === 'assistant' ? 'assistant' : 'user',
					content: parts
				});
			}
		});
		return out;
	}

	function toAnthropic(messages) {
		var s = splitSystem(messages), out = [];
		s.messages.forEach(function (m) {
			var parts = (m.content || []).map(function (p) {
				if (p.type === 'image') {
					return {
						type: 'image',
						source: {
							type: 'base64',
							media_type: p.mediaType || 'image/png',
							data: p.data
						}
					};
				}
				return { type: 'text', text: p.text || '' };
			});
			if (!parts.length) return;
			out.push({
				role: m.role === 'assistant' ? 'assistant' : 'user',
				content: parts
			});
		});
		return out;
	}

	/* ------------------------------------------------------------- request */

	function buildRequest(cfg, messages) {
		var provider = cfg.provider === 'anthropic' ? 'anthropic' : 'openai';
		var headers = { 'Content-Type': 'application/json' };
		var extra = parseExtraHeaders(cfg);
		var k;

		for (k in extra) {
			if (Object.prototype.hasOwnProperty.call(extra, k)) headers[k] = extra[k];
		}

		var body;

		if (provider === 'anthropic') {
			headers['x-api-key'] = cfg.apiKey;
			headers['anthropic-version'] = headers['anthropic-version'] || '2023-06-01';
			body = {
				model: cfg.model,
				max_tokens: Number(cfg.maxTokens) || 4096,
				messages: toAnthropic(messages),
				stream: true
			};
			if (cfg.temperature !== undefined && cfg.temperature !== null &&
				cfg.temperature !== '') {
				body.temperature = Number(cfg.temperature);
			}
			var sys = splitSystem(messages).system;
			if (sys) body.system = sys;
		} else {
			headers['Authorization'] = 'Bearer ' + cfg.apiKey;
			body = {
				model: cfg.model,
				messages: toOpenAI(messages),
				stream: true
			};
			if (cfg.temperature !== undefined && cfg.temperature !== null &&
				cfg.temperature !== '') {
				body.temperature = Number(cfg.temperature);
			}
			if (cfg.__useMaxCompletionTokens) {
				body.max_completion_tokens = Number(cfg.maxTokens) || 4096;
			} else if (cfg.maxTokens) {
				body.max_tokens = Number(cfg.maxTokens);
			}
		}

		return { url: L.endpoint(cfg), headers: headers, body: body, provider: provider };
	}

	L.buildRequest = buildRequest;

	/* ----------------------------------------------------------- streaming */

	function readStream(resp, onDelta, provider) {
		if (!resp.body || !resp.body.getReader) {
			return Promise.reject(new Error('Streaming is not supported by this browser.'));
		}
		var reader = resp.body.getReader();
		var decoder = new TextDecoder('utf-8');
		var buffer = '';
		var text = '';
		var done = false;

		function handleChunk(raw) {
			var lines = raw.split(/\r?\n/);
			for (var i = 0; i < lines.length; i++) {
				var line = lines[i].trim();
				if (!line || line.indexOf('data:') !== 0) continue;
				var payload = line.slice(5).trim();
				if (!payload || payload === '[DONE]') continue;
				var obj;
				try { obj = JSON.parse(payload); }
				catch (e) { continue; }

				var delta = '';
				if (provider === 'anthropic') {
					if (obj.type === 'content_block_delta' && obj.delta &&
						typeof obj.delta.text === 'string') {
						delta = obj.delta.text;
					}
				} else {
					var ch = obj.choices && obj.choices[0];
					if (ch && ch.delta && typeof ch.delta.content === 'string') {
						delta = ch.delta.content;
					}
				}
				if (delta) {
					text += delta;
					if (onDelta) onDelta(delta, text);
				}
			}
		}

		function pump() {
			return reader.read().then(function (r) {
				if (r.done) {
					if (buffer.trim()) handleChunk(buffer);
					done = true;
					return text;
				}
				buffer += decoder.decode(r.value, { stream: true });
				var idx;
				while ((idx = buffer.indexOf('\n\n')) >= 0) {
					var chunk = buffer.slice(0, idx);
					buffer = buffer.slice(idx + 2);
					handleChunk(chunk);
				}
				return pump();
			});
		}
		return pump().then(function () { return text; });
	}

	function readJson(resp) {
		return resp.text().then(function (t) {
			var obj;
			try { obj = JSON.parse(t); }
			catch (e) { throw new Error('Invalid response: ' + t.slice(0, 400)); }
			var provider = resp.__provider || 'openai';
			var out = '';
			if (provider === 'anthropic') {
				(obj.content || []).forEach(function (c) {
					if (c && c.type === 'text') out += c.text || '';
				});
			} else {
				var ch = obj.choices && obj.choices[0];
				if (ch && ch.message) out = ch.message.content || '';
			}
			return out;
		});
	}

	/**
	 * Sends a chat request.
	 * @returns {Promise<string>} the assistant text
	 */
	L.chat = function (cfg, messages, opts) {
		opts = opts || {};
		var attempt = 0;

		function run(useCfg) {
			var req = buildRequest(useCfg || cfg, messages);
			var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
			var timeout = (Number(cfg.timeout) || 180) * 1000;
			var timer = null;

			if (controller) {
				timer = setTimeout(function () { controller.abort(); }, timeout);
				if (opts.signal) {
					opts.signal.addEventListener('abort', function () {
						try { controller.abort(); } catch (e) { /* ignore */ }
					});
				}
			}

			function clear() { if (timer) clearTimeout(timer); }

			return fetch(req.url, {
				method: 'POST',
				headers: req.headers,
				body: JSON.stringify(req.body),
				signal: controller ? controller.signal : undefined
			}).then(function (resp) {
				if (!resp.ok) {
					return resp.text().then(function (t) {
						var msg = 'HTTP ' + resp.status + ' ' + resp.statusText;
						try {
							var j = JSON.parse(t);
							if (j.error) {
								msg += ' — ' + (j.error.message || j.error.type || '');
							} else {
								msg += ' — ' + t.slice(0, 300);
							}
						} catch (e) {
							msg += ' — ' + t.slice(0, 300);
						}
						var err = new Error(msg);
						err.status = resp.status;
						throw err;
					});
				}
				var ct = (resp.headers.get('content-type') || '').toLowerCase();
				if (ct.indexOf('event-stream') >= 0) {
					return readStream(resp, opts.onDelta, req.provider);
				}
				resp.__provider = req.provider;
				return readJson(resp);
			}).then(function (text) {
				clear();
				return text;
			}).catch(function (err) {
				clear();
				if (err && err.name === 'AbortError') {
					throw new Error('Request aborted / timed out after ' +
						Math.round(timeout / 1000) + 's');
				}
				if (err && err instanceof TypeError) {
					var e2 = new Error('Network request failed (possibly blocked by CORS). ' +
						'Original: ' + err.message);
					e2.isCors = true;
					throw e2;
				}
				throw err;
			});
		}

		return run().catch(function (err) {
			/*
			 * Newer OpenAI models renamed "max_tokens" to "max_completion_tokens".
			 * If the server complains about it, switch once and retry.
			 */
			if (attempt === 0 && err && err.status === 400 &&
				/max_tokens|max_completion_tokens/i.test(err.message || '')) {
				attempt++;
				var cfg2 = U_extend({}, cfg);
				delete cfg2.maxTokens;
				cfg2.__useMaxCompletionTokens = true;
				return run(cfg2);
			}
			throw err;
		});
	};

	function U_extend(t) {
		for (var i = 1; i < arguments.length; i++) {
			var src = arguments[i];
			if (!src) continue;
			for (var k in src) {
				if (Object.prototype.hasOwnProperty.call(src, k)) t[k] = src[k];
			}
		}
		return t;
	}

	/** Cheap connectivity / credential probe. */
	L.test = function (cfg) {
		var msg = [{
			role: 'user',
			content: [{ type: 'text', text: 'ping' }]
		}];
		return L.chat(cfg, msg, {}).then(function (t) {
			return 'ok: ' + String(t).slice(0, 120);
		});
	};
})();
