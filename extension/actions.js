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
	A.createWire = function (points, style) {
		if (!points || points.length < 2) return { ok: false, error: 'a wire needs at least two points' };
		style = style || {};
		EAI.api('createShape', {
			shapeType: 'wire',
			points: points.map(function (p) { return { x: p.x, y: p.y }; }),
			stroke: style.stroke || '#008800',
			'stroke-width': style.width || 1,
			'stroke-style': style.style || ''
		});
		return { ok: true, points: points.length };
	};

	/** Places a net label (the named anchor of a net). */
	A.createNetLabel = function (x, y, name, rotation) {
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
				x: originX, y: originY,
				rotation: spec.rotation || 0
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

		if (json.schlib) {
			for (var gid in json.schlib) {
				if (!Object.prototype.hasOwnProperty.call(json.schlib, gid)) continue;
				var head = json.schlib[gid] && json.schlib[gid].head;
				if (!head) continue;
				var id = String(head.gId || '');
				var para = String(head.c_para || '');
				if (/^frame/i.test(id) || /frame_lib/i.test(para)) {
					var fx = Number(head.x) || 0;
					var fy = Number(head.y) || 0;
					if (fx > 100) w = fx;
					if (fy > 100) h = fy;
					break;
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

	/** Places one REAL library device (uuid from search_library). */
	A.placeDevice = function (spec) {
		var uuid = String((spec && spec.uuid) || '').trim();
		if (!uuid) return { ok: false, error: 'uuid is required' };
		var pos = A.clampToSheet(spec.x, spec.y);
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
		return { ok: true, x: pos.x, y: pos.y, clamped: pos.clamped };
	};

	A.placePart = function (spec) {
		var pos = A.clampToSheet(spec.x, spec.y);

		/* 1) real library symbols (parts.js) — no parametric modelling */
		var tpl = (EAI.parts && EAI.parts.get) ? EAI.parts.get(spec.part) : null;
		if (tpl && tpl.raw) {
			var block = EAI.parts.build(tpl, {
				x: pos.x, y: pos.y, rotation: spec.rotation || 0,
				designator: spec.designator, name: spec.name, value: spec.value,
				package: spec.package, pre: spec.pre
			});
			if (!block) return { ok: false, error: 'template build failed' };
			try {
				EAI.api('createShape', {
					shapeType: 'schlib', jsonCache: block,
					x: pos.x, y: pos.y, rotation: spec.rotation || 0
				});
			} catch (e) {
				return { ok: false, error: 'importing the symbol failed: ' + e };
			}
			return {
				ok: true, gId: block.head.gId, x: pos.x, y: pos.y,
				part: spec.part, clamped: pos.clamped,
				designator: spec.designator || ''
			};
		}

		/* 2) fallback: parametric symbol (GENERIC / XTAL / unknown names) */
		var lib = A.PARAM_LIB[(spec.part || '').toUpperCase()];
		if (!lib) return { ok: false, error: 'unknown part "' + spec.part + '"' };
		var sym = U.clone(lib);
		if (!sym.pins.length && spec.pinCount) {
			sym = A.genericSymbol(spec.pinCount, { name: spec.name, pre: spec.pre });
		}
		sym.x = pos.x;
		sym.y = pos.y;
		sym.rotation = spec.rotation || 0;
		sym.package = spec.package || sym.package;
		if (spec.name) sym.name = spec.name;
		if (spec.value) sym.value = spec.value;

		var res = A.createSymbol(sym);
		if (!res.ok) return res;

		if (spec.designator) A.setComponentDesignator(res.gId, spec.designator);
		return {
			ok: true, gId: res.gId, x: sym.x, y: sym.y, part: spec.part,
			clamped: pos.clamped, designator: spec.designator || ''
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
