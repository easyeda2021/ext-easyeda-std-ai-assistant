/* =====================================================================
 * EasyEDA Std extension — "AI Assistant" / AI 助手
 * parts.js — 常用器件模板（内置符号库）
 *
 * 这里定义不需要查系统库就能放置的标准器件：每个模板包含名称、位号前缀、
 * 默认封装、引脚几何（相对符号原点）与标注文字。place_part / place_devices
 * 直接取用；要增删常用器件或调整引脚，只改这个文件。
 *
 * 引脚字段：number / name / x,y（引脚在符号上的附着点）/ dx,dy（引脚线延伸方向）/
 *           dotX,dotY（连接点）/ electric（电气类型）
 * ===================================================================== */
(function () {
	'use strict';

	var EAI = (window.EAI = window.EAI || {});
	var P = (EAI.parts = {});

	P.LIBRARY = {
		R: {
			name: 'R', pre: 'R', package: '0603',
			pins: [
				{ number: '1', name: '', x: -15, y: 0, dx: -10, dotX: -25, dotY: 0, electric: 'passive' },
				{ number: '2', name: '', x: 15, y: 0, dx: 10, dotX: 25, dotY: 0, electric: 'passive' }
			],
			texts: [{ x: -20, y: -6, string: 'R', mark: 'L' }]
		},
		C: {
			name: 'C', pre: 'C', package: '0603',
			pins: [
				{ number: '1', name: '', x: -10, y: 0, dx: -10, dotX: -20, dotY: 0, electric: 'passive' },
				{ number: '2', name: '', x: 10, y: 0, dx: 10, dotX: 20, dotY: 0, electric: 'passive' }
			],
			texts: [{ x: -15, y: -6, string: 'C', mark: 'L' }]
		},
		L: {
			name: 'L', pre: 'L', package: '0603',
			pins: [
				{ number: '1', name: '', x: -15, y: 0, dx: -10, dotX: -25, dotY: 0, electric: 'passive' },
				{ number: '2', name: '', x: 15, y: 0, dx: 10, dotX: 25, dotY: 0, electric: 'passive' }
			],
			texts: [{ x: -20, y: -6, string: 'L', mark: 'L' }]
		},
		D: {
			name: 'D', pre: 'D', package: '0603',
			pins: [
				{ number: '1', name: 'A', x: -10, y: 0, dx: -10, dotX: -20, dotY: 0, electric: 'passive' },
				{ number: '2', name: 'K', x: 10, y: 0, dx: 10, dotX: 20, dotY: 0, electric: 'passive' }
			],
			texts: [{ x: -15, y: -6, string: 'D', mark: 'L' }]
		},
		LED: {
			name: 'LED', pre: 'D', package: '0805',
			pins: [
				{ number: '1', name: 'A', x: -10, y: 0, dx: -10, dotX: -20, dotY: 0, electric: 'passive' },
				{ number: '2', name: 'K', x: 10, y: 0, dx: 10, dotX: 20, dotY: 0, electric: 'passive' }
			],
			texts: [{ x: -20, y: -6, string: 'LED', mark: 'L' }]
		},
		SW: {
			name: 'SW', pre: 'SW', package: 'SOIC-4',
			pins: [
				{ number: '1', name: '', x: -15, y: 0, dx: -10, dotX: -25, dotY: 0, electric: 'passive' },
				{ number: '2', name: '', x: 15, y: 0, dx: 10, dotX: 25, dotY: 0, electric: 'passive' }
			],
			texts: [{ x: -15, y: -6, string: 'SW', mark: 'L' }]
		},

		/* ---- 三极管：B 左、C 上、E 下 ---- */
		Q_NPN: {
			name: 'Q_NPN', pre: 'Q', package: 'SOT-23',
			pins: [
				{ number: '1', name: 'B', x: -25, y: 0, dx: -10, dotX: -35, dotY: 0, electric: 'input' },
				{ number: '2', name: 'C', x: 5, y: -20, dx: 0, dy: -10, dotX: 5, dotY: -30, electric: 'passive' },
				{ number: '3', name: 'E', x: 5, y: 20, dx: 0, dy: 10, dotX: 5, dotY: 30, electric: 'passive' }
			],
			texts: [{ x: -22, y: -6, string: 'NPN', mark: 'L' }]
		},
		Q_PNP: {
			name: 'Q_PNP', pre: 'Q', package: 'SOT-23',
			pins: [
				{ number: '1', name: 'B', x: -25, y: 0, dx: -10, dotX: -35, dotY: 0, electric: 'input' },
				{ number: '2', name: 'C', x: 5, y: 20, dx: 0, dy: 10, dotX: 5, dotY: 30, electric: 'passive' },
				{ number: '3', name: 'E', x: 5, y: -20, dx: 0, dy: -10, dotX: 5, dotY: -30, electric: 'passive' }
			],
			texts: [{ x: -22, y: -6, string: 'PNP', mark: 'L' }]
		},

		/* ---- MOS 管：G 左、D 上、S 下 ---- */
		M_NMOS: {
			name: 'NMOS', pre: 'Q', package: 'SOT-23',
			pins: [
				{ number: '1', name: 'G', x: -25, y: 0, dx: -10, dotX: -35, dotY: 0, electric: 'input' },
				{ number: '2', name: 'D', x: 5, y: -20, dx: 0, dy: -10, dotX: 5, dotY: -30, electric: 'passive' },
				{ number: '3', name: 'S', x: 5, y: 20, dx: 0, dy: 10, dotX: 5, dotY: 30, electric: 'passive' }
			],
			texts: [{ x: -22, y: -6, string: 'NMOS', mark: 'L' }]
		},
		M_PMOS: {
			name: 'PMOS', pre: 'Q', package: 'SOT-23',
			pins: [
				{ number: '1', name: 'G', x: -25, y: 0, dx: -10, dotX: -35, dotY: 0, electric: 'input' },
				{ number: '2', name: 'D', x: 5, y: 20, dx: 0, dy: 10, dotX: 5, dotY: 30, electric: 'passive' },
				{ number: '3', name: 'S', x: 5, y: -20, dx: 0, dy: -10, dotX: 5, dotY: -30, electric: 'passive' }
			],
			texts: [{ x: -22, y: -6, string: 'PMOS', mark: 'L' }]
		},

		/* ---- 晶振（两脚） ---- */
		XTAL: {
			name: 'XTAL', pre: 'Y', package: 'HC-49S',
			pins: [
				{ number: '1', name: '', x: -15, y: 0, dx: -10, dotX: -25, dotY: 0, electric: 'passive' },
				{ number: '2', name: '', x: 15, y: 0, dx: 10, dotX: 25, dotY: 0, electric: 'passive' }
			],
			texts: [{ x: -18, y: -6, string: 'Y', mark: 'L' }]
		},

		/* ---- 两脚连接器 ---- */
		CONN2: {
			name: 'CONN2', pre: 'J', package: 'HDR-1x2',
			pins: [
				{ number: '1', name: '', x: -15, y: 0, dx: -10, dotX: -25, dotY: 0, electric: 'passive' },
				{ number: '2', name: '', x: 15, y: 0, dx: 10, dotX: 25, dotY: 0, electric: 'passive' }
			],
			texts: [{ x: -18, y: -6, string: 'J', mark: 'L' }]
		},

		/* ---- 通用 n 脚器件（引脚由 genericSymbol 生成） ---- */
		GENERIC: {
			name: 'U', pre: 'U', package: '',
			pins: [],
			texts: []
		}
	};

	/** Case-insensitive lookup; returns a deep copy so callers can tweak it. */
	P.get = function (name) {
		var key = String(name == null ? '' : name).trim().toUpperCase();
		var tpl = P.LIBRARY[key];
		if (!tpl) return null;
		try { return JSON.parse(JSON.stringify(tpl)); }
		catch (e) { return tpl; }
	};

	/** Names of every built-in part, for prompts / tool descriptions. */
	P.names = function () {
		return Object.keys(P.LIBRARY);
	};
})();
