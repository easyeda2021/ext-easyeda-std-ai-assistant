/* =====================================================================
 * EasyEDA Std extension — "AI Assistant"
 * eda.js — the EasyEDA data layer
 *
 * Everything in here is derived from the *public* document JSON that the
 * Std editor exposes through the extension API:
 *
 *     api('getSource', 'json')                 active document
 *     api('getActiveProjectAllSchJson')        every sheet of the project
 *
 * The JSON layout (schematic) is:
 *     head, shape[], itemOrder[], schlib{}, wire{}, bus{}, netlabel{},
 *     netflag{}, junction{}, annotation{}, rect{} … , BBox, canvas
 * The JSON layout (pcb) is:
 *     head, TRACK{}, PAD{}, VIA{}, HOLE{}, TEXT{}, ARC{}, RECT{}, CIRCLE{},
 *     COPPERAREA{}, SOLIDREGION{}, SVGNODE{}, FOOTPRINT{}, layers[], canvas
 *
 * Coordinates: schematic = 1/100 inch (10 mil), pcb = 1 mil.
 * ===================================================================== */
(function () {
	'use strict';

	var EAI = (window.EAI = window.EAI || {});
	var D = (EAI.eda = {});
	var U = EAI.util;

	/* ------------------------------------------------------------ basics -- */

	/** Document type of the active tab: 'sch' | 'pcb' | 'schlib' | … */
	D.docType = function () {
		try {
			var j = EAI.api('getActiveJson');
			if (j && j.head && j.head.docType) return j.head.docType;
		} catch (e) { /* ignore */ }
		return null;
	};

	/** JSON of the active document (or null). */
	D.activeJson = function () {
		try { return EAI.api('getActiveJson'); }
		catch (e) { EAI.log('getActiveJson failed: ' + e, 'error'); return null; }
	};

	D.activeTitle = function () {
		try { return EAI.api('getActiveFileTitle'); }
		catch (e) { return ''; }
	};

	/** Call a raw editor command (goes straight into the active editor frame). */
	D.editorCall = function (cmd, args) {
		try {
			return EAI.api('editorCall', { cmd: cmd, args: args || [] });
		} catch (e) {
			EAI.log('editorCall(' + cmd + ') failed: ' + e, 'error');
			return null;
		}
	};

	/** Every schematic sheet of the active project. */
	D.projectSchematics = function () {
		try {
			var p = EAI.api('getActiveProjectAllSchJson');
			if (!p || !p.schematics) return [];
			return p.schematics.filter(function (s) { return s && s.json; });
		} catch (e) {
			EAI.log('getActiveProjectAllSchJson failed: ' + e, 'error');
			return [];
		}
	};

	/* ------------------------------------------------------- c_para utils -- */

	/**
	 * c_para is a backtick separated list of key/value pairs:
	 *   "package`0805`value`10k`"
	 * Keys prefixed with BOM_ are stripped (that is how the BOM exporter
	 * marks user visible parameters).
	 */
	D.cParaToJson = function (str) {
		var out = {};
		if (!str || typeof str !== 'string') return out;
		var parts = str.split('`');
		for (var i = 0; i < parts.length - 1; i += 2) {
			var k = parts[i];
			if (!k) continue;
			var v = parts[i + 1] === undefined ? '' : parts[i + 1];
			out[String(k).replace(/^BOM_/, '')] = v;
		}
		return out;
	};

	D.jsonToCPara = function (obj) {
		var s = '';
		for (var k in obj) {
			if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
			if (k.indexOf('attr-') === 0) continue;
			s += k + '`' + (obj[k] === undefined || obj[k] === null ? '' : obj[k]) + '`';
		}
		return s;
	};

	/** Pick the most likely "component value" out of the parameter map. */
	function guessValue(params, customText) {
		var keys = ['value', 'Value', 'VALUE', 'Resistance', 'Capacitance', 'Inductance',
			'Voltage', 'Current', 'Power', 'Frequency', 'Model', 'Comment'];
		for (var i = 0; i < keys.length; i++) {
			if (params[keys[i]]) return params[keys[i]];
		}
		/* any parameter that is not a well known meta field */
		for (var k in params) {
			if (!Object.prototype.hasOwnProperty.call(params, k)) continue;
			if (/^(package|Package|spicePre|name|pre|Supplier|Manufacturer|Comment|Contributors?|partType|Supplier Part|Manufacturer Part)$/i.test(k)) continue;
			if (params[k]) return params[k];
		}
		return customText || '';
	}

	/* -------------------------------------------------------- components -- */

	/** Annotation entries of a schematic component keyed by their marker. */
	function annotationsOf(comp) {
		var res = { designator: '', name: '', package: '', custom: [] };
		var ann = comp && comp.annotation;
		if (!ann) return res;
		for (var id in ann) {
			if (!Object.prototype.hasOwnProperty.call(ann, id)) continue;
			var a = ann[id];
			if (!a) continue;
			if (a.mark === 'P') res.designator = a.string || '';
			else if (a.mark === 'N') res.name = a.string || '';
			else if (a.mark === 'PK') res.package = a.string || '';
			else res.custom.push({ id: id, text: a.string || '', x: a.x, y: a.y });
		}
		return res;
	}

	/**
	 * All components of one schematic sheet.
	 * @returns {Array} [{gId, designator, name, package, value, params, x, y,
	 *                   rotation, custom[], pins[]}]
	 */
	D.components = function (json) {
		var out = [];
		if (!json || !json.schlib) return out;
		for (var gid in json.schlib) {
			if (!Object.prototype.hasOwnProperty.call(json.schlib, gid)) continue;
			if (gid.indexOf('frame_lib_') === 0) continue;   /* sheet frames */
			var comp = json.schlib[gid];
			if (!comp) continue;
			var ann = annotationsOf(comp);
			var params = D.cParaToJson(comp.head && comp.head.c_para);
			var customText = ann.custom.length ? ann.custom[0].text : '';

			var pins = [];
			if (comp.pin) {
				for (var pid in comp.pin) {
					if (!Object.prototype.hasOwnProperty.call(comp.pin, pid)) continue;
					var p = comp.pin[pid];
					if (!p) continue;
					pins.push({
						gId: pid,
						number: (p.num && p.num.text) || '',
						name: (p.name && p.name.text) || '',
						x: p.pinDot ? p.pinDot.x : null,
						y: p.pinDot ? p.pinDot.y : null,
						electric: p.configure ? p.configure.electric : '',
						visible: !!(p.configure && p.configure.display === 'show')
					});
				}
			}

			out.push({
				gId: gid,
				designator: ann.designator,
				name: ann.name || params.name || '',
				package: ann.package || params.package || params.PACKAGE || '',
				value: guessValue(params, customText),
				params: params,
				custom: ann.custom,
				x: comp.head ? comp.head.x : 0,
				y: comp.head ? comp.head.y : 0,
				rotation: comp.head ? (comp.head.rotation || 0) : 0,
				pins: pins
			});
		}
		out.sort(function (a, b) {
			return String(a.designator).localeCompare(String(b.designator), 'en',
				{ numeric: true });
		});
		return out;
	};

	/* ------------------------------------------------------------ netlist -- */

	/* --- tiny union find ------------------------------------------------- */
	function UF() { this.p = {}; }
	UF.prototype.find = function (a) {
		if (this.p[a] === undefined) { this.p[a] = a; return a; }
		var root = a;
		while (this.p[root] !== root) root = this.p[root];
		var cur = a;
		while (this.p[cur] !== root) { var nxt = this.p[cur]; this.p[cur] = root; cur = nxt; }
		return root;
	};
	UF.prototype.union = function (a, b) {
		var ra = this.find(a), rb = this.find(b);
		if (ra === rb) return ra;
		this.p[rb] = ra;
		return ra;
	};

	function ptKey(x, y) { return x + '_' + y; }

	/**
	 * Builds the net list of the given schematic sheets.
	 *
	 * The algorithm mirrors what the editor itself does: a wire is one
	 * electrical node, pins attach to the endpoints of a wire, net labels and
	 * net flags name the node they sit on, and junctions allow a wire to be
	 * tapped in the middle.
	 *
	 * @param {Array} sheets [{title, json}]
	 * @returns {Object} {nets:[…], stats:{…}}
	 */
	D.netlist = function (sheets) {
		sheets = sheets || [];
		var uf = new UF();
		var pins = [], wires = [], labels = [], junctions = [];
		var i, j, k;

		function off(sheetIndex) { return sheetIndex * 1e6; }

		for (i = 0; i < sheets.length; i++) {
			var sheet = sheets[i];
			var json = sheet.json || {};
			var o = off(i);
			var sheetTitle = sheet.title || ('Sheet' + (i + 1));

			/* pins */
			var comps = D.components(json);
			for (j = 0; j < comps.length; j++) {
				var c = comps[j];
				for (k = 0; k < c.pins.length; k++) {
					var pin = c.pins[k];
					if (pin.x === null || pin.y === null) continue;
					pins.push({
						key: ptKey(pin.x + o, pin.y + o),
						x: pin.x + o, y: pin.y + o,
						designator: c.designator, number: pin.number,
						pinName: pin.name, sheet: sheetTitle, sheetIndex: i,
						gId: c.gId, pinGId: pin.gId
					});
				}
			}

			/* wires */
			if (json.wire) {
				for (var wid in json.wire) {
					if (!Object.prototype.hasOwnProperty.call(json.wire, wid)) continue;
					var w = json.wire[wid];
					if (!w || !w.pointArr || !w.pointArr.length) continue;
					var pts = w.pointArr.map(function (p) {
						return { x: p.x + o, y: p.y + o };
					});
					wires.push({ gId: wid, pts: pts, sheet: sheetTitle, sheetIndex: i });
					for (var q = 1; q < pts.length; q++) {
						uf.union(ptKey(pts[0].x, pts[0].y), ptKey(pts[q].x, pts[q].y));
					}
				}
			}

			/* junctions */
			if (json.junction) {
				for (var jid in json.junction) {
					if (!Object.prototype.hasOwnProperty.call(json.junction, jid)) continue;
					var jn = json.junction[jid];
					if (!jn || !jn.pinDot) continue;
					junctions.push({
						key: ptKey(jn.pinDot.x + o, jn.pinDot.y + o),
						x: jn.pinDot.x + o, y: jn.pinDot.y + o
					});
				}
			}

			/* net labels */
			if (json.netlabel) {
				for (var nid in json.netlabel) {
					if (!Object.prototype.hasOwnProperty.call(json.netlabel, nid)) continue;
					var nl = json.netlabel[nid];
					if (!nl || !nl.pinDot) continue;
					labels.push({
						key: ptKey(nl.pinDot.x + o, nl.pinDot.y + o),
						x: nl.pinDot.x + o, y: nl.pinDot.y + o,
						name: String(nl.name || '').toUpperCase(),
						sheet: sheetTitle, sheetIndex: i, gId: nid, kind: 'netlabel'
					});
				}
			}

			/* net flags (GND, VCC, power ports …) */
			if (json.netflag) {
				for (var fid in json.netflag) {
					if (!Object.prototype.hasOwnProperty.call(json.netflag, fid)) continue;
					var nf = json.netflag[fid];
					if (!nf || !nf.pinDot) continue;
					var fname = '';
					if (nf.mark && nf.mark.netFlagString) fname = nf.mark.netFlagString;
					else if (nf.configure && nf.configure.partId) {
						fname = String(nf.configure.partId).replace(/part_netLabel_/gi, '');
					}
					labels.push({
						key: ptKey(nf.pinDot.x + o, nf.pinDot.y + o),
						x: nf.pinDot.x + o, y: nf.pinDot.y + o,
						name: String(fname).toUpperCase(),
						sheet: sheetTitle, sheetIndex: i, gId: fid, kind: 'netflag'
					});
				}
			}
		}

		/* --- pin ↔ wire ---------------------------------------------------- */
		var junctionSet = {};
		for (i = 0; i < junctions.length; i++) junctionSet[junctions[i].key] = true;

		for (i = 0; i < pins.length; i++) {
			var pin = pins[i];
			for (j = 0; j < wires.length; j++) {
				var w2 = wires[j];
				var pts2 = w2.pts;
				var hit = false;
				for (k = 0; k < pts2.length; k++) {
					if (pts2[k].x === pin.x && pts2[k].y === pin.y) {
						var isEnd = (k === 0 || k === pts2.length - 1);
						if (isEnd || junctionSet[pin.key]) { hit = true; break; }
					}
				}
				if (hit) { uf.union(pin.key, ptKey(pts2[0].x, pts2[0].y)); break; }
			}
		}

		/* --- wire ↔ wire (shared point) ------------------------------------ */
		for (i = 0; i < wires.length; i++) {
			for (j = i + 1; j < wires.length; j++) {
				var A = wires[i], B = wires[j];
				var connect = false;
				for (var a = 0; a < A.pts.length && !connect; a++) {
					for (var b = 0; b < B.pts.length; b++) {
						if (A.pts[a].x !== B.pts[b].x || A.pts[a].y !== B.pts[b].y) continue;
						var key = ptKey(A.pts[a].x, A.pts[a].y);
						var aEnd = (a === 0 || a === A.pts.length - 1);
						var bEnd = (b === 0 || b === B.pts.length - 1);
						if (aEnd || bEnd || junctionSet[key]) { connect = true; break; }
					}
				}
				if (connect) {
					uf.union(ptKey(A.pts[0].x, A.pts[0].y), ptKey(B.pts[0].x, B.pts[0].y));
				}
			}
		}

		/* --- labels attach to whatever sits on their point ----------------- */
		for (i = 0; i < labels.length; i++) {
			var lb = labels[i];
			uf.find(lb.key);
			for (j = 0; j < wires.length; j++) {
				var wp = wires[j].pts;
				for (k = 0; k < wp.length; k++) {
					if (wp[k].x === lb.x && wp[k].y === lb.y) {
						uf.union(lb.key, ptKey(wp[0].x, wp[0].y));
						break;
					}
				}
			}
			for (j = 0; j < pins.length; j++) {
				if (pins[j].x === lb.x && pins[j].y === lb.y) {
					uf.union(lb.key, pins[j].key);
				}
			}
		}

		/* --- collect groups ------------------------------------------------ */
		/* every key that took part in the connectivity gets its final root */
		var keyRoot = {};
		function registerKey(key) {
			if (keyRoot[key] === undefined) keyRoot[key] = uf.find(key);
		}
		for (i = 0; i < pins.length; i++) registerKey(pins[i].key);
		for (i = 0; i < labels.length; i++) registerKey(labels[i].key);
		for (i = 0; i < wires.length; i++) {
			for (j = 0; j < wires[i].pts.length; j++) {
				registerKey(ptKey(wires[i].pts[j].x, wires[i].pts[j].y));
			}
		}

		var groups = {};
		function groupOf(key) {
			var r = keyRoot[key];
			if (r === undefined) return null;
			if (!groups[r]) groups[r] = { pins: [], labels: [], names: [], sheets: {} };
			return groups[r];
		}
		for (i = 0; i < pins.length; i++) {
			var g = groupOf(pins[i].key);
			if (!g) continue;
			g.pins.push(pins[i]);
			g.sheets[pins[i].sheet] = true;
		}
		for (i = 0; i < labels.length; i++) {
			var lg = groupOf(labels[i].key);
			if (!lg) continue;
			lg.labels.push(labels[i]);
			if (labels[i].name) lg.names.push(labels[i].name);
			lg.sheets[labels[i].sheet] = true;
		}

		/* --- authoritative names from the editor (active sheet only) ------- */
		D._applyEditorNetNames(groups, keyRoot, sheets);

		/* --- build the result --------------------------------------------- */
		var nets = [];
		for (var root in groups) {
			if (!Object.prototype.hasOwnProperty.call(groups, root)) continue;
			var grp = groups[root];
			var name = '';
			var auto = false;
			var unique = [];
			grp.names.forEach(function (n) {
				if (unique.indexOf(n) < 0) unique.push(n);
			});
			if (unique.length === 1) name = unique[0];
			else if (unique.length > 1) name = unique.join(' / ');
			if (!name) { name = ''; auto = true; }

			nets.push({
				name: name,
				auto: auto,
				conflict: unique.length > 1,
				pins: grp.pins.map(function (p) {
					return {
						designator: p.designator, number: p.number,
						name: p.pinName, sheet: p.sheet
					};
				}),
				labels: grp.labels.map(function (l) {
					return { name: l.name, sheet: l.sheet, kind: l.kind };
				}),
				sheets: Object.keys(grp.sheets)
			});
		}

		/* assign readable names to the unnamed nets */
		var autoIdx = 0;
		nets.forEach(function (n) {
			if (n.auto) { autoIdx++; n.name = 'NET_' + autoIdx; }
		});

		nets.sort(function (a, b) {
			if (a.auto !== b.auto) return a.auto ? 1 : -1;
			return String(a.name).localeCompare(String(b.name));
		});

		return {
			nets: nets,
			stats: {
				nets: nets.length,
				namedNets: nets.filter(function (n) { return !n.auto; }).length,
				conflicts: nets.filter(function (n) { return n.conflict; }).length,
				pins: pins.length,
				wires: wires.length,
				sheets: sheets.length
			}
		};
	};

	/**
	 * Asks the editor for the official net name of a set of points.
	 * The editor knows the real connectivity, so its answer is preferred
	 * over the heuristic computed above.  Only the active sheet can be
	 * queried this way, the rest keeps the label based names.
	 */
	D._applyEditorNetNames = function (groups, keyRoot, sheets) {
		if (!sheets.length) return;

		var active = null;
		try { active = EAI.api('getActiveJson'); } catch (e) { /* ignore */ }
		if (!active || !active.wire) return;

		/* which sheet of the project is the active one? */
		var activeIds = Object.keys(active.wire).sort().join(',');
		var activeIndex = -1, si;
		for (si = 0; si < sheets.length; si++) {
			var sj = sheets[si].json || {};
			if (!sj.wire) continue;
			if (Object.keys(sj.wire).sort().join(',') === activeIds) { activeIndex = si; break; }
		}
		if (activeIndex < 0) return;

		var o = activeIndex * 1e6;
		var pts = [], seen = {}, i;
		for (var wid in active.wire) {
			if (!Object.prototype.hasOwnProperty.call(active.wire, wid)) continue;
			var arr = active.wire[wid].pointArr || [];
			for (i = 0; i < arr.length; i++) {
				var key = ptKey(arr[i].x + o, arr[i].y + o);
				if (seen[key]) continue;
				seen[key] = true;
				pts.push({ x: arr[i].x + o, y: arr[i].y + o, key: key });
			}
		}
		if (!pts.length) return;

		var names;
		try {
			names = EAI.api('editorCall', {
				cmd: 'getWireNetName',
				args: [pts.map(function (p) { return { x: p.x - o, y: p.y - o }; })]
			});
		} catch (e) { return; }
		if (!names || !names.length) return;

		for (i = 0; i < pts.length; i++) {
			var nm = names[i];
			if (!nm) continue;
			var root = keyRoot[pts[i].key];
			if (root === undefined) continue;
			var grp = groups[root];
			if (!grp) continue;
			if (grp.names.indexOf(nm) < 0) grp.names.push(nm);
		}
	};

	/* ---------------------------------------------------------------- BOM -- */

	/**
	 * Groups the components of one or more sheets into BOM lines.
	 * @param {Array} components
	 */
	D.bom = function (components) {
		var lines = {};
		var order = [];
		components.forEach(function (c) {
			var pkg = c.package || '';
			var val = c.value || '';
			var key = pkg + '\u0001' + val + '\u0001' + (c.name || '');
			if (!lines[key]) {
				lines[key] = {
					package: pkg, value: val, name: c.name || '',
					qty: 0, designators: []
				};
				order.push(key);
			}
			lines[key].qty++;
			lines[key].designators.push(c.designator);
		});
		return order.map(function (k) {
			var l = lines[k];
			l.designators.sort(function (a, b) {
				return String(a).localeCompare(String(b), 'en', { numeric: true });
			});
			return l;
		});
	};

	/* ---------------------------------------------------------------- PCB -- */

	/** Components (footprints) of a PCB document. */
	D.pcbComponents = function (json) {
		var out = [];
		if (!json || !json.FOOTPRINT) return out;
		for (var gid in json.FOOTPRINT) {
			if (!Object.prototype.hasOwnProperty.call(json.FOOTPRINT, gid)) continue;
			var fp = json.FOOTPRINT[gid];
			if (!fp) continue;
			var head = fp.head || {};
			var params = D.cParaToJson(head.c_para);
			var designator = '', name = '';

			/* the designator / name live in the text annotations of the footprint */
			for (var key in fp) {
				if (!Object.prototype.hasOwnProperty.call(fp, key)) continue;
				var sub = fp[key];
				if (!sub || typeof sub !== 'object') continue;
				for (var tid in sub) {
					if (!Object.prototype.hasOwnProperty.call(sub, tid)) continue;
					var t = sub[tid];
					if (!t) continue;
					var note = t.c_note || t.note || '';
					if (note === 'note_pre' && !designator) designator = t.string || '';
					else if (note === 'note_name' && !name) name = t.string || '';
				}
			}
			if (!designator) designator = params.pre || '';

			out.push({
				gId: gid,
				designator: designator,
				name: name || params.name || '',
				package: params.package || params.PACKAGE || head.c_para || '',
				params: params,
				x: head.x || 0, y: head.y || 0,
				rotation: head.rotation || 0,
				layer: head.layerid,
				addIntoBom: head.add_into_bom !== 'no'
			});
		}
		out.sort(function (a, b) {
			return String(a.designator).localeCompare(String(b.designator), 'en', { numeric: true });
		});
		return out;
	};

	/** Nets of a PCB document (from the PAD / VIA net fields). */
	D.pcbNets = function (json) {
		var nets = {};
		function add(net, comp, pad) {
			if (!net) return;
			if (!nets[net]) nets[net] = { name: net, pads: [] };
			nets[net].pads.push({ component: comp, pad: pad });
		}
		function scan(objMap, comp) {
			if (!objMap) return;
			for (var g in objMap) {
				if (!Object.prototype.hasOwnProperty.call(objMap, g)) continue;
				var o = objMap[g];
				if (!o) continue;
				add(o.net, comp, o.number || o.name || '');
			}
		}
		if (json && json.FOOTPRINT) {
			for (var gid in json.FOOTPRINT) {
				if (!Object.prototype.hasOwnProperty.call(json.FOOTPRINT, gid)) continue;
				var fp = json.FOOTPRINT[gid];
				var des = '';
				for (var key in fp) {
					if (!Object.prototype.hasOwnProperty.call(fp, key)) continue;
					var sub = fp[key];
					if (!sub || typeof sub !== 'object') continue;
					for (var tid in sub) {
						if (!Object.prototype.hasOwnProperty.call(sub, tid)) continue;
						var t = sub[tid];
						if (t && (t.c_note === 'note_pre' || t.note === 'note_pre')) {
							des = t.string || des;
						}
					}
				}
				scan(fp.PAD, des);
			}
		}
		scan(json && json.PAD, '');
		var out = [];
		for (var n in nets) {
			if (Object.prototype.hasOwnProperty.call(nets, n)) out.push(nets[n]);
		}
		out.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
		return out;
	};

	/* ------------------------------------------------------------- images -- */

	/** Raw SVG of the active document (ids and internal attributes stripped). */
	D.svg = function (margin) {
		try {
			return EAI.api('getSource', { type: 'svg', margin: margin || 50 });
		} catch (e) {
			EAI.log('getSource(svg) failed: ' + e, 'error');
			return null;
		}
	};

	/**
	 * Rasterises an SVG string into a PNG data URL.
	 * @param {string} svg
	 * @param {number} maxPx longest edge of the produced bitmap
	 */
	D.svgToPng = function (svg, maxPx) {
		maxPx = maxPx || 1600;
		return new Promise(function (resolve, reject) {
			if (!svg) { reject(new Error('empty svg')); return; }

			var m = /<svg[^>]*\bwidth="([\d.]+)"[^>]*\bheight="([\d.]+)"/.exec(svg);
			if (!m) { reject(new Error('svg without width/height')); return; }
			var w = parseFloat(m[1]), h = parseFloat(m[2]);
			if (!w || !h) { reject(new Error('svg without size')); return; }

			var k = Math.min(maxPx / w, maxPx / h);
			k = U.clamp(k, 0.02, 12);
			var outW = Math.max(1, Math.round(w * k));
			var outH = Math.max(1, Math.round(h * k));

			/* scale the raster size but keep the viewBox so the drawing scales */
			var scaled = svg.replace(/\bwidth="[\d.]+"/, 'width="' + outW + '"')
				.replace(/\bheight="[\d.]+"/, 'height="' + outH + '"');

			var blob = new Blob([scaled], { type: 'image/svg+xml;charset=utf-8' });
			var url = URL.createObjectURL(blob);
			var img = new Image();
			var done = false;

			img.onload = function () {
				if (done) return;
				done = true;
				try {
					var cv = document.createElement('canvas');
					cv.width = outW; cv.height = outH;
					var ctx = cv.getContext('2d');
					ctx.fillStyle = '#ffffff';
					ctx.fillRect(0, 0, outW, outH);
					ctx.drawImage(img, 0, 0, outW, outH);
					var dataUrl = cv.toDataURL('image/png');
					URL.revokeObjectURL(url);
					resolve({
						dataUrl: dataUrl,
						base64: dataUrl.split(',')[1] || '',
						width: outW, height: outH
					});
				} catch (e) {
					URL.revokeObjectURL(url);
					reject(e);
				}
			};
			img.onerror = function () {
				if (done) return;
				done = true;
				URL.revokeObjectURL(url);
				reject(new Error('failed to rasterise the svg'));
			};
			img.src = url;
		});
	};

	/* ----------------------------------------------------------- locating -- */

	/** Selects and highlights a schematic component by its designator. */
	D.locateComponent = function (designator) {
		var json = D.activeJson();
		if (!json || !json.schlib) return false;
		for (var gid in json.schlib) {
			if (!Object.prototype.hasOwnProperty.call(json.schlib, gid)) continue;
			var ann = json.schlib[gid].annotation;
			if (!ann) continue;
			for (var aid in ann) {
				if (!Object.prototype.hasOwnProperty.call(ann, aid)) continue;
				if (ann[aid].mark === 'P' && ann[aid].string === designator) {
					D.editorCall('select', { ids: [gid] });
					D.editorCall('highlightItems', [[gid], { selectClass: 'selected' }]);
					return true;
				}
			}
		}
		return false;
	};

	/** Highlights a PCB footprint by its designator. */
	D.locateFootprint = function (designator) {
		var json = D.activeJson();
		if (!json || !json.FOOTPRINT) return false;
		for (var gid in json.FOOTPRINT) {
			if (!Object.prototype.hasOwnProperty.call(json.FOOTPRINT, gid)) continue;
			var fp = json.FOOTPRINT[gid];
			for (var key in fp) {
				if (!Object.prototype.hasOwnProperty.call(fp, key)) continue;
				var sub = fp[key];
				if (!sub || typeof sub !== 'object') continue;
				for (var tid in sub) {
					if (!Object.prototype.hasOwnProperty.call(sub, tid)) continue;
					var t = sub[tid];
					if (t && (t.c_note === 'note_pre' || t.note === 'note_pre') &&
						t.string === designator) {
						D.editorCall('select', { ids: [gid] });
						D.editorCall('highlightItems', [[gid], { selectClass: 'selected' }]);
						return true;
					}
				}
			}
		}
		return false;
	};
})();
