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

		function card(icon, title, desc) {
			return '<div style="' + st({
				flex: '1 1 200px', minWidth: '190px', border: '1px solid ' + C.border,
				borderRadius: '12px', padding: '12px 14px', background: '#fbfcfe'
			}) + '">' +
				'<div style="' + st({
					fontWeight: '600', color: C.primaryDark, fontSize: '13px', marginBottom: '4px'
				}) + '">' + icon + ' ' + title + '</div>' +
				'<div style="' + st({ fontSize: '12px', color: '#5f6f86', lineHeight: '1.6' }) + '">' +
				desc + '</div></div>';
		}

		function h2(t) {
			return '<div style="' + st({
				display: 'flex', alignItems: 'center', gap: '8px',
				fontSize: '14px', fontWeight: '600', color: C.primaryDark,
				margin: '22px 0 10px'
			}) + '"><span style="' + st({
				width: '3px', height: '15px', background: C.primary,
				borderRadius: '2px', display: 'inline-block'
			}) + '"></span>' + t + '</div>';
		}

		function ul(items) {
			return '<ul style="' + st({
				margin: '0 0 0 18px', padding: '0', fontSize: '12.5px',
				color: '#3d4d66', lineHeight: '1.8'
			}) + '">' + items.map(function (t) {
				return '<li style="margin:3px 0">' + t + '</li>';
			}).join('') + '</ul>';
		}

		var html = styleBlock() + '<div class="eai-root" style="' + st({
			fontFamily: FONT, fontSize: '13px', color: C.text, background: C.bg
		}) + '">' +

			'<div style="' + st({
				background: 'linear-gradient(135deg,#0f1f3a 0%,#1e3a68 50%,#2f6fbf 100%)',
				color: '#fff', padding: '26px 28px 24px', display: 'flex',
				gap: '20px', alignItems: 'center'
			}) + '">' +
			'<div style="' + st({
				width: '76px', height: '76px', borderRadius: '20px', background: '#0b1729',
				display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto',
				boxShadow: '0 8px 24px rgba(0,0,0,.35)'
			}) + '">' + logoSvg(60) + '</div>' +
			'<div>' +
			'<div style="' + st({ fontSize: '23px', fontWeight: '600', letterSpacing: '.6px' }) + '">AI 助手</div>' +
			'<div style="' + st({ fontSize: '12.5px', opacity: '.85', marginTop: '3px' }) +
			'">EasyEDA 标准版 · 智能原理图与 PCB 设计助手</div>' +
			'<div style="' + st({
				display: 'inline-block', marginTop: '10px', fontSize: '11.5px',
				background: 'rgba(255,255,255,.16)', padding: '4px 12px', borderRadius: '20px'
			}) + '">v' + EAI.ver + ' · 扩展 ID：' + U.esc(EAI.discoverExtId()) + '</div>' +
			'</div></div>' +

			'<div style="' + st({ padding: '20px 28px 26px' }) + '">' +
			h2('它能做什么') +
			'<div style="' + st({ display: 'flex', flexWrap: 'wrap', gap: '10px' }) + '">' +
			card('📐', '原理图审查', '读取整个工程的网表，检查悬空引脚、缺去耦、网络冲突、上下拉与复位电路。') +
			card('🔧', 'PCB 审查', '解析板框、器件布局与网络，结合截图评审布线、回流路径与工艺。') +
			card('📦', 'BOM 分析', '缺值 / 缺封装 / 重复物料检查，给出采购与贴片建议。') +
			card('✨', '生成原理图', '按自然语言需求放置器件、连线和网络标签，直接落到画布。') +
			card('🧩', '图片生成符号', '识别符号图片的引脚与形状，生成带引脚的原理图符号。') +
			card('✏️', '批量修改', '按位号批量改值、改位号，报告中的位号可点击定位。') +
			'</div>' +

			h2('工作原理') +
			ul([
				'内置 <b>Agent 循环</b>：模型会调用扩展封装好的工具（读网表、BOM、截图、放置器件、改值等），而不是凭空回答。',
				'自动识别当前文档类型（<b>原理图 / PCB / 符号库</b>），只暴露与之匹配的工具。',
				'网表由扩展本地解析文档 JSON 得到，并用编辑器自身的 <code>getWireNetName</code> 校核网络名。',
				'兼容 <b>OpenAI</b> 与 <b>Anthropic</b> 两种协议，接口地址可完全自定义（支持第三方网关与本地模型）。'
			]) +

			h2('快速上手') +
			ul([
				'打开原理图 → 工具栏「AI助手」→ 点 <b>原理图审查</b> → 发送。',
				'首次使用请先在 <b>设置</b> 里填写接口地址、API Key 与模型名，可点「测试连接」验证。',
				'输入框支持 <b>Ctrl + Enter</b> 发送。',
				'报告页可导出 Markdown / HTML；日志页保留每次工具调用，便于排查。'
			]) +

			h2('隐私') +
			ul([
				'API Key 保存在扩展配置与本机，不会上传到任何第三方（除了你配置的模型接口）。',
				'只有在执行审查 / 生成时，设计数据才会发送给你所选择的模型服务。'
			]) +

			'<div style="' + st({
				fontSize: '11.5px', color: C.muted, borderTop: '1px solid #e9eef6',
				marginTop: '20px', paddingTop: '14px', lineHeight: '1.7'
			}) + '">' +
			'<b style="color:#3d4d66">扩展 ID</b>：' + U.esc(EAI.discoverExtId()) +
			' ｜ <b style="color:#3d4d66">文档</b>：' + U.esc(EAI.eda.docKindLabel()) +
			' ｜ <b style="color:#3d4d66">构建</b>：EasyEDA Std 扩展 API' +
			'<br/>本扩展基于嘉立创EDA（EasyEDA）标准版的扩展 API 开发，与专业版扩展不通用。' +
			'</div></div></div>';

		var ctl = EAI.dlg({
			title: '关于 AI 助手',
			width: 740,
			height: 700,
			modal: true,
			content: html
		});
		if (!ctl) return null;
		UI.dlgAboutCtl = ctl;
		UI.dlgAbout = ctl.el;
		return UI.dlgAbout;
	};
})();
