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
			name: 'place_part',
			description: 'Place a component on the schematic at a position. Built-in parts: ' +
				'R, C, L, D, LED, SW, and GENERIC (use pinCount for a generic n-pin IC). ' +
				'Coordinates are schematic units (1 unit = 10 mil).',
			parameters: P.obj({
				part: P.str('R | C | L | D | LED | SW | GENERIC'),
				x: P.num('X position in schematic units'),
				y: P.num('Y position'),
				rotation: P.num('Rotation in degrees, 0/90/180/270'),
				value: P.str('Value text, e.g. 10k'),
				designator: P.str('Optional designator, e.g. R1'),
				package: P.str('Optional package, e.g. 0603'),
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
			name: 'create_symbol',
			description: 'Create a schematic symbol (with real pins) and place it. Pins are ' +
				'given in coordinates relative to the symbol origin; the drawn pin line goes ' +
				'from the body end to dotX/dotY.',
			parameters: P.obj({
				name: P.str('Symbol name'),
				pre: P.str('Designator prefix, e.g. U'),
				package: P.str('Package name'),
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
				return r.ok ? ('Symbol "' + args.name + '" created at ' + r.x + ',' + r.y)
					: ('Failed: ' + r.error);
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
			'set_component_designator', 'place_part', 'create_wire', 'create_net_label',
			'create_symbol'];
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
