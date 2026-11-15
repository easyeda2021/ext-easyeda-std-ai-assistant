/* =====================================================================
 * EasyEDA Std extension — "AI Assistant" / AI 助手
 * agent.js — the agent loop
 *
 *   user message
 *      ↓
 *   model  ──tool_call──►  tools.js  ──result──►  model
 *      ↓                                            │
 *   final answer  ◄─────────────────────────────────┘
 *
 * The loop stops when the model answers without calling a tool, when the
 * step budget is exhausted, or when the user aborts.
 * ===================================================================== */
(function () {
	'use strict';

	var EAI = (window.EAI = window.EAI || {});
	var AG = (EAI.agent = {});

	AG.abort = false;

	function emit(onEvent, ev) {
		try { if (onEvent) onEvent(ev); } catch (e) { /* ignore */ }
	}

	function textOf(m) {
		if (typeof m.content === 'string') return m.content;
		return (m.content || []).map(function (p) {
			return p && p.type === 'text' ? (p.text || '') : '';
		}).join('');
	}

	/**
	 * Runs the agent loop.
	 *
	 * @param {Object} opts
	 *   messages  internal message list (system + history + the new user turn)
	 *   onEvent   (ev) => void, ev.type ∈ step | text | tool | tool_result | done | error
	 *   maxSteps  hard cap, default from the configuration
	 * @returns {Promise<{text:string, steps:number, messages:Array}>}
	 */
	AG.run = function (opts) {
		opts = opts || {};
		AG.abort = false;

		var cfg = EAI.cfg.current();
		var messages = (opts.messages || []).slice();
		var onEvent = opts.onEvent;
		var maxSteps = Number(opts.maxSteps || cfg.maxSteps || 40);
		var maxCalls = Number(opts.maxCalls || cfg.maxToolCalls || 80);
		var steps = 0;
		var toolsDisabled = false;
		var nudged = false;      /* asked once for a final answer without tools */
		var usedTools = false;
		var toolCallsTotal = 0;  /* guards against one-call-per-net exploration */
		var toolsNudged = false;

		function step() {
			if (AG.abort) return Promise.resolve({ text: '', steps: steps, aborted: true, messages: messages });
			if (steps >= maxSteps) {
				/*
				 * Never end with an empty answer: run one last pass without
				 * tools so the model has to write the conclusion.
				 */
				if (!toolsDisabled) {
					toolsDisabled = true;
					messages.push({
						role: 'user',
						content: [{
							type: 'text',
							text: EAI.prompts.nudges.stepLimit
						}]
					});
					emit(onEvent, { type: 'note', text: '达到步数上限，改为强制输出结论' });
				} else {
					return Promise.resolve({
						text: '', steps: steps, limitReached: true, messages: messages
					});
				}
			}
			steps++;

			var tools = toolsDisabled ? [] : EAI.tools.available();
			emit(onEvent, { type: 'step', step: steps, toolCount: tools.length });

			if (toolsDisabled) {
				/* final pass: plain chat, no tools */
				return EAI.llm.chat(cfg, messages, {}).then(function (text) {
					emit(onEvent, { type: 'text', text: text });
					return { text: text, steps: steps, messages: messages };
				});
			}

			return EAI.llm.chatTools(cfg, messages, tools).then(function (res) {
				if (res.text) emit(onEvent, { type: 'text', text: res.text });

				if (!res.toolCalls || !res.toolCalls.length) {
					/*
					 * The model sometimes stops right after the tool results and
					 * returns nothing at all.  Nudge it once instead of handing
					 * the user an empty report.
					 */
					if (!res.text && usedTools && !nudged && steps < maxSteps) {
						nudged = true;
						messages.push({
							role: 'user',
							content: [{
								type: 'text',
								text: EAI.prompts.nudges.emptyAnswer
							}]
						});
						return step();
					}
					return { text: res.text, steps: steps, messages: messages };
				}

				usedTools = true;

				/* record the assistant turn (text + the tool calls it asked for) */
				messages.push({
					role: 'assistant',
					content: res.text ? [{ type: 'text', text: res.text }] : [],
					toolCalls: res.toolCalls
				});

				var chain = Promise.resolve();
				res.toolCalls.forEach(function (call) {
					chain = chain.then(function () {
						if (AG.abort) return null;
						emit(onEvent, { type: 'tool', name: call.name, args: call.args });
						return EAI.tools.run(call.name, call.args).then(function (result) {
							messages.push({
								role: 'tool',
								toolCallId: call.id,
								name: call.name,
								content: result
							});
							emit(onEvent, {
								type: 'tool_result',
								name: call.name,
								result: result
							});
							return result;
						});
					});
				});

				return chain.then(function () {
					toolCallsTotal += res.toolCalls.length;
					/*
					 * Models love to drill into one net after another.  After a
					 * dozen tool calls stop the exploration and force a report.
					 */
					if (toolCallsTotal >= maxCalls && !toolsDisabled && !toolsNudged) {
						toolsNudged = true;
						toolsDisabled = true;
						messages.push({
							role: 'user',
							content: [{
								type: 'text',
								text: EAI.prompts.nudges.converge
							}]
						});
						emit(onEvent, { type: 'note', text: '工具调用已达上限（' + maxCalls + '），改为强制输出结论' });
					}

					/* a tool may have produced a picture — attach it for the next turn */
					if (EAI._pendingImage) {
						var img = EAI._pendingImage;
						EAI._pendingImage = null;
						messages.push({
							role: 'user',
							content: [
								{ type: 'text', text: EAI.prompts.nudges.captured },
								{ type: 'image', mediaType: img.mediaType, data: img.base64 }
							]
						});
						emit(onEvent, { type: 'image', width: img.width, height: img.height });
					}
					return step();
				});
			}).catch(function (err) {
				var msg = err && err.message ? err.message : String(err);

				/* some gateways reject the "tools" field altogether */
				if (!toolsDisabled && /tool|function/i.test(msg) &&
					err && (err.status === 400 || err.status === 404 || err.status === 422)) {
					EAI.log('provider rejected tools, retrying without them: ' + msg, 'warn');
					toolsDisabled = true;
					steps = Math.max(0, steps - 1);
					return step();
				}
				throw err;
			});
		}

		return step().then(function (r) {
			emit(onEvent, { type: 'done', steps: r.steps, aborted: !!r.aborted });
			return r;
		});
	};

	AG.stop = function () { AG.abort = true; };

	/* --------------------------------------------------------- presets --- */

	/**
	 * Panel pills.  A preset only carries the short, user-facing `prompt`
	 * that is filled into the input box — the procedure for each task lives
	 * in prompts.js (`EAI.prompts.tasks[id]`) and is appended to the system
	 * prompt at run time.
	 *
	 * `report: true` marks review / analysis tasks that also produce a card.
	 */
	AG.presets = function () {
		var kind = EAI.eda.docKind();
		var list = [];

		if (kind === 'sch' || kind === 'schlib' || !kind) {
			list.push({
				id: 'sch-review', label: '原理图审查', icon: '📐', report: true,
				prompt: '请对当前原理图做一次完整的工程审查，并输出评审报告。'
			});
			list.push({
				id: 'sch-bom', label: 'BOM 分析', icon: '📦', report: true,
				prompt: '请分析当前工程的 BOM，并输出评审报告。'
			});
			list.push({
				id: 'sch-standardize', label: '器件标准化', icon: '', report: true,
				prompt: '请帮我把这份原理图的元件属性补全（封装 / 型号 / 供应商 / 料号）。'
			});
			list.push({
				id: 'sch-gen', label: '生成原理图', icon: '✨',
				prompt: '请按下面的需求帮我绘制原理图。\n\n需求：\n' +
					'（在这里描述你的电路，例如：“STM32F103 最小系统，8MHz 晶振，' +
					'SWD 调试口，3.3V LDO 供电，两个去耦电容”）'
			});
			list.push({
				id: 'sch-symbol', label: '识别符号', icon: '🧩',
				prompt: '请根据本条消息附带的图片生成一个符号。'
			});
		}

		if (kind === 'pcb' || !kind) {
			list.push({
				id: 'pcb-review', label: 'PCB 审查', icon: '🔧', report: true,
				prompt: '请对当前 PCB 做一次完整的布局布线评审，并输出评审报告。'
			});
			list.push({
				id: 'pcb-image', label: '截图评审', icon: '🖼', report: true,
				prompt: '请截图评审当前画布，并输出评审报告。'
			});
		}

		return list;
	};
})();
