(function () {
	'use strict';

	var EAI = (window.EAI = window.EAI || {});
	var UI = (EAI.ui = EAI.ui || {});
	var U = EAI.util;
	var st = UI.st;
	var C = UI.C;
	var FONT = UI.FONT;
	var styleBlock = UI.styleBlock;
	var injectStyle = UI.injectStyle;
	var logoSvg = UI.logoSvg;
	var isAlive = UI.isAlive;

	/* ------------------------------------------------------------ about -- */

	UI.openAbout = function () {
		injectStyle();
		if (UI.dlgAbout && !isAlive(UI.dlgAboutCtl)) {
			UI.dlgAbout = null;
			UI.dlgAboutCtl = null;
		}
		if (UI.dlgAbout) {
			try { UI.dlgAboutCtl.open(); } catch (e) { /* ignore */ }
			return UI.dlgAbout;
		}

		function card(title, desc) {
			return '<div style="' + st({
				flex: '1 1 46%', minWidth: '160px', border: '1px solid ' + C.border,
				borderRadius: '10px', padding: '10px 12px', background: '#fbfcfe'
			}) + '">' +
				'<div style="' + st({
					fontWeight: '600', color: C.primaryDark, fontSize: '12.5px', marginBottom: '2px'
				}) + '">' + title + '</div>' +
				'<div style="' + st({ fontSize: '11.5px', color: '#5f6f86', lineHeight: '1.55' }) + '">' +
				desc + '</div></div>';
		}

		var html = styleBlock() + '<div class="eai-root" style="' + st({
			fontFamily: FONT, fontSize: '13px', color: C.text, background: C.bg
		}) + '">' +

			'<div style="' + st({
				background: 'linear-gradient(135deg,#0f1f3a 0%,#1e3a68 50%,#2f6fbf 100%)',
				color: '#fff', padding: '18px 22px', display: 'flex',
				gap: '16px', alignItems: 'center'
			}) + '">' +
			'<div style="' + st({
				width: '58px', height: '58px', borderRadius: '15px', background: '#0b1729',
				display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto',
				boxShadow: '0 6px 18px rgba(0,0,0,.32)'
			}) + '">' + logoSvg(44) + '</div>' +
			'<div>' +
			'<div style="' + st({ fontSize: '20px', fontWeight: '600', letterSpacing: '.5px' }) + '">AI 助手</div>' +
			'<div style="' + st({ fontSize: '12px', opacity: '.85', marginTop: '2px' }) +
			'">EasyEDA 标准版 · 智能原理图与 PCB 设计助手</div>' +
			'<div style="' + st({
				display: 'inline-block', marginTop: '7px', fontSize: '11px',
				background: 'rgba(255,255,255,.16)', padding: '2px 10px', borderRadius: '20px'
			}) + '">v' + EAI.ver + ' · ID ' + U.esc(EAI.discoverExtId()) + '</div>' +
			'</div></div>' +

			'<div style="' + st({ padding: '14px 22px 16px' }) + '">' +
			'<div style="' + st({ display: 'flex', flexWrap: 'wrap', gap: '8px' }) + '">' +
			card('原理图审查', '网表、悬空脚、去耦、命名冲突') +
			card('器件标准化', '补齐封装 / 型号 / 供应商 / 料号') +
			card('生成原理图', '先查系统库，查不到再现场建符号') +
			card('BOM 与截图评审', '物料与画布一起看') +
			'</div>' +

			'<div style="' + st({
				fontSize: '12px', color: '#3d4d66', lineHeight: '1.75', marginTop: '12px'
			}) + '">' +
			'· 内置 Agent 循环：模型通过工具读取网表 / BOM / 截图，并直接修改文档。<br/>' +
			'· 支持 OpenAI 与 Anthropic 协议，接口地址可完全自定义。<br/>' +
			'· API Key 仅保存在本机与该扩展配置中。' +
			'</div>' +

			'<div style="' + st({
				fontSize: '11px', color: C.muted, borderTop: '1px solid #e9eef6',
				marginTop: '12px', paddingTop: '10px'
			}) + '">基于嘉立创EDA（EasyEDA）标准版扩展 API 开发，与专业版扩展不通用。</div>' +
			'</div></div>';

		var ctl = EAI.dlg({
			title: U.t('eai.about.title', '关于 AI 助手'),
			width: 560,
			height: 470,
			modal: true,
			content: html
		});
		if (!ctl) return null;
		UI.dlgAboutCtl = ctl;
		UI.dlgAbout = ctl.el;
		return UI.dlgAbout;
	};

})();
