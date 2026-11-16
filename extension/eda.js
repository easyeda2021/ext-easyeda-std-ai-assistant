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
	/** Canvas / grid settings of the active document. */
	D.canvasInfo = function (json) {
		json = json || D.activeJson() || {};
		var c = json.canvas || {};
		return {
			unit: c.unit || 'pixel',
			gridSize: Number(c.gridSize) || 0,
			snapSize: Number(c.snapSize) || 0,
			altSnapSize: Number(c.altSnapSize) || 0,
			originX: Number(c.originX) || 0,
			originY: Number(c.originY) || 0,
			width: Number(c.canvasWidth) || 0,
			height: Number(c.canvasHeight) || 0
		};
	};

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
			/* last resort: a TEXT child that looks like a reference (R1, C12, U3) */
			if (!designator) designator = guessDesignatorFromTexts(fp);

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

	/** Picks a text child that looks like a component reference. */
	function guessDesignatorFromTexts(fp) {
		var re = /^[A-Z]{1,3}\d+$/;
		for (var key in fp) {
			if (!Object.prototype.hasOwnProperty.call(fp, key)) continue;
			if (key !== 'TEXT' && key !== 'SVGNODE') continue;
			var sub = fp[key];
			if (!sub || typeof sub !== 'object') continue;
			for (var id in sub) {
				if (!Object.prototype.hasOwnProperty.call(sub, id)) continue;
				var t = sub[id];
				var str = t && (t.string || t.text);
				if (str && re.test(String(str).trim())) return String(str).trim();
			}
		}
		return '';
	}

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

	/* ------------------------------------------------------- document kind */

	var DOC_TYPES = {
		'1': 'sch', '13': 'sch',
		'2': 'schlib', '6': 'schlib', '7': 'schlib',
		'3': 'pcb', '14': 'pcb',
		'4': 'pcblib',
		'8': 'subckt',
		'10': 'waveform',
		'12': 'photoview'
	};

	var DOC_NAMES = {
		SCH: '1', SCHLIB: '2', PCB: '3', PCBLIB: '4', PRJ: '5', SUBPART: '6',
		SPICESYMBOL: '7', SUBCKT: '8', NETLIST: '9', WAVEFORM: '10',
		SCHLIB3D: '11', PHOTOVIEW: '12', SCHMODULE: '13', PCBMODULE: '14',
		VIEW3D: '15', PCBLIB3D: '16'
	};

	/**
	 * Abstract kind of the active document: 'sch' | 'pcb' | 'schlib' |
	 * 'pcblib' | 'subckt' | 'waveform' | 'photoview' | null.
	 */
	D.docKind = function () {
		var raw = null;
		try {
			var j = EAI.api('getActiveJson');
			if (j && j.head && j.head.docType) raw = j.head.docType;
		} catch (e) { /* ignore */ }
		if (raw === null || raw === undefined) {
			try { raw = D.editorCall('getDocStatus'); } catch (e) { /* ignore */ }
		}
		if (raw === null || raw === undefined) return null;
		var s = String(raw);
		if (DOC_NAMES[s]) s = DOC_NAMES[s];
		return DOC_TYPES[s] || null;
	};

	D.docKindLabel = function () {
		var k = D.docKind();
		return ({
			sch: 'Schematic / 原理图',
			pcb: 'PCB',
			schlib: 'Symbol library / 符号库',
			pcblib: 'Footprint library / 封装库',
			subckt: 'SPICE subckt',
			waveform: 'Waveform',
			photoview: 'Photo view'
		})[k] || 'Unknown';
	};

	/* ------------------------------------------------------------- PCB ---- */

	/** Board geometry from the active PCB. */
	D.pcbInfo = function () {
		var json = D.activeJson();
		if (!json) return null;
		var bbox = null;
		try { bbox = EAI.api('editorCall', { cmd: 'getBBox', args: [] }); } catch (e) { /* ignore */ }
		if (!bbox && json.BBox) bbox = json.BBox;

		var footprints = D.pcbComponents(json);
		var nets = D.pcbNets(json);
		var tracks = json.TRACK ? Object.keys(json.TRACK).length : 0;
		var vias = json.VIA ? Object.keys(json.VIA).length : 0;
		var pads = json.PAD ? Object.keys(json.PAD).length : 0;

		return {
			bbox: bbox,
			widthMil: bbox && bbox.width,
			heightMil: bbox && bbox.height,
			widthMm: bbox && bbox.width ? +(bbox.width * 0.0254).toFixed(2) : null,
			heightMm: bbox && bbox.height ? +(bbox.height * 0.0254).toFixed(2) : null,
			footprints: footprints,
			nets: nets,
			trackCount: tracks,
			viaCount: vias,
			padCount: pads,
			layerCount: json.layers ? json.layers.length : null
		};
	};

	/* ------------------------------------------------------------ capture -- */

	/**
	 * Rasterises the active canvas.
	 * @returns {Promise<{base64, mediaType, width, height}>}
	 */
	D.capture = function (maxPx) {
		return new Promise(function (resolve, reject) {
			var svg;
			try { svg = D.svg(50); } catch (e) { reject(e); return; }
			if (!svg) { reject(new Error('could not export the canvas')); return; }
			D.svgToPng(svg, maxPx || 1800).then(function (img) {
				resolve({
					base64: img.base64,
					mediaType: 'image/png',
					width: img.width,
					height: img.height,
					dataUrl: img.dataUrl
				});
			}).catch(reject);
		});
	};
})();
