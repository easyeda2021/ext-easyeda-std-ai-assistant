/* =====================================================================
 * EasyEDA Std extension — "AI Assistant" / AI 助手
 * eda-netlist.js — connectivity engine (union-find + editor net names)
 * ===================================================================== */
(function () {
	'use strict';

	var EAI = (window.EAI = window.EAI || {});
	var D = (EAI.eda = EAI.eda || {});
	var U = EAI.util;

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

})();
