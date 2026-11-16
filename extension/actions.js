/* =====================================================================
 * EasyEDA Std extension — "AI Assistant"
 * actions.js — writes the result of an AI request back into the document
 *
 * Writing happens through three public entry points of the Std API:
 *   api('getShape',   {id, cmdKey})   read one shape as json cache
 *   api('updateShape',{shapeType,jsonCache})  modify one shape
 *   api('createShape',{shapeType,...})       add a new shape
 * ===================================================================== */
(function () {
	'use strict';

	var EAI = (window.EAI = window.EAI || {});
	var A = (EAI.actions = {});
	var U = EAI.util;

	/* ------------------------------------------------------------ helpers -- */

	function newId(prefix) {
		return (prefix || 'gge') + Math.floor(Math.random() * 1e9).toString(36) +
			Date.now().toString(36).slice(-4);
	}

	function findComponent(json, designator) {
		if (!json || !json.schlib) return null;
		for (var gid in json.schlib) {
			if (!Object.prototype.hasOwnProperty.call(json.schlib, gid)) continue;
			var ann = json.schlib[gid].annotation;
			if (!ann) continue;
			for (var aid in ann) {
				if (!Object.prototype.hasOwnProperty.call(ann, aid)) continue;
				if (ann[aid].mark === 'P' && ann[aid].string === designator) {
					return { gId: gid, annId: aid, block: json.schlib[gid] };
				}
			}
		}
		return null;
	}

	A.findComponent = findComponent;

	/** Rewrites one parameter of a c_para string, keeping everything else. */
	A.setCParaParam = function (cPara, key, value) {
		var s = String(cPara || '');
		var parts = s.split('`');
		for (var i = 0; i < parts.length - 1; i += 2) {
			if (!parts[i]) continue;
			if (parts[i] === key || parts[i].replace(/^BOM_/, '') === key) {
				parts[i + 1] = String(value);
				return parts.join('`');
			}
		}
		if (s && !/\`$/.test(s)) s += '`';
		return s + key + '`' + String(value) + '`';
	};

	/* -------------------------------------------------- component editing -- */

	/**
	 * Changes the value (a custom parameter) of a component.
	 * @param {string} designator e.g. "R1"
	 * @param {string} value
	 * @param {string} key  parameter name, defaults to "value"
	 */
	A.setComponentValue = function (designator, value, key) {
		var json = EAI.eda.activeJson();
		var hit = findComponent(json, designator);
		if (!hit) return { ok: false, error: 'component ' + designator + ' not found' };

		var shape = EAI.api('getShape', { id: hit.gId, cmdKey: 'schlib' });
		if (!shape || !shape.head) return { ok: false, error: 'cannot read the component' };

		var cPara = shape.head.c_para || '';
		var newCPara = A.setCParaParam(cPara, key || 'value', value);
		if (newCPara === cPara) {
			return { ok: false, error: 'parameter "' + (key || 'value') + '" not found on ' + designator };
		}
		EAI.api('updateShape', {
			shapeType: 'schlib',
			jsonCache: { gId: hit.gId, head: { c_para: newCPara } }
		});
		return { ok: true, designator: designator, value: value, parameter: key || 'value' };
	};

	/**
	 * Writes several library attributes (c_para keys) at once.
	 * @param {string} designator
	 * @param {Object} patch  { package:'0603', 'Manufacturer Part':'HT1621B', … }
	 */
	A.setComponentParams = function (designator, patch) {
		var json = EAI.eda.activeJson();
		var hit = findComponent(json, designator);
		if (!hit) return { ok: false, error: 'component ' + designator + ' not found' };
		if (!patch || !Object.keys(patch).length) return { ok: false, error: 'nothing to write' };

		var shape = EAI.api('getShape', { id: hit.gId, cmdKey: 'schlib' });
		if (!shape || !shape.head) return { ok: false, error: 'cannot read the component' };

		var cPara = shape.head.c_para || '';
		var next = cPara;
		Object.keys(patch).forEach(function (k) {
			if (patch[k] === undefined || patch[k] === null || patch[k] === '') return;
			next = A.setCParaParam(next, k, patch[k]);
		});
		if (next === cPara) return { ok: false, error: 'nothing changed' };

		EAI.api('updateShape', {
			shapeType: 'schlib',
			jsonCache: { gId: hit.gId, head: { c_para: next } }
		});
		return { ok: true, designator: designator, applied: patch };
	};

	/**
	 * Deletes components / shapes by gId or designator.
	 *
	 * api('delete') does not remove jsonCache-imported blocks in practice, so
	 * this rewrites the live document source instead (remove the entry from
	 * its table and from itemOrder, then applySource).
	 *
	 * @param {Object} spec {ids:[gId], designators:['R1']}
	 */
	A.deleteShapes = function (spec) {
		spec = spec || {};
		var ids = Array.isArray(spec.ids) ? spec.ids.slice() : [];
		var missing = [];
		var dryRun = !!spec.dryRun;

		var json;
		try { json = EAI.api('getSource', { type: 'json' }); }
		catch (e) { return { ok: false, error: 'cannot read the document: ' + e, missing: missing }; }
		if (!json) return { ok: false, error: 'empty document', missing: missing };

		/* designators → component ids */
		(spec.designators || []).forEach(function (d) {
			var hit = findComponent(json, String(d).trim());
			if (hit) ids.push(hit.gId);
			else missing.push(String(d).trim());
		});

		/* net label names → label ids */
		(spec.netLabels || []).forEach(function (name) {
			var want = String(name || '').trim().toUpperCase();
			var hit = false;
			Object.keys(json.netlabel || {}).forEach(function (lid) {
				var nl = json.netlabel[lid] || {};
				if (String(nl.name || '').trim().toUpperCase() === want) {
					ids.push(lid);
					hit = true;
				}
			});
			if (!hit) missing.push('label:' + name);
		});

		/* wire ids */
		(spec.wires || []).forEach(function (wid) {
			if (json.wire && Object.prototype.hasOwnProperty.call(json.wire, wid)) ids.push(wid);
			else missing.push('wire:' + wid);
		});

		ids = ids.filter(function (v, i, a) { return !!v && a.indexOf(v) === i; });
		if (!ids.length) return { ok: false, error: 'nothing to delete', missing: missing };

		var TABLES = ['schlib', 'wire', 'bus', 'polyline', 'polygon', 'rect', 'ellipse',
			'circle', 'path', 'arc', 'line', 'text', 'annotation', 'junction',
			'netlabel', 'netflag', 'busentry', 'arrowhead', 'noconnectflag', 'image',
			'FOOTPRINT', 'TRACK', 'COPPERAREA', 'SOLIDREGION', 'RECT', 'CIRCLE',
			'TEXT', 'ARC', 'DIMENSION', 'PAD', 'VIA', 'HOLE', 'SVGNODE'];

		var found = [];
		ids.forEach(function (id) {
			var kinds = [];
			TABLES.forEach(function (t) {
				if (json[t] && Object.prototype.hasOwnProperty.call(json[t], id)) kinds.push(t);
			});
			var inOrder = Array.isArray(json.itemOrder) && json.itemOrder.indexOf(id) >= 0;
			if (kinds.length || inOrder) found.push({ id: id, kinds: kinds });
			else missing.push(id);
		});
		if (!found.length) return { ok: false, error: 'ids not found in the document', missing: missing };

		if (dryRun) {
			return {
				ok: true, dryRun: true, count: found.length,
				list: found.map(function (f) { return f.id + ' (' + (f.kinds[0] || 'item') + ')'; }),
				missing: missing
			};
		}

		found.forEach(function (f) {
			TABLES.forEach(function (t) {
				if (json[t]) delete json[t][f.id];
			});
			if (Array.isArray(json.itemOrder)) {
				json.itemOrder = json.itemOrder.filter(function (x) { return x !== f.id; });
			}
		});

		try {
			EAI.api('applySource', { source: json, createNew: false });
		} catch (e2) {
			return { ok: false, error: 'applySource failed: ' + e2, missing: missing };
		}
		return {
			ok: true, deleted: found.length,
			list: found.map(function (f) { return f.id + ' (' + (f.kinds[0] || 'item') + ')'; }),
			missing: missing
		};
	};

	/** Non-component graphics: wires, net labels, junction, net flags. */
	A.listGraphics = function (opts) {
		opts = opts || {};
		var json = null;
		try { json = EAI.api('getSource', { type: 'json' }); } catch (e) { return []; }
		if (!json) return [];
		var out = [], cap = Math.min(Number(opts.limit) || 300, 800);

		function pts(arr) {
			return (arr || []).map(function (p) { return Number(p.x) + ',' + Number(p.y); }).join(' ');
		}
		Object.keys(json.wire || {}).forEach(function (id) {
			var w = json.wire[id] || {};
			out.push({ type: 'wire', id: id, points: pts(w.pointArr).slice(0, 120) });
		});
		Object.keys(json.netlabel || {}).forEach(function (id) {
			var n = json.netlabel[id] || {};
			var p = n.pinDot || {};
			out.push({ type: 'netlabel', id: id, name: n.name || '', x: Number(p.x), y: Number(p.y) });
		});
		Object.keys(json.netflag || {}).forEach(function (id) {
			var n = json.netflag[id] || {};
			var p = n.pinDot || {};
			var nm = (n.mark && n.mark.netFlagString) || (n.configure && n.configure.partId) || '';
			out.push({ type: 'netflag', id: id, name: String(nm), x: Number(p.x), y: Number(p.y) });
		});
		return out.slice(0, cap);
	};

	/** Pin coordinates of an existing component. */
	A.getPins = function (designator) {
		var json = null;
		try { json = EAI.api('getSource', { type: 'json' }); } catch (e) { return null; }
		var hit = findComponent(json || {}, String(designator || '').trim());
		if (!hit) return null;
		var shape = null;
		try { shape = EAI.api('getShape', { id: hit.gId, cmdKey: 'schlib' }); }
		catch (e) { return null; }
		if (!shape) return null;
		return Object.keys(shape.pin || {}).map(function (pid) {
			var p = shape.pin[pid];
			return {
				number: (p.num && p.num.text) || '',
				name: (p.name && p.name.text) || '',
				type: String(p.configure && p.configure.electric !== undefined ? p.configure.electric : ''),
				x: Number(p.pinDot && p.pinDot.x),
				y: Number(p.pinDot && p.pinDot.y)
			};
		});
	};

	/** Renames a component (its designator / prefix). */
	A.setComponentDesignator = function (designator, newDesignator) {
		var json = EAI.eda.activeJson();
		var hit = findComponent(json, designator);
		if (!hit) return { ok: false, error: 'component ' + designator + ' not found' };
		if (!newDesignator) return { ok: false, error: 'new designator is empty' };

		var patch = { gId: hit.gId, annotation: {} };
		patch.annotation[hit.annId] = { string: newDesignator };
		EAI.api('updateShape', { shapeType: 'schlib', jsonCache: patch });
		return { ok: true, designator: designator, newDesignator: newDesignator };
	};

	/**
	 * Applies a list of edits:
	 *   [{designator:'R1', value:'10k'}, {designator:'C1', designator:'C7'}]
	 */
	A.applyEdits = function (edits) {
		var results = [], i;
		for (i = 0; i < (edits || []).length; i++) {
			var e = edits[i];
			if (!e || !e.designator) continue;
			var r = { designator: e.designator };
			if (e.newDesignator || e.designator2) {
				var rd = A.setComponentDesignator(e.designator,
					e.newDesignator || e.designator2);
				r.designatorResult = rd;
			}
			if (e.value !== undefined && e.value !== null && e.value !== '') {
				var rv = A.setComponentValue(e.designator, e.value, e.parameter || 'value');
				r.valueResult = rv;
			}
			results.push(r);
		}
		return results;
	};

	/* ------------------------------------------------------------ drawing -- */

	/** Draws a wire through the given points. */
	/** Placement grid (snap size, falling back to the visible grid). */
	A.gridStep = function () {
		try {
			var c = EAI.eda.canvasInfo ? EAI.eda.canvasInfo() : {};
			var s = Number(c.snapSize) || Number(c.gridSize) || 10;
			return s > 0 ? s : 10;
		} catch (e) { return 10; }
	};

	/** Every point a wire / net label can electrically attach to. */
	A.electricalPoints = function (json) {
		json = json || EAI.eda.activeJson() || {};
		var pts = [];
		Object.keys(json.schlib || {}).forEach(function (gid) {
			if (/^frame/i.test(gid)) return;
			var b = json.schlib[gid];
			Object.keys(b.pin || {}).forEach(function (pid) {
				var pd = b.pin[pid] && b.pin[pid].pinDot;
				if (pd) pts.push({ x: Number(pd.x), y: Number(pd.y) });
			});
		});
		Object.keys(json.wire || {}).forEach(function (wid) {
			var pa = (json.wire[wid] && json.wire[wid].pointArr) || [];
			if (!pa.length) return;
			pts.push({ x: Number(pa[0].x), y: Number(pa[0].y) });
			var last = pa[pa.length - 1];
			pts.push({ x: Number(last.x), y: Number(last.y) });
		});
		Object.keys(json.netlabel || {}).forEach(function (nid) {
			var n = json.netlabel[nid] || {};
			var p = n.pinDot || n;
			if (p && isFinite(Number(p.x))) pts.push({ x: Number(p.x), y: Number(p.y) });
		});
		return pts;
	};

	/** Nearest electrical point within tol (Manhattan distance). */
	A.snapPoint = function (x, y, tol) {
		var pts = A.electricalPoints();
		var best = null, bd = Infinity;
		pts.forEach(function (p) {
			if (!isFinite(p.x) || !isFinite(p.y)) return;
			var d = Math.abs(p.x - x) + Math.abs(p.y - y);
			if (d < bd) { bd = d; best = p; }
		});
		if (best && bd <= (tol || 0)) return { x: best.x, y: best.y, snapped: true, dist: bd };
		return { x: x, y: y, snapped: false };
	};

	/** Bounding box of a placed symbol (rect/polyline/pins/annotations). */
	A.bboxOfShape = function (shape) {
		if (!shape) return null;
		var xs = [], ys = [];
		function acc(x, y) {
			x = Number(x); y = Number(y);
			if (isFinite(x) && isFinite(y)) { xs.push(x); ys.push(y); }
		}
		Object.keys(shape.rect || {}).forEach(function (id) {
			var r = shape.rect[id];
			acc(r.x, r.y);
			acc(Number(r.x) + Number(r.width), Number(r.y) + Number(r.height));
		});
		['polyline', 'polygon', 'path', 'arc'].forEach(function (kind) {
			Object.keys(shape[kind] || {}).forEach(function (id) {
				var o = shape[kind][id];
				(o.pointArr || []).forEach(function (p) { acc(p.x, p.y); });
			});
		});
		Object.keys(shape.pin || {}).forEach(function (id) {
			var p = shape.pin[id];
			acc(p.pinDot && p.pinDot.x, p.pinDot && p.pinDot.y);
			if (p.configure) acc(p.configure.x, p.configure.y);
		});
		Object.keys(shape.annotation || {}).forEach(function (id) {
			var a = shape.annotation[id];
			acc(a.x, a.y);
		});
		if (!xs.length) return null;
		var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
		var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
		return {
			x: minX, y: minY,
			width: Math.round((maxX - minX) * 10) / 10,
			height: Math.round((maxY - minY) * 10) / 10
		};
	};

	/** Makes sure the placed block really carries the designator we assigned. */
	A.ensureDesignator = function (gId, designator) {
		if (!gId || !designator) return designator || '';
		try {
			var shape = EAI.api('getShape', { id: gId, cmdKey: 'schlib' });
			var ann = (shape && shape.annotation) || {};
			var cur = '', patch = {};
			Object.keys(ann).forEach(function (k) {
				var a = ann[k];
				if (a && a.mark === 'P') {
					cur = String(a.string || '');
					patch[k] = { string: String(designator) };
				}
			});
			if (cur !== String(designator) && Object.keys(patch).length) {
				EAI.api('updateShape', {
					shapeType: 'schlib',
					jsonCache: { gId: gId, annotation: patch }
				});
			}
		} catch (e) { /* ignore */ }
		return String(designator);
	};

	/**
	 * createShape() can shift an imported block by a few units, which drops
	 * the pins off the grid again — nudge the placed component by the residual
	 * and return the refreshed shape.
	 */
	A.gridAlignComponent = function (gId, step) {
		step = step || A.gridStep();
		try {
			var s = EAI.api('getShape', { id: gId, cmdKey: 'schlib' });
			var ids = Object.keys((s && s.pin) || {});
			if (!ids.length) return s;
			var pd = s.pin[ids[0]].pinDot || {};
			var dx = A.gridSnap(pd.x, step) - Number(pd.x);
			var dy = A.gridSnap(pd.y, step) - Number(pd.y);
			if (Math.abs(dx) > 1e-6 || Math.abs(dy) > 1e-6) {
				EAI.api('moveObjs', { objs: [gId], addX: dx, addY: dy });
				s = EAI.api('getShape', { id: gId, cmdKey: 'schlib' });
			}
			return s;
		} catch (e) { return null; }
	};

	/** Rounds a value to the placement grid. */
	A.gridSnap = function (v, step) {
		step = step || A.gridStep();
		return Math.round(Number(v) / step) * step;
	};

	A.createWire = function (points, style) {
		if (!points || points.length < 2) return { ok: false, error: 'a wire needs at least two points' };
		style = style || {};
		var step = A.gridStep();
		points = points.map(function (p) {
			var s = A.snapPoint(p.x, p.y, step * 1.2);
			return { x: s.x, y: s.y };
		});
		/* wire geometry lives in pointArr of the jsonCache — the flat
		   `points` parameter is ignored by createShape for wires */
		EAI.api('createShape', {
			shapeType: 'wire',
			jsonCache: {
				gId: newId('gge'),
				pointArr: points.map(function (p) { return { x: p.x, y: p.y }; }),
				strokeColor: style.stroke || '#008800',
				strokeWidth: style.width || 1,
				strokeStyle: style.style || '',
				locked: false
			}
		});
		return { ok: true, points: points.length, first: points[0], last: points[points.length - 1] };
	};

	/** Places a net label (the named anchor of a net). */
	A.createNetLabel = function (x, y, name, rotation) {
		var step = A.gridStep();
		var sn = A.snapPoint(x, y, step * 1.2);
		if (!sn.snapped) { sn = { x: A.gridSnap(x, step), y: A.gridSnap(y, step) }; }
		x = sn.x;
		y = sn.y;
		var cache = {
			gId: newId('netlabel'),
			x: x, y: y,
			pinDot: { x: x, y: y },
			name: name,
			rotation: rotation || 0,
			textAnchor: 'start',
			fontFamily: 'Times New Roman',
			fontSize: '9pt',
			fillColor: '#000000',
			locked: false
		};
		EAI.api('createShape', { shapeType: 'netlabel', jsonCache: cache });
		return { ok: true, name: name, x: x, y: y };
	};

	/** Places a junction dot. */
	A.createJunction = function (x, y) {
		EAI.api('createShape', {
			shapeType: 'junction',
			jsonCache: {
				gId: newId('junction'),
				pinDot: { x: x, y: y },
				r: 3,
				fillColor: '#000000',
				locked: false
			}
		});
		return { ok: true, x: x, y: y };
	};

	/** Places a plain text annotation (useful for notes). */
	A.createText = function (x, y, text, style) {
		style = style || {};
		EAI.api('createShape', {
			shapeType: 'text',
			x: x, y: y,
			text: text,
			stroke: 'none',
			fill: style.fill || '#000000',
			'font-family': style.fontFamily || 'Verdana',
			'font-size': style.fontSize || '9pt',
			rotation: style.rotation || 0
		});
		return { ok: true, x: x, y: y, text: text };
	};

	/* ----------------------------------------------------------- symbols -- */

	var DEFAULT_FONT = 'Arial';

	/*
	 * A pin of a schematic symbol.
	 *
	 * IMPORTANT — all coordinates inside a component are ABSOLUTE canvas
	 * coordinates (the editor stores them that way and rotates the children
	 * when the part is turned):
	 *   configure.x / configure.y  the end of the pin that touches the body
	 *   pinDot.x    / pinDot.y     the electrical connection point
	 *   path.pathString            "M <configure.x> <configure.y> h <dx>"
	 *
	 * The spec below is written in coordinates RELATIVE to the symbol origin;
	 * createSymbol() shifts them to absolute coordinates.
	 */
	function buildPin(id, pin, ox, oy) {
		var bx = pin.x + ox;            /* body end        */
		var by = pin.y + oy;
		var dx = pin.dx === undefined ? 0 : pin.dx;
		var dy = pin.dy === undefined ? 0 : pin.dy;
		var dotX = pin.dotX === undefined ? bx + dx : pin.dotX + ox;
		var dotY = pin.dotY === undefined ? by + dy : pin.dotY + oy;

		/* the path has to be written absolutely, starting at the body end */
		var path = pin.path ||
			('M ' + bx + ' ' + by + ' ' +
				(dy ? 'v ' + dy : 'h ' + dx));

		/* pin name sits inside the body, the number just outside the pin line */
		var nameX, nameY, nameAnchor = 'start', nameRot = 0;
		var numX, numY, numAnchor = 'start';
		if (dx) {
			var toRight = dx > 0;
			nameX = bx + (toRight ? -4 : 4);
			nameAnchor = toRight ? 'end' : 'start';
			nameY = by + 1;
			numX = bx + (toRight ? 2 : -2);
			numAnchor = toRight ? 'start' : 'end';
			numY = by - 3;
		} else {
			var down = dy > 0;
			nameX = bx + 4;
			nameY = by + (down ? -4 : 4);
			nameRot = 270;
			numX = bx - 3;
			numY = by + (down ? 2 : -2);
			numAnchor = 'end';
		}

		return {
			gId: id,
			locked: false,
			configure: {
				x: bx,
				y: by,
				rotation: pin.rotation || 0,
				electric: pin.electric || 'passive',
				spicePin: pin.number === undefined ? '' : String(pin.number),
				display: pin.visible === false ? 'hide' : 'show',
				shapeType: 'group',
				gId: id,
				locked: false
			},
			name: {
				x: (pin.nameX === undefined ? nameX : pin.nameX + ox),
				y: (pin.nameY === undefined ? nameY : pin.nameY + oy),
				text: pin.name || '',
				visible: pin.showName !== false && !!pin.name,
				rotation: nameRot,
				textAnchor: nameAnchor,
				fontFamily: '',
				fontSize: '',
				fillColor: '#0000FF'
			},
			num: {
				x: (pin.numX === undefined ? numX : pin.numX + ox),
				y: (pin.numY === undefined ? numY : pin.numY + oy),
				text: pin.number === undefined ? '' : String(pin.number),
				visible: pin.showNumber !== false,
				rotation: 0,
				textAnchor: numAnchor,
				fontFamily: '',
				fontSize: '',
				fillColor: '#0000FF'
			},
			pinDot: { x: dotX, y: dotY },
			path: {
				pathString: path,
				pinColor: pin.pinColor || '#880000'
			},
			/*
			 * bc.pin() unconditionally reads pin.dot.visible and
			 * pin.clock.visible — leaving them out makes the serializer throw
			 * "Cannot read properties of undefined (reading 'visible')".
			 */
			dot: {
				visible: pin.dotVisible ? 1 : 0,
				x: dotX,
				y: dotY
			},
			clock: {
				visible: 0,
				pathString: ''
			}
		};
	}

	function buildAnnotation(id, ann, ox, oy) {
		return {
			gId: id,
			mark: ann.mark || 'L',
			string: ann.string || '',
			x: (ann.x || 0) + ox,
			y: (ann.y || 0) + oy,
			rotation: ann.rotation || 0,
			visible: ann.visible !== false,
			textAnchor: ann.textAnchor || 'start',
			fontFamily: ann.fontFamily || DEFAULT_FONT,
			fontSize: ann.fontSize || '9pt',
			fontWeight: ann.fontWeight || '',
			fontStyle: ann.fontStyle || '',
			dominantBaseline: ann.dominantBaseline || 'auto',
			c_etype: 'annotation',
			locked: false
		};
	}

	/**
	 * Builds the json cache of a schematic symbol and imports it.
	 *
	 * @param {Object} spec
	 *   name     symbol name shown in the library        (e.g. "R")
	 *   pre      designator prefix                       (e.g. "R")
	 *   package  footprint / package name                (e.g. "0603")
	 *   x, y     position of the symbol on the canvas
	 *   rotation rotation in degrees
	 *   pins     [{number, name, x, y, dotX, dotY, path, rotation, electric}]
	 *   texts    [{x, y, string, mark}]                  optional annotations
	 * @returns {Object} {ok, error}
	 */
	/**
	 * Builds the body rectangle of a symbol from its pin positions.
	 * The body spans the pin attachment points (p.x / p.y), so a normal
	 * two-column part gets a rectangle between the two pin columns.
	 */
	function bodyRect(spec, ox, oy) {
		var xs = [], ys = [];
		(spec.pins || []).forEach(function (p) {
			var x = Number(p.x), y = Number(p.y);
			if (isFinite(x)) xs.push(x);
			if (isFinite(y)) ys.push(y);
		});
		if (!xs.length) { xs = [0]; ys = [0]; }

		var minX = Math.min.apply(null, xs);
		var maxX = Math.max.apply(null, xs);
		var minY = Math.min.apply(null, ys);
		var maxY = Math.max.apply(null, ys);

		/* a body needs some area even when all pins sit on one line */
		if (maxX - minX < 20) {
			var cx = (minX + maxX) / 2;
			minX = cx - 20; maxX = cx + 20;
		}
		var top = minY - 10;
		var bottom = maxY + 10;
		if (bottom - top < 20) {
			var cy = (minY + maxY) / 2;
			top = cy - 20; bottom = cy + 20;
		}

		return {
			x: minX + ox,
			y: top + oy,
			width: maxX - minX,
			height: bottom - top
		};
	}

	/**
	 * Builds the json cache of a schematic symbol and imports it.
	 *
	 * The symbol consists of INDEPENDENT primitives, exactly like a hand made
	 * library symbol: one `rect` body + one `pin` group per pin + annotations.
	 *
	 * @param {Object} spec
	 *   name / package / pre          library attributes written into c_para
	 *   manufacturerPart / manufacturer / supplier / supplierPart   optional
	 *   x, y, rotation                placement
	 *   pins [{number,name,x,y,dx,dy,dotX,dotY,electric}]
	 *   texts [{x,y,string,mark}]     extra annotations (value, part number…)
	 */
	A.createSymbol = function (spec) {
		if (!spec || !spec.pins || !spec.pins.length) {
			return { ok: false, error: 'the symbol needs at least one pin' };
		}

		var gid = newId('gge');
		/* keep the symbol inside the sheet frame */
		var pos = A.clampToSheet(spec.x || 0, spec.y || 0);
		var originX = pos.x;
		var originY = pos.y;
		var kind = EAI.eda.docKind();
		/* "U?" from the model is normalised: createSymbol adds the '?' back */
		var pre = String(spec.pre || 'U').replace(/\?+$/, '') || 'U';

		/* ---- library attributes (c_para) -------------------------------- */
		var para = {
			name: spec.name || '',
			package: spec.package || '',
			pre: pre
		};
		if (spec.value) para.value = spec.value;
		if (spec.manufacturerPart) para['Manufacturer Part'] = spec.manufacturerPart;
		if (spec.manufacturer) para.Manufacturer = spec.manufacturer;
		if (spec.supplier) para.Supplier = spec.supplier;
		if (spec.supplierPart) para['Supplier Part'] = spec.supplierPart;

		var block = {
			head: {
				gId: gid,
				x: originX,
				y: originY,
				rotation: spec.rotation || 0,
				c_para: EAI.eda.jsonToCPara(para),
				locked: false,
				puuid: '',
				uuid: newId('uuid'),
				convert_to_pcb: '',
				datastrid: '',
				pdatastrid: '',
				utime: '',
				add_into_bom: 'yes'
			},
			itemOrder: [],
			rect: {},
			pin: {},
			annotation: {}
		};

		var order = [];

		/* ---- body rectangle first --------------------------------------- */
		var rectId = newId('gge');
		var br = bodyRect(spec, originX, originY);
		block.rect[rectId] = {
			gId: rectId,
			x: br.x,
			y: br.y,
			width: br.width,
			height: br.height,
			rx: 0,
			ry: 0,
			strokeColor: spec.bodyStroke || '#880000',
			strokeWidth: 1,
			strokeStyle: 0,
			fillColor: spec.bodyFill || 'none',
			locked: false,
			c_etype: ''
		};
		order.push(rectId);

		/* ---- one independent pin per pin -------------------------------- */
		spec.pins.forEach(function (p) {
			var pid = newId('gge');
			block.pin[pid] = buildPin(pid, p, originX, originY);
			order.push(pid);
		});

		/* ---- designator + name annotations ------------------------------ */
		var preText = spec.designator || (pre + '?');
		var preAnn = {
			mark: 'P', string: preText,
			x: spec.preX === undefined ? br.x - originX + 4 : spec.preX,
			y: spec.preY === undefined ? br.y - originY - 4 : spec.preY,
			visible: spec.showPre !== false
		};
		var nameAnn = {
			mark: 'N', string: spec.value || spec.name || '',
			x: spec.nameX === undefined ? br.x - originX + 4 : spec.nameX,
			y: spec.nameY === undefined ? br.y - originY + br.height + 12 : spec.nameY,
			visible: spec.showName !== false && !!spec.name
		};
		var aid1 = newId('gge');
		block.annotation[aid1] = buildAnnotation(aid1, preAnn, originX, originY);
		order.push(aid1);
		var aid2 = newId('gge');
		block.annotation[aid2] = buildAnnotation(aid2, nameAnn, originX, originY);
		order.push(aid2);

		block.itemOrder = order;

		try {
			EAI.api('createShape', {
				shapeType: 'schlib',
				jsonCache: block,
				x: 0, y: 0,
				rotation: 0
			});
		} catch (e) {
			return { ok: false, error: 'importing the symbol failed: ' + e };
		}

		/*
		 * In a symbol-library document the library attributes live in the
		 * DOCUMENT head c_para (that is what the library tree shows), and the
		 * import path does not copy the component's c_para there.  Write them
		 * explicitly.
		 */
		if (kind === 'schlib') {
			var docPara = {};
			Object.keys(para).forEach(function (k) {
				if (para[k] !== '' && para[k] !== undefined) docPara[k] = para[k];
			});
			Object.keys(docPara).forEach(function (k) {
				try { EAI.eda.editorCall('setCustomPara', [k, docPara[k]]); }
				catch (e) { EAI.log('setCustomPara(' + k + ') failed: ' + e, 'error'); }
			});
		}

		return {
			ok: true,
			gId: gid,
			x: originX,
			y: originY,
			name: para.name,
			package: para.package,
			manufacturerPart: para['Manufacturer Part'] || '',
			pinCount: spec.pins.length,
			hasBody: true
		};
	};

	/* ------------------------------------------------- standard part kit -- */

	/**
	 * A tiny library of standard symbols so that the AI can place real
	 * components without needing a library UUID.
	 * Coordinates are relative to the symbol origin.
	 */
	/* 常用器件模板集中放在 parts.js（EAI.parts）；这里只保留引用。 */
	A.PART_LIBRARY = (EAI.parts && EAI.parts.LIBRARY) || {};

	/* 参数化兜底：只有系统库模板里没有的器件才走这里（例如晶振、通用 IC）。 */
	A.PARAM_LIB = {
		XTAL: {
			name: 'XTAL', pre: 'Y', package: 'HC-49S',
			pins: [
				{ number: '1', name: '', x: -15, y: 0, dx: -10, dotX: -25, dotY: 0, electric: 'passive' },
				{ number: '2', name: '', x: 15, y: 0, dx: 10, dotX: 25, dotY: 0, electric: 'passive' }
			],
			texts: []
		},
		GENERIC: { name: 'U', pre: 'U', package: '', pins: [], texts: [] }
	};

	/** Generates a rectangular n pin symbol. */
	A.genericSymbol = function (pinCount, opts) {
		opts = opts || {};
		var n = Math.max(2, Math.min(pinCount || 2, 48));
		var names = Array.isArray(opts.pinNames) ? opts.pinNames : [];
		var maxLen = 4;
		names.forEach(function (t) { maxLen = Math.max(maxLen, String(t || '').length); });

		/* body wide enough for the longest pin name, pins every 10 units */
		var bodyW = opts.bodyWidth || Math.max(40, Math.min(150, maxLen * 7 + 24));
		var bodyH = (Math.ceil(n / 2) + 1) * 10;
		var pins = [], half = Math.ceil(n / 2), i, side, idx, y;

		for (i = 0; i < n; i++) {
			side = i < half ? 0 : 1;
			idx = side === 0 ? i : i - half;
			y = bodyH / 2 - (idx + 1) * 10;
			pins.push({
				number: String(i + 1),
				name: names[i] || '',
				x: side === 0 ? -bodyW / 2 : bodyW / 2,
				y: y,
				dotX: side === 0 ? -bodyW / 2 - 10 : bodyW / 2 + 10,
				dotY: y,
				dx: side === 0 ? -10 : 10,
				electric: 'passive'
			});
		}
		return {
			name: opts.name || 'U', pre: opts.pre || 'U',
			package: opts.package || '',
			pins: pins, texts: []
		};
	};

	/**
	 * Places a part of the built-in library.
	 * @param {Object} spec {part:'R', x, y, rotation, value, designator}
	 */
	/**
	 * Drawing area of the current sheet, in schematic units.
	 * The sheet frame itself is a schlib block (gId starts with "frame"), so
	 * its position gives the real paper size; canvas size is the fallback.
	 */
	A.sheetBounds = function () {
		var json = EAI.eda.activeJson() || {};
		var w = 1000, h = 1000;
		try {
			if (json.canvas) {
				w = Number(json.canvas.canvasWidth) || w;
				h = Number(json.canvas.canvasHeight) || h;
			}
		} catch (e) { /* ignore */ }

		/* the sheet frame is itself a schlib block; its own geometry is the
		   only reliable source (head.x/y is often 0 while the drawing spans
		   positive and negative coordinates) */
		var frame = null;
		if (json.schlib) {
			for (var gid in json.schlib) {
				if (!Object.prototype.hasOwnProperty.call(json.schlib, gid)) continue;
				var blk = json.schlib[gid];
				var head = blk && blk.head;
				if (!head) continue;
				if (/^frame/i.test(String(head.gId || '')) ||
					/frame_lib/i.test(String(head.c_para || ''))) { frame = blk; break; }
			}
		}

		if (frame) {
			var xs = [], ys = [];
			function acc(x, y) {
				x = Number(x); y = Number(y);
				if (isFinite(x) && isFinite(y)) { xs.push(x); ys.push(y); }
			}
			Object.keys(frame.polyline || {}).forEach(function (id) {
				var p = frame.polyline[id];
				(p.pointArr || []).forEach(function (pt) { acc(pt.x, pt.y); });
			});
			Object.keys(frame.polygon || {}).forEach(function (id) {
				var p = frame.polygon[id];
				(p.pointArr || []).forEach(function (pt) { acc(pt.x, pt.y); });
			});
			Object.keys(frame.rect || {}).forEach(function (id) {
				var r = frame.rect[id];
				var x = Number(r.x), y = Number(r.y);
				var rw = Number(r.width), rh = Number(r.height);
				acc(x, y);
				if (isFinite(rw) && isFinite(rh)) { acc(x + rw, y + rh); }
			});

			if (xs.length >= 4) {
				var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
				var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
				if (maxX - minX > 100 && maxY - minY > 100) {
					var pad = 10;
					return {
						minX: minX + pad, minY: minY + pad,
						maxX: maxX - pad, maxY: maxY - pad,
						width: maxX - minX, height: maxY - minY
					};
				}
			}
		}

		var m = 20;
		return {
			minX: m, minY: m,
			maxX: Math.max(m + 20, w - m), maxY: Math.max(m + 20, h - m),
			width: w, height: h
		};
	};

	/** Keeps a placement inside the sheet frame. */
	A.clampToSheet = function (x, y) {
		var b = A.sheetBounds();
		var nx = Math.min(b.maxX, Math.max(b.minX, Number(x) || b.minX));
		var ny = Math.min(b.maxY, Math.max(b.minY, Number(y) || b.minY));
		return { x: nx, y: ny, clamped: nx !== Number(x) || ny !== Number(y) };
	};

	/**
	 * Next free designator for a prefix (R, C, Q…).  API placement does not
	 * number parts, so we scan the document (plus the current batch) and pick
	 * the first unused number.
	 */
	var designatorRegistry = {};   /* numbers handed out in this session */

	A.nextDesignator = function (prefix, used) {
		prefix = String(prefix || 'U').replace(/[^A-Za-z]/g, '') || 'U';
		used = used || {};
		var re = new RegExp('^' + prefix + '(\d+)$');
		var max = 0;

		/* numbers already handed out in this session: the editor may not have
		   surfaced freshly placed blocks in getSource yet, which is what used
		   to produce duplicate designators */
		Object.keys(designatorRegistry).forEach(function (d) {
			var m = re.exec(d);
			if (m) max = Math.max(max, Number(m[1]));
		});

		/* numbers already present in the document */
		var comps = [];
		try {
			var fresh = EAI.api('getSource', { type: 'json' });
			comps = EAI.eda.components(fresh || {}) || [];
		} catch (e) { comps = []; }
		comps.forEach(function (c) {
			var m = re.exec(String(c.designator || ''));
			if (m) max = Math.max(max, Number(m[1]));
		});

		var n = max + 1;
		while (designatorRegistry[prefix + n] || used[prefix + n]) n++;
		designatorRegistry[prefix + n] = true;
		used[prefix + n] = true;
		return prefix + n;
	};

	/**
	 * createShape() re-imports a jsonCache block and rebuilds its designator /
	 * value annotations from library defaults, so the designator prefix and
	 * value must be written back afterwards with updateShape().
	 */
	A.applyTemplateMeta = function (gId, opts) {
		opts = opts || {};
		var pre = String(opts.pre || 'U').replace(/\?+$/, '') || 'U';
		var shape = null;
		try { shape = EAI.api('getShape', { id: gId, cmdKey: 'schlib' }); }
		catch (e) { return false; }
		if (!shape || !shape.head) return false;

		var cp = shape.head.c_para || '';
		cp = A.setCParaParam(cp, 'pre', pre);
		if (opts.value) {
			cp = A.setCParaParam(cp, 'value', opts.value);
			/* the library may store the value under a decorated key */
			var segs = cp.split('`');
			for (var i = 0; i + 1 < segs.length; i += 2) {
				if (/^value\(/.test(segs[i])) segs[i + 1] = String(opts.value);
			}
			cp = segs.join('`');
		}
		if (opts.package) cp = A.setCParaParam(cp, 'package', opts.package);
		if (opts.mpn) cp = A.setCParaParam(cp, 'Manufacturer Part', opts.mpn);
		if (opts.manufacturer) cp = A.setCParaParam(cp, 'Manufacturer', opts.manufacturer);
		if (opts.supplierPart) cp = A.setCParaParam(cp, 'Supplier Part', opts.supplierPart);

		var annPatch = {};
		Object.keys(shape.annotation || {}).forEach(function (id) {
			var a = shape.annotation[id];
			if (!a) return;
			if (a.mark === 'P') annPatch[id] = { string: opts.designator || (pre + '?') };
			else if (a.mark === 'N' && (opts.value || opts.name)) {
				annPatch[id] = { string: String(opts.value || opts.name) };
			}
		});

		try {
			EAI.api('updateShape', {
				shapeType: 'schlib',
				jsonCache: { gId: gId, head: { c_para: cp }, annotation: annPatch }
			});
			return true;
		} catch (e) {
			return false;
		}
	};

	/** Places one REAL library device (uuid from search_library). */
	A.placeDevice = function (spec) {
		var uuid = String((spec && spec.uuid) || '').trim();
		if (!uuid) return { ok: false, error: 'uuid is required' };
		var pos = A.clampToSheet(spec.x, spec.y);

		var before = {};
		try {
			var j0 = EAI.api('getSource', { type: 'json' }) || {};
			Object.keys(j0.schlib || {}).forEach(function (k) { before[k] = 1; });
		} catch (e) { /* ignore */ }

		try {
			EAI.api('createShape', {
				shapeType: 'schlib',
				uuid: uuid,
				docType: String(spec.docType || '2'),
				x: pos.x, y: pos.y,
				rotation: Number(spec.rotation) || 0
			});
		} catch (e) {
			return { ok: false, error: 'createShape failed: ' + e };
		}

		/* find the block that just appeared and report it back, so the model
		   never needs to "re-create" a library part */
		var gId = null, pins = [], designator = '', prefix = 'U';
		try {
			var j1 = EAI.api('getSource', { type: 'json' }) || {};
			Object.keys(j1.schlib || {}).forEach(function (k) {
				if (!before[k] && !gId) gId = k;
			});
			if (gId) {
				var shape = EAI.api('getShape', { id: gId, cmdKey: 'schlib' });
				var cp = String((shape && shape.head && shape.head.c_para) || '');
				var m = /(?:^|`)pre`([^`]*)`/.exec(cp) || /spicePre`([^`]*)`/.exec(cp);
				if (m && m[1]) prefix = m[1];
				pins = Object.keys((shape && shape.pin) || {}).map(function (pid) {
					var p = shape.pin[pid];
					return {
						number: (p.num && p.num.text) || '',
						name: (p.name && p.name.text) || '',
						x: Number(p.pinDot && p.pinDot.x),
						y: Number(p.pinDot && p.pinDot.y)
					};
				});
				var pAnn = Object.keys((shape && shape.annotation) || {}).map(function (k) {
					return shape.annotation[k];
				}).filter(function (a) { return a && a.mark === 'P'; })[0];
				designator = (pAnn && pAnn.string) || '';
			}
		} catch (e) { /* ignore */ }

		return {
			ok: true, x: pos.x, y: pos.y, clamped: pos.clamped, uuid: uuid,
			gId: gId, pins: pins, designator: designator, prefix: prefix
		};
	};

	/**
	 * Like placeDevice, but the editor adds a library part asynchronously, so
	 * this polls the document until the new block shows up (max ~2 s) and then
	 * reports its designator / pins.
	 */
	A.placeDeviceAsync = function (spec) {
		spec = spec || {};
		var uuid = String(spec.uuid || '').trim();
		if (!uuid) return Promise.resolve({ ok: false, error: 'uuid is required' });
		var pos = A.clampToSheet(spec.x, spec.y);

		function fresh() {
			try { return EAI.api('getSource', { type: 'json' }) || {}; }
			catch (e) { return {}; }
		}

		var before = {};
		var j0 = fresh();
		Object.keys(j0.schlib || {}).forEach(function (k) { before[k] = 1; });

		try {
			EAI.api('createShape', {
				shapeType: 'schlib',
				uuid: uuid,
				docType: String(spec.docType || '2'),
				x: pos.x, y: pos.y,
				rotation: Number(spec.rotation) || 0
			});
		} catch (e) {
			return Promise.resolve({ ok: false, error: 'createShape failed: ' + e });
		}

		return new Promise(function (resolve) {
			var tries = 0;

			function findNew() {
				var j = fresh(), gid = null;
				Object.keys(j.schlib || {}).forEach(function (k) {
					if (!before[k] && !gid) gid = k;
				});
				return gid;
			}

			function finish(gid) {
				var out = {
					ok: true, x: pos.x, y: pos.y, clamped: pos.clamped, uuid: uuid,
					gId: gid, pins: [], designator: '', prefix: 'U'
				};
				if (gid) {
					try {
						var shape = EAI.api('getShape', { id: gid, cmdKey: 'schlib' });
						var cp = String((shape && shape.head && shape.head.c_para) || '');
						var m = /(?:^|`)pre`([^`]*)`/.exec(cp) || /spicePre`([^`]*)`/.exec(cp);
						if (m && m[1]) out.prefix = m[1];
						out.pins = Object.keys((shape && shape.pin) || {}).map(function (pid) {
							var p = shape.pin[pid];
							return {
								number: (p.num && p.num.text) || '',
								name: (p.name && p.name.text) || '',
								x: Number(p.pinDot && p.pinDot.x),
								y: Number(p.pinDot && p.pinDot.y)
							};
						});
						var pAnn = Object.keys((shape && shape.annotation) || {}).map(function (k) {
							return shape.annotation[k];
						}).filter(function (a) { return a && a.mark === 'P'; })[0];
						out.designator = (pAnn && pAnn.string) || '';
						out.bbox = A.bboxOfShape(shape);
					} catch (e) { /* ignore */ }
				}
				resolve(out);
			}

			(function poll() {
				var gid = findNew();
				if (gid || tries++ >= 20) { finish(gid); return; }
				setTimeout(poll, 100);
			})();
		});
	};

	A.placePart = function (spec) {
		var pos = A.clampToSheet(spec.x, spec.y);

		/* 1) real library symbols (parts.js) — no parametric modelling */
		var tpl = (EAI.parts && EAI.parts.get) ? EAI.parts.get(spec.part) : null;
		if (tpl && tpl.raw) {
			var preTpl = String(spec.pre || tpl.pre || 'U');
			if (!spec.designator) {
				spec.designator = A.nextDesignator(preTpl, spec.used);
			}
			var block = EAI.parts.build(tpl, {
				x: pos.x, y: pos.y, rotation: spec.rotation || 0,
				designator: spec.designator, name: spec.name, value: spec.value,
				package: spec.package, pre: spec.pre
			});
			if (!block) return { ok: false, error: 'template build failed' };

			/* put the first pin exactly on the placement grid */
			var step = A.gridStep();
			var pids0 = Object.keys(block.pin || {});
			if (pids0.length) {
				var pd0 = block.pin[pids0[0]].pinDot || {};
				var px0 = Number(pd0.x), py0 = Number(pd0.y);
				if (isFinite(px0) && isFinite(py0)) {
					var adjX = A.gridSnap(px0, step) - px0;
					var adjY = A.gridSnap(py0, step) - py0;
					if (adjX || adjY) {
						pos.x += adjX;
						pos.y += adjY;
						block = EAI.parts.build(tpl, {
							x: pos.x, y: pos.y, rotation: spec.rotation || 0,
							designator: spec.designator, name: spec.name, value: spec.value,
							package: spec.package, pre: spec.pre
						});
					}
				}
			}
			var pins = Object.keys(block.pin || {}).map(function (pid) {
				var p = block.pin[pid];
				return {
					number: (p.num && p.num.text) || '',
					name: (p.name && p.name.text) || '',
					x: Number(p.pinDot && p.pinDot.x),
					y: Number(p.pinDot && p.pinDot.y)
				};
			});
			try {
				/* the block already carries absolute coordinates — passing x/y
				   again would translate it twice (parts landed outside the frame) */
				EAI.api('createShape', {
					shapeType: 'schlib', jsonCache: block,
					x: 0, y: 0, rotation: 0
				});
			} catch (e) {
				return { ok: false, error: 'importing the symbol failed: ' + e };
			}
			A.applyTemplateMeta(block.head.gId, {
				pre: tpl.pre, value: spec.value, name: spec.name,
				package: spec.package, designator: spec.designator,
				mpn: spec.mpn, manufacturer: spec.manufacturer,
				supplierPart: spec.supplierPart
			});
			A.ensureDesignator(block.head.gId, spec.designator);
			var aligned = A.gridAlignComponent(block.head.gId, step);
			if (aligned && aligned.pin) {
				pins = Object.keys(aligned.pin).map(function (pid) {
					var pp = aligned.pin[pid];
					return {
						number: (pp.num && pp.num.text) || '',
						name: (pp.name && pp.name.text) || '',
						x: Number(pp.pinDot && pp.pinDot.x),
						y: Number(pp.pinDot && pp.pinDot.y)
					};
				});
				if (aligned.head) { pos.x = Number(aligned.head.x); pos.y = Number(aligned.head.y); }
			}
			var bboxT = A.bboxOfShape(aligned);
			return {
				ok: true, gId: block.head.gId, x: pos.x, y: pos.y,
				part: spec.part, clamped: pos.clamped,
				designator: spec.designator || '', pins: pins, bbox: bboxT
			};
		}

		/* 2) fallback: parametric symbol (GENERIC / XTAL / unknown names) */
		var lib = A.PARAM_LIB[(spec.part || '').toUpperCase()];
		if (!lib) return { ok: false, error: 'unknown part "' + spec.part + '"' };
		var sym = U.clone(lib);
		if (!spec.designator) {
			spec.designator = A.nextDesignator(spec.pre || sym.pre || 'U', spec.used);
		}
		if (!sym.pins.length && spec.pinCount) {
			sym = A.genericSymbol(spec.pinCount, {
				name: spec.name, pre: spec.pre, pinNames: spec.pinNames
			});
		}
		sym.x = pos.x;
		sym.y = pos.y;
		var step2 = A.gridStep();
		if (sym.pins && sym.pins.length) {
			var q0 = sym.pins[0];
			var wx = sym.x + Number(q0.x || 0), wy = sym.y + Number(q0.y || 0);
			sym.x += A.gridSnap(wx, step2) - wx;
			sym.y += A.gridSnap(wy, step2) - wy;
		}
		sym.rotation = spec.rotation || 0;
		sym.package = spec.package || sym.package;
		if (spec.mpn) sym.manufacturerPart = spec.mpn;
		if (spec.manufacturer) sym.manufacturer = spec.manufacturer;
		if (spec.supplierPart) sym.supplierPart = spec.supplierPart;
		if (spec.name) sym.name = spec.name;
		if (spec.value) sym.value = spec.value;

		var res = A.createSymbol(sym);
		if (!res.ok) return res;

		A.applyTemplateMeta(res.gId, {
			pre: sym.pre || spec.pre, value: spec.value, name: spec.name,
			package: spec.package, designator: spec.designator,
			mpn: spec.mpn, manufacturer: spec.manufacturer,
			supplierPart: spec.supplierPart
		});
		A.ensureDesignator(res.gId, spec.designator);
		if (spec.designator) A.setComponentDesignator(res.gId, spec.designator);
		var alignedF = A.gridAlignComponent(res.gId, step2);
		var bboxF = A.bboxOfShape(alignedF);
		var fpins;
		if (alignedF && alignedF.pin) {
			fpins = Object.keys(alignedF.pin).map(function (pid) {
				var pp = alignedF.pin[pid];
				return {
					number: (pp.num && pp.num.text) || '',
					name: (pp.name && pp.name.text) || '',
					x: Number(pp.pinDot && pp.pinDot.x),
					y: Number(pp.pinDot && pp.pinDot.y)
				};
			});
			if (alignedF.head) { sym.x = Number(alignedF.head.x); sym.y = Number(alignedF.head.y); }
		} else {
			fpins = (sym.pins || []).map(function (p) {
				return {
					number: p.number, name: p.name,
					x: sym.x + Number(p.dotX === undefined ? p.x : p.dotX),
					y: sym.y + Number(p.dotY === undefined ? p.y : p.dotY)
				};
			});
		}
		return {
			ok: true, gId: res.gId, x: sym.x, y: sym.y, part: spec.part,
			clamped: pos.clamped, designator: spec.designator || '',
			pins: fpins, bbox: bboxF
		};
	};

	/* -------------------------------------------------- high level helpers */

	/**
	 * Executes a plan produced by the model.
	 *
	 * A plan looks like:
	 *   { components:[{part:'R', x, y, rotation, value, designator}],
	 *     wires:[[{x,y},{x,y}]],
	 *     netLabels:[{x,y,name}],
	 *     junctions:[{x,y}],
	 *     edits:[{designator, value}] }
	 */
	A.applyPlan = function (plan) {
		var report = { components: [], wires: [], netLabels: [], junctions: [], edits: [], errors: [] };
		if (!plan || typeof plan !== 'object') return report;

		(plan.components || []).forEach(function (c) {
			var r = A.placePart(c);
			if (r.ok) report.components.push(r); else report.errors.push(r.error);
		});
		(plan.wires || []).forEach(function (w) {
			var r = A.createWire(w);
			if (r.ok) report.wires.push(r); else report.errors.push(r.error);
		});
		(plan.netLabels || []).forEach(function (l) {
			var r = A.createNetLabel(l.x, l.y, l.name, l.rotation);
			if (r.ok) report.netLabels.push(r); else report.errors.push(r.error);
		});
		(plan.junctions || []).forEach(function (j) {
			var r = A.createJunction(j.x, j.y);
			if (r.ok) report.junctions.push(r); else report.errors.push(r.error);
		});
		(plan.edits || []).forEach(function (e) {
			report.edits.push(A.applyEdits([e]));
		});
		return report;
	};
})();
