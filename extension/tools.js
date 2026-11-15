/* =====================================================================
 * EasyEDA Std extension — "AI Assistant" / AI 助手
 * tools.js — the tools the language model is allowed to call
 *
 * Every tool is declared with a JSON schema (sent to the model) and an
 * implementation.  The implementations only use the public Std extension
 * API, so they behave exactly like a human clicking in the editor.
 * ===================================================================== */
(function () {
	'use strict';

	var EAI = (window.EAI = window.EAI || {});
	var T = (EAI.tools = {});
	var D = EAI.eda;
	var A = EAI.actions;

	/* ------------------------------------------------------------ helpers -- */

	function ok(v) {
		return typeof v === 'string' ? v : EAI.util.fmt(v, 60000);
	}

	function need(kinds) {
		var k = D.docKind();
		if (!k) return 'No editable document is open.';
		if (kinds && kinds.indexOf(k) < 0) {
			return 'This tool needs a ' + kinds.join(' / ') + ' document, but the active ' +
				'document is "' + (D.docKindLabel()) + '".';
		}
		return null;
	}

	function sheetJson() {
		return D.activeJson();
	}

	/**
	 * One system-library search (POST /api/components/search).
	 * Resolves to a compact, model-friendly text block.
	 */
	function searchOne(q, limit) {
		return fetch('/api/components/search', {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ doctype: [2], wd: q, page: 1 })
		}).then(function (r) {
			return r.text().then(function (t) {
				var obj;
				try { obj = JSON.parse(t); }
				catch (e) { throw new Error('search returned non-JSON: ' + t.slice(0, 120)); }
				if (!obj || obj.success === false) {
					throw new Error((obj && (obj.message || obj.msg)) || 'search failed');
				}
				var res = obj.result || {};
				var items = [];
				if (Array.isArray(res.lists)) items = res.lists;
				else if (res.lists && typeof res.lists === 'object') {
					Object.keys(res.lists).forEach(function (k) {
						if (Array.isArray(res.lists[k])) items = items.concat(res.lists[k]);
					});
				} else if (Array.isArray(res)) {
					items = res;
				}

				if (!items.length) return '（无结果，用 create_symbol 现场生成）';

				var lines = [];
				items.slice(0, limit).forEach(function (it, i) {
					var lcsc = it.lcsc && it.lcsc.number ? it.lcsc.number : '';
					var mfr = (it.extra && (it.extra.Manufacturer || it.extra.manufacturer)) || '';
					var pkg = it.package || it.packageName || '';
					lines.push((i + 1) + '. ' + (it.title || '?') +
						' | 封装 ' + (pkg || '-') +
						' | 厂商 ' + (mfr || '-') +
						' | LCSC ' + (lcsc || '-') +
						' | uuid=' + (it.uuid || '-') +
						' | docType=' + (it.docType || '2'));
				});
				return '共 ' + items.length + ' 个结果（显示前 ' + Math.min(limit, items.length) + ' 个）\n' +
					lines.join('\n');
			});
		}).catch(function (e) {
			return '检索失败：' + (e && e.message ? e.message : e) +
				'（可改用 create_symbol 现场生成）';
		});
	}

	/* ------------------------------------------------------------- schemas -- */

	var P = {
		obj: function (props, required) {
			return {
				type: 'object',
				properties: props || {},
				required: required || [],
				additionalProperties: false
			};
		},
		str: function (desc) { return { type: 'string', description: desc }; },
		num: function (desc) { return { type: 'number', description: desc }; }
	};

	/* ================================================================ read == */

	T.defs = [

		/* ---------------------------------------------------------------- */
		{
			name: 'get_document_info',
			description: 'Describe the document that is currently open in the editor: ' +
				'its kind (schematic / pcb / symbol library), title, size and object counts. ' +
				'Call this first when you are unsure what you are looking at.',
			parameters: P.obj({}),
			run: function () {
				var kind = D.docKind();
				var json = D.activeJson();
				var info = {
					kind: kind,
					kindLabel: D.docKindLabel(),
					title: D.activeTitle(),
					editable: kind === 'sch' || kind === 'pcb' ||
						kind === 'schlib' || kind === 'pcblib'
				};
				if (kind === 'sch') {
					var comps = D.components(json);
					info.componentCount = comps.length;
					info.wireCount = json && json.wire ? Object.keys(json.wire).length : 0;
					info.netLabelCount = json && json.netlabel ? Object.keys(json.netlabel).length : 0;
					info.sheetsInProject = D.projectSchematics().length;
				} else if (kind === 'pcb') {
					var pcb = D.pcbInfo();
					info.footprintCount = pcb.footprints.length;
					info.netCount = pcb.nets.length;
					info.boardSizeMm = pcb.widthMm && pcb.heightMm ?
						(pcb.widthMm + ' x ' + pcb.heightMm) : 'unknown';
					info.trackCount = pcb.trackCount;
				} else if (kind === 'schlib' || kind === 'pcblib') {
					info.pinCount = json && json.pin ? Object.keys(json.pin).length : 0;
				}
				return ok(info);
			}
		},

		/* ---------------------------------------------------------------- */
		{
			name: 'get_components',
			description: 'List the components of the open schematic (designator, name, ' +
				'package, value, pin count) or the footprints of the open PCB ' +
				'(designator, package, position, layer).',
			parameters: P.obj({
				withPins: { type: 'boolean', description: 'Include pin numbers and names.' }
			}),
			run: function (args) {
				var kind = D.docKind();
				if (kind === 'pcb') {
					var pcb = D.pcbInfo();
					return ok(pcb.footprints.map(function (f) {
						return {
							designator: f.designator, name: f.name, package: f.package,
							x: f.x, y: f.y, rotation: f.rotation, layer: f.layer
						};
					}));
				}
				var err = need(['sch', 'schlib']);
				if (err) return err;
				var comps = D.components(sheetJson());
				var CAP = 300;
				return ok(comps.slice(0, CAP).map(function (c) {
					var o = {
						designator: c.designator, name: c.name, package: c.package,
						value: c.value, x: c.x, y: c.y, rotation: c.rotation
					};
					if (args && args.withPins) {
						o.pins = c.pins.map(function (p) { return p.number + ':' + p.name; });
					}
					return o;
				}));
			}
		},

		/* ---------------------------------------------------------------- */
		{
			name: 'get_netlist',
			description:
				'Return the COMPLETE net list of the whole schematic project in one call: ' +
				'every component with its designator, name, package, and for each pin its ' +
				'pin name/number and the net it is connected to. Also flags floating ' +
				'(single-pin) nets, name conflicts and power/ground rails. Use this single ' +
				'result to review the design as a whole — do NOT query net by net.',
			parameters: P.obj({
				maxComponents: P.num('Max components listed (default 150, max 400).')
			}),
			run: function (args) {
				args = args || {};
				var err = need(['sch']);
				if (err) return err;

				var sheets = D.projectSchematics();
				if (!sheets.length) return 'No schematic sheet found in the project.';

				var nl = D.netlist(sheets);

				/* ---- pin -> net lookup ---------------------------------- */
				var pinNet = {};
				nl.nets.forEach(function (n) {
					n.pins.forEach(function (p) {
						var k = p.designator + '|' + p.number;
						pinNet[k] = pinNet[k] ? (pinNet[k] + ' / ' + n.name) : n.name;
					});
				});

				/* ---- every component of every sheet ---------------------- */
				var comps = [];
				sheets.forEach(function (sh) {
					D.components(sh.json).forEach(function (c) { comps.push(c); });
				});
				comps.sort(function (a, b) {
					return String(a.designator).localeCompare(String(b.designator), 'en', { numeric: true });
				});

				var maxComp = Math.min(Number(args.maxComponents) || 150, 400);
				var lines = [];

				/* ---- summary --------------------------------------------- */
				var floatNets = nl.nets.filter(function (n) { return n.pins.length === 1; });
				var conflictNets = nl.nets.filter(function (n) { return n.conflict; });
				var unnamed = nl.nets.filter(function (n) { return n.auto; });

				lines.push('## 概要');
				lines.push('图纸 ' + nl.stats.sheets + ' · 元件 ' + comps.length +
					' · 网络 ' + nl.stats.nets +
					'（命名 ' + (nl.stats.nets - unnamed.length) +
					'，未命名 ' + unnamed.length +
					'，冲突 ' + conflictNets.length + '）· 引脚 ' + nl.stats.pins);
				if (conflictNets.length) {
					lines.push('命名冲突：' + conflictNets.slice(0, 20).map(function (n) {
						return n.name + '[' + n.labels.map(function (l) { return l.name; }).join('/') + ']';
					}).join(', '));
				}
				if (floatNets.length) {
					lines.push('单引脚网络 ' + floatNets.length + ' 个（可能悬空）：' +
						floatNets.slice(0, 40).map(function (n) {
							var p = n.pins[0];
							return n.name + '(' + p.designator + '.' + p.number + ')';
						}).join(', ') + (floatNets.length > 40 ? ' …' : ''));
				}
				lines.push('');

				/* ---- component / pin / net table ------------------------- */
				lines.push('## 元件引脚网络（位号 | 名称 | 封装 | 引脚=网络）');
				if (!comps.length) {
					lines.push('（没有元件）');
				}
				comps.slice(0, maxComp).forEach(function (c) {
					var pins = (c.pins || []).map(function (p) {
						var net = pinNet[c.designator + '|' + p.number] || 'NC';
						var label = p.name ? (p.name + '(' + p.number + ')') : String(p.number);
						return label + '=' + net;
					});
					lines.push('- ' + (c.designator || '?') +
						' | ' + (c.name || '') +
						' | ' + (c.package || '') +
						' | ' + (pins.join(', ') || '无引脚'));
				});
				if (comps.length > maxComp) {
					lines.push('- …还有 ' + (comps.length - maxComp) + ' 个元件未列出');
				}
				lines.push('');

				/* ---- power / ground rails -------------------------------- */
				var POWER = /^(GND|AGND|DGND|PGND|VCC|VDD|VSS|VEE|VBAT|VIN|VBUS|[+\-]?\d+V\d*)$/i;
				var rails = nl.nets.filter(function (n) {
					return POWER.test(String(n.name).replace(/\s/g, ''));
				});
				if (rails.length) {
					lines.push('## 电源与地');
					rails.forEach(function (n) {
						var members = n.pins.map(function (p) { return p.designator + '.' + p.number; });
						var shown = members.slice(0, 10).join(', ');
						if (members.length > 10) shown += ' …+ ' + (members.length - 10);
						lines.push('- ' + n.name + ' {' + members.length + '} ' + shown);
					});
				}

				var text = lines.join('\n');
				if (text.length > 24000) {
					text = text.slice(0, 24000) +
						'\n…（网表过长已截断；可调大 maxComponents，或缩小到单个图纸再评审）';
				}
				return text;
			}
		},

		/* ---------------------------------------------------------------- */
		{
			name: 'get_bom',
			description: 'Return the bill of materials of the open schematic, grouped by ' +
				'package + value, with quantity and the designators of every line.',
			parameters: P.obj({}),
			run: function () {
				var err = need(['sch']);
				if (err) return err;
				var comps = D.components(sheetJson());
				if (!comps.length) return 'No component found in the open schematic.';
				var bom = D.bom(comps);
				var lines = ['| designators | qty | package | value | name |',
					'|---|---|---|---|---|'];
				bom.slice(0, 200).forEach(function (b) {
					lines.push('| ' + b.designators.join(', ') + ' | ' + b.qty + ' | ' +
						(b.package || '') + ' | ' + (b.value || '') + ' | ' + (b.name || '') + ' |');
				});
				lines.push('');
				lines.push('lines: ' + bom.length + ', components: ' + comps.length);

				var noValue = comps.filter(function (c) { return !c.value; })
					.map(function (c) { return c.designator; });
				if (noValue.length) lines.push('missing value: ' + noValue.join(', '));
				var noPkg = comps.filter(function (c) { return !c.package; })
					.map(function (c) { return c.designator; });
				if (noPkg.length) lines.push('missing package: ' + noPkg.join(', '));
				return lines.join('\n');
			}
		},

		/* ---------------------------------------------------------------- */
		{
			name: 'get_pcb_info',
			description: 'Describe the open PCB: board size, footprint positions, nets and ' +
				'the number of tracks / vias / pads. Use it before reviewing a layout.',
			parameters: P.obj({}),
			run: function () {
				var err = need(['pcb']);
				if (err) return err;
				var p = D.pcbInfo();
				if (!p) return 'Could not read the PCB.';
				var lines = [];
				lines.push('board (bbox mil): ' + (p.bbox ? [p.bbox.x, p.bbox.y, p.bbox.width, p.bbox.height].join(', ') : 'n/a'));
				lines.push('board size: ' + (p.widthMm || '?') + ' x ' + (p.heightMm || '?') + ' mm');
				lines.push('footprints: ' + p.footprints.length +
					', nets: ' + p.nets.length +
					', tracks: ' + p.trackCount +
					', vias: ' + p.viaCount +
					', pads: ' + p.padCount);
				lines.push('');
				lines.push('## footprints');
				p.footprints.forEach(function (f) {
					lines.push('- ' + f.designator + ' | ' + (f.package || '') +
						' | x=' + f.x + ' y=' + f.y + ' rot=' + f.rotation +
						(f.layer !== undefined ? ' layer=' + f.layer : ''));
				});
				lines.push('');
				lines.push('## nets');
				p.nets.forEach(function (n) {
					var pads = n.pads.map(function (x) {
						return x.component ? x.component + '.' + x.pad : x.pad;
					}).slice(0, 60);
					lines.push('- ' + n.name + ' {' + n.pads.length + '} : ' + pads.join(', '));
				});
				return lines.join('\n');
			}
		},

		/* ---------------------------------------------------------------- */
		{
			name: 'capture_image',
			description: 'Export the current canvas as a PNG picture and attach it to the ' +
				'next message so you can actually look at the drawing. Use this whenever ' +
				'you need to judge the visual layout.',
			parameters: P.obj({}),
			run: function () {
				return D.capture(1800).then(function (img) {
					EAI._pendingImage = img;
					return 'Image captured (' + img.width + 'x' + img.height +
						') and attached to the next message.';
				}).catch(function (e) {
					return 'Capture failed: ' + (e && e.message ? e.message : e);
				});
			}
		},

		/* ============================================================ write == */

		/* ---------------------------------------------------------------- */
		{
			name: 'locate_component',
			description: 'Select and highlight a component / footprint in the editor so the ' +
				'user can see where it is. Use the exact designator, e.g. "R12".',
			parameters: P.obj({
				designator: P.str('Component designator, e.g. R12')
			}, ['designator']),
			run: function (args) {
				var d = String(args.designator || '').trim();
				if (!d) return 'designator is required';
				var found = D.locateComponent(d) || D.locateFootprint(d);
				return found ? ('Located ' + d + '.') : ('Could not find ' + d + ' in the open document.');
			}
		},

		/* ---------------------------------------------------------------- */
		{
			name: 'set_component_value',
			description: 'Change the value of a component (a parameter of its c_para bag). ' +
				'Only works on a schematic.',
			parameters: P.obj({
				designator: P.str('Component designator, e.g. R1'),
				value: P.str('New value, e.g. "10k"'),
				parameter: P.str('Parameter name to write, default "value"')
			}, ['designator', 'value']),
			run: function (args) {
				var err = need(['sch']);
				if (err) return err;
				var r = A.setComponentValue(args.designator, args.value, args.parameter);
				return r.ok ? ('Set ' + args.designator + ' ' + (r.parameter || 'value') + ' = ' + args.value)
					: ('Failed: ' + r.error);
			}
		},

		/* ---------------------------------------------------------------- */
		{
			name: 'set_component_designator',
			description: 'Rename a component (change its designator / reference, e.g. R3 -> R7).',
			parameters: P.obj({
				designator: P.str('Current designator'),
				newDesignator: P.str('New designator')
			}, ['designator', 'newDesignator']),
			run: function (args) {
				var err = need(['sch']);
				if (err) return err;
				var r = A.setComponentDesignator(args.designator, args.newDesignator);
				return r.ok ? ('Renamed ' + args.designator + ' to ' + args.newDesignator)
					: ('Failed: ' + r.error);
			}
		},

		/* ---------------------------------------------------------------- */
		{
			name: 'audit_components',
			description:
				'Check every component of the open schematic for incomplete library ' +
				'attributes: missing package, part number (Manufacturer Part), supplier, ' +
				'supplier part number or value. Returns one line per incomplete component; ' +
				'fix them with set_component_params.',
			parameters: P.obj({}),
			run: function () {
				var err = need(['sch']);
				if (err) return err;
				var comps = D.components(sheetJson());
				if (!comps.length) return '当前原理图没有元件。';

				var rows = [];
				comps.forEach(function (c) {
					var p = c.params || {};
					var missing = [];
					if (!c.package) missing.push('封装');
					if (!p['Manufacturer Part'] && !p['Supplier Part']) missing.push('型号');
					if (!p['Supplier'] && !p['Supplier Part']) missing.push('供应商');
					if (!p['Supplier Part']) missing.push('供应商编号');
					if (!c.value) missing.push('值');
					if (!missing.length) return;
					rows.push('- ' + (c.designator || '?') +
						' | ' + (c.name || '-') +
						' | 值 ' + (c.value || '-') +
						' | 缺：' + missing.join('、'));
				});

				var head = '共 ' + comps.length + ' 个元件，' + rows.length + ' 个属性不全';
				if (!rows.length) return head + '（全部完整）';
				return head + '\n' + rows.join('\n') +
					'\n\n用 set_component_params 逐个补全；不确定的型号/料号不要瞎填，列出来让用户确认。';
			}
		},

		/* ---------------------------------------------------------------- */
		{
			name: 'set_component_params',
			description:
				'Write library attributes onto one component (c_para). Use it to fill what ' +
				'audit_components reported: package, Manufacturer Part, Supplier, ' +
				'Supplier Part, value.',
			parameters: P.obj({
				designator: P.str('Component designator, e.g. U1'),
				package: P.str('Package / footprint, e.g. 0603 or SSOP-24'),
				manufacturerPart: P.str('Part number, e.g. HT1621B'),
				supplier: P.str('Supplier name, e.g. LCSC'),
				supplierPart: P.str('Supplier part number, e.g. C14243'),
				value: P.str('Value / comment')
			}, ['designator']),
			run: function (args) {
				var err = need(['sch']);
				if (err) return err;
				var patch = {};
				if (args.package) patch.package = args.package;
				if (args.manufacturerPart) patch['Manufacturer Part'] = args.manufacturerPart;
				if (args.supplier) patch.Supplier = args.supplier;
				if (args.supplierPart) patch['Supplier Part'] = args.supplierPart;
				if (args.value) patch.value = args.value;
				if (!Object.keys(patch).length) return '没有给出任何要写入的属性。';

				var r = A.setComponentParams(args.designator, patch);
				if (!r.ok) return '写入失败：' + r.error;
				var parts = [];
				Object.keys(r.applied).forEach(function (k) {
					parts.push(k + '=' + r.applied[k]);
				});
				return '已更新 ' + args.designator + '：' + parts.join(', ');
			}
		},

		/* ---------------------------------------------------------------- */
		{
			name: 'place_part',
			description: 'Place ONE built-in component at a position. Built-in parts: ' +
				'R, C, L, D, LED, SW, Q_NPN, Q_PNP, M_NMOS, M_PMOS, XTAL, CONN2, ' +
				'GENERIC (use pinCount for a generic n-pin IC). ' +
				'To place several at once use place_devices. Coordinates are schematic ' +
				'units (1 unit = 10 mil); out-of-frame points are clamped into the sheet.',
			parameters: P.obj({
				part: P.str('Built-in part key, e.g. R / C / L / D / LED / Q_NPN / M_NMOS / SW / CONN2'),
				x: P.num('X position in schematic units'),
				y: P.num('Y position'),
				rotation: P.num('Rotation in degrees, 0/90/180/270'),
				value: P.str('Value shown next to the symbol, e.g. 10k / 100nF'),
				name: P.str('Part number or name (required for GENERIC / XTAL)'),
				pre: P.str('Designator prefix letter, e.g. U (the ? is added automatically)'),
				designator: P.str('Optional explicit designator (usually leave empty: the editor numbers it)'),
				package: P.str('Optional package override, e.g. 0603'),
				pinCount: P.num('Pin count, only for GENERIC')
			}, ['part', 'x', 'y']),
			run: function (args) {
				var err = need(['sch']);
				if (err) return err;
				var r = A.placePart(args);
				return r.ok ? ('Placed ' + args.part + ' at ' + args.x + ',' + args.y +
					(r.gId ? ' (gId ' + r.gId + ')' : ''))
					: ('Failed: ' + r.error);
			}
		},

		/* ---------------------------------------------------------------- */
		{
			name: 'create_wire',
			description: 'Draw a wire through a list of points on the schematic.',
			parameters: P.obj({
				points: {
					type: 'array',
					description: 'At least two points, in schematic units (1 unit = 10 mil).',
					items: P.obj({ x: P.num('x'), y: P.num('y') }, ['x', 'y'])
				}
			}, ['points']),
			run: function (args) {
				var err = need(['sch']);
				if (err) return err;
				var r = A.createWire(args.points);
				return r.ok ? ('Wire drawn with ' + r.points + ' points.') : ('Failed: ' + r.error);
			}
		},

		/* ---------------------------------------------------------------- */
		{
			name: 'create_net_label',
			description: 'Place a net label (a named electrical anchor) on the schematic.',
			parameters: P.obj({
				x: P.num('x position'),
				y: P.num('y position'),
				name: P.str('Net name, e.g. VCC or SPI_MOSI'),
				rotation: P.num('0 or 90 or 180 or 270')
			}, ['x', 'y', 'name']),
			run: function (args) {
				var err = need(['sch']);
				if (err) return err;
				var r = A.createNetLabel(args.x, args.y, args.name, args.rotation);
				return r.ok ? ('Net label ' + args.name + ' placed at ' + args.x + ',' + args.y)
					: ('Failed: ' + r.error);
			}
		},

		/* ---------------------------------------------------------------- */
		{
			name: 'search_library',
			description:
				'Search the EasyEDA system library. Pass MANY queries in one call ' +
				'("queries": ["STM32F103C8T6", "AMS1117-3.3", ...]) — the tool runs them ' +
				'internally, so a 30-part BOM needs one call, not thirty. ' +
				'Never search for the built-in parts (R, C, L, D, LED, SW, Q_NPN, Q_PNP, ' +
				'M_NMOS, M_PMOS, XTAL, CONN2) — place those with place_devices/place_part.',
			parameters: P.obj({
				queries: {
					type: 'array',
					description: 'One entry per part number / keyword. Up to 20 per call.',
					items: P.str('e.g. "SSD1306", "AMS1117-3.3"')
				},
				query: P.str('Single query (legacy; prefer queries[])'),
				limit: P.num('Candidates per query (default 5, max 12).')
			}),
			run: function (args) {
				var qs = [];
				if (Array.isArray(args.queries)) qs = args.queries;
				else if (args.query) qs = [args.query];
				qs = qs.map(function (q) { return String(q == null ? '' : q).trim(); })
					.filter(function (q) { return q.length >= 2; })
					.filter(function (q, i, a) { return a.indexOf(q) === i; });
				if (!qs.length) return '请至少给一个不少于 2 个字符的查询词。';
				if (qs.length > 20) qs = qs.slice(0, 20);
				var limit = Math.min(Number(args.limit) || 5, 12);

				var out = [];
				var chain = Promise.resolve();
				qs.forEach(function (q) {
					chain = chain.then(function () {
						return searchOne(q, limit).then(function (txt) {
							out.push('### ' + q + '\n' + txt);
						});
					});
				});
				return chain.then(function () {
					return '系统库检索（' + qs.length + ' 个查询）：\n\n' + out.join('\n\n') +
						'\n\n命中项请用 place_devices 批量放置（一次调用可放多个）。';
				});
			}
		},

		/* ---------------------------------------------------------------- */
		{
			name: 'place_device',
			description:
				'Place a REAL component from the system library (take the uuid from ' +
				'search_library) onto the schematic. Prefer this over create_symbol, ' +
				'because the placed part keeps its package, supplier data and PCB linkage.',
			parameters: P.obj({
				uuid: P.str('Device uuid returned by search_library'),
				docType: P.str('Device docType returned by search_library (default "2")'),
				x: P.num('x position in schematic units'),
				y: P.num('y position'),
				rotation: P.num('0 / 90 / 180 / 270')
			}, ['uuid', 'x', 'y']),
			run: function (args) {
				var err = need(['sch', 'schlib']);
				if (err) return err;
				var uuid = String(args.uuid || '').trim();
				if (!uuid) return 'uuid is required (call search_library first).';
				var r = A.placeDevice({
					uuid: uuid, docType: args.docType,
					x: args.x, y: args.y, rotation: args.rotation
				});
				if (!r.ok) return '放置失败：' + r.error;
				return '已从系统库放置器件 (uuid ' + uuid + ') 到 ' + r.x + ',' + r.y +
					(r.clamped ? '（超出图框已修正）' : '') +
					'。该器件带有真实封装与 BOM 信息，不要再用 create_symbol 重复生成。';
			}
		},

		/* ---------------------------------------------------------------- */
		{
			name: 'place_devices',
			description:
				'Place MANY components in ONE call — either real library parts ' +
				'(uuid from search_library) or built-in parts (' +
				'R, C, L, D, LED, SW, Q_NPN, Q_PNP, M_NMOS, M_PMOS, XTAL, CONN2, GENERIC). ' +
				'Omit x/y to let the tool lay them out in a grid inside the sheet frame; ' +
				'all placements are clamped to stay inside the frame. ' +
				'This is the tool to use when populating a whole schematic: one call, ' +
				'not one call per part.',
			parameters: P.obj({
				placements: {
					type: 'array',
					items: P.obj({
						part: P.str('Built-in part name (omit when uuid is given)'),
						uuid: P.str('Library uuid from search_library'),
						docType: P.str('Library docType (default "2")'),
						x: P.num('Optional x; omit for auto layout'),
						y: P.num('Optional y; omit for auto layout'),
						rotation: P.num('0 / 90 / 180 / 270'),
						value: P.str('Value text, e.g. 10k / 100nF'),
						name: P.str('Part number or name (required for GENERIC / XTAL)'),
						pre: P.str('Designator prefix letter, e.g. U'),
						designator: P.str('Designator, e.g. R1 (usually omit: the editor numbers it)'),
						package: P.str('Package override'),
						pinCount: P.num('Pin count, only for GENERIC')
					})
				},
				autoLayout: { type: 'boolean', description: 'Grid-layout the ones without x/y (default true)' }
			}, ['placements']),
			run: function (args) {
				var err = need(['sch']);
				if (err) return err;
				var list = Array.isArray(args.placements) ? args.placements : [];
				if (!list.length) return 'placements 为空。';

				var b = A.sheetBounds();
				var auto = args.autoLayout !== false;
				var perRow = Math.max(1, Math.floor((b.maxX - b.minX) / 110));
				var col = 0, row = 0, placed = 0, clamped = 0, failed = 0;
				var lines = [];

				list.slice(0, 300).forEach(function (item) {
					var x = item.x, y = item.y;
					if (auto && (x === undefined || y === undefined || x === null || y === null)) {
						x = b.minX + 40 + (col % perRow) * 110;
						y = b.minY + 40 + row * 90;
						col++;
						if (col % perRow === 0) row++;
					}
					var r;
					if (item.uuid) {
						r = A.placeDevice({
							uuid: item.uuid, docType: item.docType,
							x: x, y: y, rotation: item.rotation
						});
					} else {
						r = A.placePart({
							part: item.part || 'R', x: x, y: y,
							rotation: item.rotation, value: item.value,
							name: item.name, pre: item.pre,
							designator: item.designator, package: item.package,
							pinCount: item.pinCount
						});
					}
					var name = item.designator || item.part || item.uuid || '?';
					if (r && r.ok) {
						placed++;
						if (r.clamped) clamped++;
						lines.push('✓ ' + name + ' @' + r.x + ',' + r.y);
					} else {
						failed++;
						lines.push('✗ ' + name + ' — ' + ((r && r.error) || 'unknown error'));
					}
				});

				return '已放置 ' + placed + ' 个（失败 ' + failed + '，贴边修正 ' + clamped + '）\n' +
					lines.slice(0, 200).join('\n') +
					(list.length > 300 ? '\n（超过 300 个，已截断）' : '');
			}
		},

		/* ---------------------------------------------------------------- */
		{
			name: 'ask_user',
			description:
				'Ask the user one or more questions and WAIT for the answers. ' +
				'Use this ONCE, before drawing, to collect every unknown at the same time ' +
				'(supply rails, exact IC part numbers, package, connector pinout…). ' +
				'Never stop the task to ask in plain text — batch all questions here, ' +
				'then continue with the answers. Returns a JSON object of answers.',
			parameters: P.obj({
				questions: {
					type: 'array',
					items: P.obj({
						id: P.str('Short id used as the answer key, e.g. "vcc"'),
						text: P.str('Question text'),
						options: {
							type: 'array',
							description: 'Preset answers; the user can also type a custom one',
							items: P.obj({
								value: P.str('Value returned to you'),
								label: P.str('Text shown to the user')
							}, ['value'])
						},
						allowCustom: { type: 'boolean', description: 'Allow free text (default true)' }
					}, ['id', 'text'])
				}
			}, ['questions']),
			run: function (args) {
				var qs = (args.questions || []).filter(function (q) {
					return q && q.text && q.id;
				});
				if (!qs.length) return '没有给出有效的问题。';
				if (!EAI.ui || !EAI.ui.askQuestions) {
					return '问答界面不可用，请按合理默认继续完成，并在最终说明里列出假设。';
				}
				return EAI.ui.askQuestions(qs).then(function (answers) {
					return '用户回答（JSON）：' + JSON.stringify(answers);
				});
			}
		},

		/* ---------------------------------------------------------------- */
		{
			name: 'create_symbol',
			description:
				'FALLBACK when search_library found nothing: create a COMPLETE schematic ' +
				'symbol in one call — body rectangle, one independent pin per pin, ' +
				'designator/name annotations, and the library attributes ' +
				'(name, package, pre, manufacturer part) written into c_para. ' +
				'Call it ONCE per symbol — do not capture screenshots to verify or repair ' +
				'it afterwards. Coordinates are relative to the symbol origin; a pin line ' +
				'runs from the body end (x,y) to (x+dx, y+dy).',
			parameters: P.obj({
				name: P.str('Symbol name'),
				pre: P.str('Designator prefix, e.g. U'),
				package: P.str('Package name, e.g. SSOP-24'),
				manufacturerPart: P.str('Part number if you can identify it, e.g. HT1621B'),
				manufacturer: P.str('Optional manufacturer'),
				supplierPart: P.str('Optional supplier (LCSC) part number'),
				value: P.str('Optional value text'),
				x: P.num('Placement x'),
				y: P.num('Placement y'),
				pins: {
					type: 'array',
					items: P.obj({
						number: P.str('Pin number'),
						name: P.str('Pin name'),
						x: P.num('Body end x'),
						y: P.num('Body end y'),
						dx: P.num('Pin direction/length on x (e.g. -10 for a pin on the left)'),
						dy: P.num('Pin direction/length on y'),
						electric: P.str('passive | input | output | power | bidirectional')
					}, ['number', 'x', 'y'])
				}
			}, ['name', 'pins']),
			run: function (args) {
				var err = need(['sch', 'schlib']);
				if (err) return err;
				var r = A.createSymbol(args);
				if (!r.ok) return 'Failed: ' + r.error;
				return 'Symbol "' + r.name + '" created at ' + r.x + ',' + r.y +
					' · package ' + (r.package || '-') +
					' · ' + r.pinCount + ' pins + body rectangle' +
					(r.manufacturerPart ? ' · Manufacturer Part ' + r.manufacturerPart : '') +
					'. Attributes written to c_para; no screenshot needed.';
			}
		}
	];

	/* ---------------------------------------------------------- registry -- */

	T.byName = {};
	T.defs.forEach(function (t) { T.byName[t.name] = t; });

	/** Schemas in the shape the LLM clients expect. */
	T.schema = function () {
		return T.defs.map(function (t) {
			return { name: t.name, description: t.description, parameters: t.parameters };
		});
	};

	/** Names filtered by the kind of document that is currently open. */
	T.available = function () {
		var kind = EAI.eda.docKind();
		var READ = ['get_document_info', 'capture_image', 'locate_component'];
		var SCH = ['get_components', 'get_netlist', 'get_bom', 'set_component_value',
			'set_component_designator', 'audit_components', 'set_component_params',
			'search_library', 'place_device', 'place_devices',
			'place_part', 'create_wire', 'create_net_label', 'create_symbol', 'ask_user'];
		var PCB = ['get_pcb_info', 'get_components'];

		var allow = READ.slice();
		if (kind === 'sch' || kind === 'schlib') allow = allow.concat(SCH);
		else if (kind === 'pcb') allow = allow.concat(PCB);
		else if (!kind) allow = allow.concat(PCB);

		return T.schema().filter(function (s) { return allow.indexOf(s.name) >= 0; });
	};

	/** Executes one tool call. Always resolves to a string. */
	T.run = function (name, args) {
		var t = T.byName[name];
		if (!t) return Promise.resolve('Unknown tool: ' + name);
		var argTxt = '';
		try { argTxt = JSON.stringify(args || {}); } catch (e) { argTxt = '{}'; }
		if (argTxt.length > 400) argTxt = argTxt.slice(0, 400) + '…';
		EAI.log('tool call: ' + name + ' ' + argTxt);
		return Promise.resolve()
			.then(function () { return t.run(args || {}); })
			.then(function (r) {
				var s = ok(r === undefined ? 'ok' : r);
				EAI.log('tool result: ' + name + ' → ' + s.slice(0, 300));
				return s;
			})
			.catch(function (e) {
				var msg = 'Tool "' + name + '" failed: ' + (e && e.message ? e.message : e);
				EAI.log(msg, 'error');
				return msg;
			});
	};
})();
