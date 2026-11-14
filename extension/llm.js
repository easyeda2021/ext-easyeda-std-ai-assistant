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
			/* the other protocol's path was pasted — fix it up */
			if (/\/chat\/completions$/i.test(base)) {
				return base.replace(/\/chat\/completions$/i, '/messages');
			}
			if (/\/v1$/i.test(base)) return base + '/messages';
			if (!pathOf(base)) return base + '/v1/messages';
			return base + '/messages';
		}
		if (/\/chat\/completions$/i.test(base)) return base;
		if (/\/messages$/i.test(base)) {
			return base.replace(/\/messages$/i, '/chat/completions');
		}
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
		var url = L.endpoint(cfg);
		return L.chat(cfg, msg, {}).then(function (t) {
			return 'ok: ' + String(t).slice(0, 120) + '  (' + url + ')';
		}).catch(function (e) {
			var hint = '';
			if (e && e.status === 404) {
				hint = '  → 接口地址可能不对：Anthropic 应为 <base>/v1/messages，' +
					'OpenAI 应为 <base>/v1/chat/completions。当前实际请求：' + url;
			}
			var err = new Error((e && e.message ? e.message : String(e)) + hint);
			err.status = e && e.status;
			throw err;
		});
	};

	/* =====================================================================
	 * Tool calling (used by the agent loop)
	 *
	 * Internal message shapes, extended for tools:
	 *   { role:'assistant', content:[{type:'text'}], toolCalls:[{id,name,args}] }
	 *   { role:'tool', toolCallId, name, content:'<string>' }
	 * ===================================================================== */

	function toOpenAITools(messages) {
		var s = splitSystem(messages), out = [];
		if (s.system) out.push({ role: 'system', content: s.system });

		s.messages.forEach(function (m) {
			if (m.role === 'tool') {
				out.push({
					role: 'tool',
					tool_call_id: m.toolCallId,
					content: typeof m.content === 'string' ? m.content : U_str(m.content)
				});
				return;
			}

			var parts = (m.content || []).map(function (p) {
				if (p.type === 'image') {
					return {
						type: 'image_url',
						image_url: { url: 'data:' + (p.mediaType || 'image/png') + ';base64,' + p.data }
					};
				}
				return { type: 'text', text: p.text || '' };
			});

			var msg = { role: m.role === 'assistant' ? 'assistant' : 'user' };

			if (parts.length && parts.every(function (p) { return p.type === 'text'; })) {
				msg.content = parts.map(function (p) { return p.text; }).join('\n');
			} else if (parts.length) {
				msg.content = parts;
			} else {
				msg.content = '';
			}

			if (m.toolCalls && m.toolCalls.length) {
				msg.tool_calls = m.toolCalls.map(function (t) {
					return {
						id: t.id,
						type: 'function',
						function: {
							name: t.name,
							arguments: typeof t.args === 'string' ? t.args : JSON.stringify(t.args || {})
						}
					};
				});
			}
			out.push(msg);
		});
		return out;
	}

	function toAnthropicTools(messages) {
		var s = splitSystem(messages), out = [];

		s.messages.forEach(function (m) {
			if (m.role === 'tool') {
				out.push({
					role: 'user',
					content: [{
						type: 'tool_result',
						tool_use_id: m.toolCallId,
						content: typeof m.content === 'string' ? m.content : U_str(m.content)
					}]
				});
				return;
			}

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

			if (m.toolCalls && m.toolCalls.length) {
				m.toolCalls.forEach(function (t) {
					parts.push({
						type: 'tool_use',
						id: t.id,
						name: t.name,
						input: (typeof t.args === 'string') ? safeJson(t.args) : (t.args || {})
					});
				});
			}
			if (!parts.length) return;

			/* Anthropic requires alternating roles; merge consecutive ones */
			var last = out[out.length - 1];
			if (last && last.role === m.role) {
				last.content = last.content.concat(parts);
			} else {
				out.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: parts });
			}
		});
		return out;
	}

	function U_str(v) {
		try { return typeof v === 'string' ? v : JSON.stringify(v); }
		catch (e) { return String(v); }
	}

	function safeJson(s) {
		try { return JSON.parse(s); }
		catch (e) { return { __raw: s }; }
	}

	/**
	 * One non-streaming round trip with tools.
	 * @returns {Promise<{text:string, toolCalls:Array, finish:string}>}
	 */
	L.chatTools = function (cfg, messages, tools, opts) {
		opts = opts || {};
		var provider = cfg.provider === 'anthropic' ? 'anthropic' : 'openai';
		var headers = { 'Content-Type': 'application/json' };
		var extra = parseExtraHeaders(cfg);
		for (var k in extra) {
			if (Object.prototype.hasOwnProperty.call(extra, k)) headers[k] = extra[k];
		}

		var body;
		if (provider === 'anthropic') {
			headers['x-api-key'] = cfg.apiKey;
			headers['anthropic-version'] = headers['anthropic-version'] || '2023-06-01';
			body = {
				model: cfg.model,
				max_tokens: Number(cfg.maxTokens) || 8192,
				messages: toAnthropicTools(messages),
				tools: (tools || []).map(function (t) {
					return {
						name: t.name,
						description: t.description,
						input_schema: t.parameters || { type: 'object', properties: {} }
					};
				})
			};
			var sys = splitSystem(messages).system;
			if (sys) body.system = sys;
			if (cfg.temperature !== undefined && cfg.temperature !== null && cfg.temperature !== '') {
				body.temperature = Number(cfg.temperature);
			}
		} else {
			headers['Authorization'] = 'Bearer ' + cfg.apiKey;
			body = {
				model: cfg.model,
				messages: toOpenAITools(messages),
				tools: (tools || []).map(function (t) {
					return {
						type: 'function',
						function: {
							name: t.name,
							description: t.description,
							parameters: t.parameters || { type: 'object', properties: {} }
						}
					};
				})
			};
			if (cfg.temperature !== undefined && cfg.temperature !== null && cfg.temperature !== '') {
				body.temperature = Number(cfg.temperature);
			}
			if (cfg.__useMaxCompletionTokens) {
				body.max_completion_tokens = Number(cfg.maxTokens) || 8192;
			} else if (cfg.maxTokens) {
				body.max_tokens = Number(cfg.maxTokens);
			}
		}

		var url = L.endpoint(cfg);
		var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
		var timeout = (Number(cfg.timeout) || 300) * 1000;
		var timer = controller ? setTimeout(function () { controller.abort(); }, timeout) : null;

		function clear() { if (timer) clearTimeout(timer); }

		return fetch(url, {
			method: 'POST',
			headers: headers,
			body: JSON.stringify(body),
			signal: controller ? controller.signal : undefined
		}).then(function (resp) {
			return resp.text().then(function (t) {
				if (!resp.ok) {
					var msg = 'HTTP ' + resp.status + ' ' + resp.statusText;
					try {
						var j = JSON.parse(t);
						if (j.error) msg += ' — ' + (j.error.message || j.error.type || '');
					} catch (e) {
						msg += ' — ' + t.slice(0, 300);
					}
					var err = new Error(msg);
					err.status = resp.status;
					throw err;
				}
				var obj;
				try { obj = JSON.parse(t); }
				catch (e) { throw new Error('Invalid JSON response: ' + t.slice(0, 300)); }

				/* some gateways answer 200 with an error payload */
				if (obj && (obj.error || obj.type === 'error' || obj.success === false)) {
					var em = obj.error
						? (obj.error.message || obj.error.type || JSON.stringify(obj.error))
						: (obj.message || obj.msg || 'unknown error');
					throw new Error('API error: ' + String(em).slice(0, 300));
				}

				var out = { text: '', toolCalls: [], finish: '' };

				if (provider === 'anthropic') {
					(obj.content || []).forEach(function (c) {
						if (!c) return;
						if (c.type === 'text') out.text += c.text || '';
						else if (c.type === 'tool_use') {
							out.toolCalls.push({ id: c.id, name: c.name, args: c.input || {} });
						}
					});
					out.finish = obj.stop_reason || '';
				} else {
					var ch = (obj.choices && obj.choices[0]) || {};
					var m = ch.message || {};
					out.text = typeof m.content === 'string' ? m.content : '';
					if (Array.isArray(m.content)) {
						m.content.forEach(function (p) {
							if (p && p.type === 'text') out.text += p.text || '';
						});
					}
					(m.tool_calls || []).forEach(function (tc) {
						var fn = tc.function || {};
						out.toolCalls.push({
							id: tc.id,
							name: fn.name,
							args: safeJson(fn.arguments || '{}')
						});
					});
					out.finish = ch.finish_reason || '';
				}
				return out;
			});
		}).then(function (r) {
			clear();
			return r;
		}).catch(function (err) {
			clear();
			if (err && err.name === 'AbortError') {
				throw new Error('Request aborted / timed out after ' + Math.round(timeout / 1000) + 's');
			}
			if (err && err instanceof TypeError) {
				var e2 = new Error('Network request failed (possibly blocked by CORS). Original: ' + err.message);
				e2.isCors = true;
				throw e2;
			}
			throw err;
		});
	};
})();
