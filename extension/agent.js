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
		return (m.content || []).map(function (p) {
			return p.type === 'text' ? (p.text || '') : '';
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
		var maxSteps = Number(opts.maxSteps || cfg.maxSteps || 12);
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
							text: '已经达到工具步数上限。请不要再调用工具，直接基于上面已有的信息给出完整的最终报告。'
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
								text: '请根据上面工具返回的结果，直接用 Markdown 给出最终结论，不要再调用工具。'
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
					if (toolCallsTotal >= 12 && !toolsDisabled && !toolsNudged) {
						toolsNudged = true;
						toolsDisabled = true;
						messages.push({
							role: 'user',
							content: [{
								type: 'text',
								text: '你已收集到足够的信息，请不要再调用工具，直接基于上面的结果给出完整的最终报告。'
							}]
						});
						emit(onEvent, { type: 'note', text: '工具调用较多，改为强制输出结论' });
					}

					/* a tool may have produced a picture — attach it for the next turn */
					if (EAI._pendingImage) {
						var img = EAI._pendingImage;
						EAI._pendingImage = null;
						messages.push({
							role: 'user',
							content: [
								{ type: 'text', text: 'Here is the captured picture of the document:' },
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
	 * The pill buttons of the panel. Each one only *fills the input box* with
	 * the matching prompt — the user decides when to send it.
	 */
	AG.presets = function () {
		var kind = EAI.eda.docKind();
		var list = [];

		if (kind === 'sch' || kind === 'schlib' || !kind) {
			list.push({
				id: 'sch-review', label: '原理图审查', icon: '📐', report: true,
				prompt: '请对当前原理图做一次完整的工程审查。\n\n' +
					'步骤建议：\n' +
					'1. 先用 get_document_info 和 get_components 了解设计规模；\n' +
					'2. 用 get_netlist 拿到全部网络，重点检查：悬空引脚、只有一个引脚的网络、' +
					'电源/地网络是否完整、去耦电容是否缺失、复位/上拉/下拉电阻是否合理、' +
					'总线与网络标签命名冲突；\n' +
					'3. 用 get_bom 检查封装与数值缺失、重复的位号。\n\n' +
					'最后输出一份中文评审报告：先给结论（可以打样 / 需修改），再按「严重 / 一般 / 建议」分级列出问题，' +
					'每条都要写清涉及的位号（如 R12、U1）和修改建议。'
			});
			list.push({
				id: 'sch-bom', label: 'BOM 分析', icon: '📦', report: true,
				prompt: '请分析当前工程的 BOM：\n' +
					'1. 用 get_bom 获取物料清单；\n' +
					'2. 指出缺值、缺封装、封装与数值明显不匹配的元件；\n' +
					'3. 找出可以合并的重复物料；\n' +
					'4. 给出采购与贴片（SMT）方面的建议。\n\n' +
					'用中文输出，表格呈现 BOM，并单独列出需要人工确认的位号。'
			});
			list.push({
				id: 'sch-gen', label: 'AI 生成原理图', icon: '✨',
				prompt: '请按下面的需求帮我绘制原理图。\n\n需求：（请在这里描述你的电路，例如：\n' +
					'“STM32F103 最小系统，8MHz 晶振，SWD 调试口，3.3V LDO 供电，两个去耦电容”）\n\n' +
					'请先规划好位号、数值和坐标，然后调用 place_part / create_wire / create_net_label 把电路画到画布上；' +
					'坐标单位 1 = 10 mil，建议栅格 10 的整数倍，器件之间留出 40 以上间距。完成后简要说明你画了什么。'
			});
			list.push({
				id: 'sch-symbol', label: '图片识别符号', icon: '🧩',
				prompt: '我会附上一张器件符号的图片，请识别它的形状与引脚，然后用 create_symbol 生成符号。\n\n' +
					'要求：引脚编号、名称、电气类型尽量还原；引脚方向用 dx / dy 表示（左侧引脚 dx 为负）。'
			});
		}

		if (kind === 'pcb' || !kind) {
			list.push({
				id: 'pcb-review', label: 'PCB 审查', icon: '🔧', report: true,
				prompt: '请对当前 PCB 做一次完整的布局布线评审。\n\n' +
					'步骤建议：\n' +
					'1. 用 get_pcb_info 获取板框尺寸、器件位置、网络；\n' +
					'2. 用 capture_image 让我看到实际布局；\n' +
					'3. 从这些角度审查：器件布局是否合理（接口/晶振/去耦电容位置、' +
					'电源回路面积）、走线宽度与载流、过孔数量、参考地平面完整性、' +
					'丝印可读性、板边间距与拼板工艺。\n\n' +
					'输出中文评审报告，按「严重 / 一般 / 建议」分级，并尽量指出具体位号。'
			});
			list.push({
				id: 'pcb-image', label: '截图评审', icon: '🖼', report: true,
				prompt: '请用 capture_image 截取当前画布，然后从可读性、布局、布线和工艺角度给出评审意见。'
			});
		}

		list.push({
			id: 'free', label: '自由提问', icon: '💬',
			prompt: ''
		});

		return list;
	};
})();
