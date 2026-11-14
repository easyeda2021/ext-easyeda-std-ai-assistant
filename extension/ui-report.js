(function () {
	'use strict';

	var EAI = (window.EAI = window.EAI || {});
	var UI = (EAI.ui = EAI.ui || {});
	var U = EAI.util;
	var st = UI.st;
	var C = UI.C;
	var FONT = UI.FONT;
	var MONO = UI.MONO;
	var styleBlock = UI.styleBlock;
	var injectStyle = UI.injectStyle;
	var svgIcon = UI.svgIcon;
	var ghostBtn = UI.ghostBtn;
	var isAlive = UI.isAlive;
	var mdToHtml = UI.mdToHtml;
	var linkify = UI.linkify;



	var logSeq = 0;

	UI.appendLog = function (line) {
		if (!UI.dlgLog) return;
		var $ = EAI.jq;
		var box = $('#eai-log', UI.dlgLog);
		if (!box.length) return;
		logSeq++;
		/* JSON / multi-line payloads are collapsed into one wrapped line so
		   the log stays compact */
		line = String(line == null ? '' : line)
			.split(String.fromCharCode(10))
			.map(function (x) { return x.trim(); })
			.filter(function (x) { return x.length > 0; })
			.join(' ')
			.replace(String.fromCharCode(13), ' ');

		var row = $('<div></div>');
		row.attr('style', st({
			display: 'flex', gap: '8px', padding: '1px 0', alignItems: 'flex-start'
		}));

		var num = $('<span></span>');
		num.attr('style', st({
			flex: '0 0 30px', textAlign: 'right', color: '#5b6b82',
			opacity: '.8',
			'user-select': 'text !important',
			'-webkit-user-select': 'text !important'
		}));
		num.text(logSeq);

		var txt = $('<span></span>');
		txt.attr('style', st({
			flex: '1 1 auto', minWidth: '0',
			whiteSpace: 'pre-wrap', wordBreak: 'break-all',
			'user-select': 'text !important',
			'-webkit-user-select': 'text !important',
			cursor: 'text'
		}));
		txt.text(line);

		row.append(num).append(txt);
		box.append(row);
		box[0].scrollTop = box[0].scrollHeight;
	};

	/**
	 * A review / analysis produced a report: drop a card into the chat stream.
	 * The card offers a preview dialog and direct downloads; there is no
	 * separate "report" tab any more.
	 */
	UI.showReport = function (markdown) {
		lastReport = String(markdown || '').trim();
		if (!lastReport || !UI.dlgPanel) return null;
		if (lastReport.length < 40) {
			UI.appendMsg('err', '报告内容为空，可能是接口返回异常，请查看「日志」页。');
			return null;
		}
		return UI.appendReportCard(lastReport);
	};

	UI.appendReportCard = function (md) {
		var $ = EAI.jq;
		var box = $('#eai-chat', UI.dlgPanel);
		if (!box.length) return null;

		var size = md.length < 1024
			? (md.length + ' 字符')
			: ((md.length / 1024).toFixed(1) + ' KB');

		var card = $('<div data-eai-card="1"></div>');
		card.attr('style', st({
			display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '12px'
		}));
		card.append('<div style="' + st({
			width: '28px', height: '28px', borderRadius: '9px', background: '#b45309',
			color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
			fontSize: '13px', flex: '0 0 auto'
		}) + '">&#128196;</div>');

		var body = $('<div></div>');
		body.attr('style', st({
			flex: '1 1 auto', minWidth: '0',
			border: '1px solid #f0d9a8', borderRadius: '12px', padding: '11px 13px',
			background: 'linear-gradient(180deg,#fffdf6 0%,#fff8e8 100%)'
		}));
		body.append('<div style="' + st({
			fontWeight: '600', color: '#8a5a12', fontSize: '13px'
		}) + '">评审报告已生成</div>');
		body.append('<div style="' + st({
			fontSize: '11.5px', color: '#9a7b45', marginTop: '2px'
		}) + '">' + size + ' · 可在弹窗中预览，或直接下载</div>');

		var row = $('<div style="' + st({ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }) + '"></div>');
		row.append('<button class="eai-btn" data-eai-act="preview" style="' + st({
			background: '#b45309', border: '1px solid #b45309', color: '#fff',
			borderRadius: '8px', padding: '6px 15px', fontSize: '12px', fontFamily: FONT,
			fontWeight: '600'
		}) + '">预览报告</button>');
		row.append('<button class="eai-btn" data-eai-act="md" style="' + ghostBtn() + '">下载 Markdown</button>');
		row.append('<button class="eai-btn" data-eai-act="html" style="' + ghostBtn() + '">下载 HTML</button>');
		body.append(row);

		card.append(body);
		card.data('eai-report', md);
		box.append(card);
		box[0].scrollTop = box[0].scrollHeight;
		return card;
	};

	/** Stand-alone preview window (created once, re-used afterwards). */
	UI.openReportDialog = function (md) {
		var $ = EAI.jq;
		var content = md || lastReport || '';
		UI._previewMd = content;

		if (!UI.dlgReport) {
			var html = styleBlock() + '<div class="eai-root" style="' + st({
				fontFamily: FONT, fontSize: '13px', color: C.text, background: C.bg,
				boxSizing: 'border-box', width: '100%'
			}) + '">' +
				'<div id="eai-report-body" style="' + st({
					padding: '18px 22px', boxSizing: 'border-box', width: '100%',
					'user-select': 'text !important',
					'-webkit-user-select': 'text !important'
				}) + '"></div>' +
				'<div style="' + st({
					padding: '10px 22px', borderTop: '1px solid ' + C.border,
					background: C.surface, display: 'flex', gap: '8px'
				}) + '">' +
				'<button class="eai-btn" data-eai-dl="md" style="' + ghostBtn() + '">下载 Markdown</button>' +
				'<button class="eai-btn" data-eai-dl="html" style="' + ghostBtn() + '">下载 HTML</button>' +
				'</div></div>';

			var ctlR = EAI.dlg({
				title: '评审报告', width: 780, height: 660,
				modal: true, content: html
			});
			UI.dlgReportCtl = ctlR;
			UI.dlgReport = ctlR ? ctlR.el : null;
			if (UI.dlgReport) {
				UI.dlgReport.on('click', '[data-eai-dl]', function (e) {
					e.preventDefault();
					UI.downloadReport($(this).attr('data-eai-dl'));
				});
			}
		}
		if (!UI.dlgReport) return null;
		$('#eai-report-body', UI.dlgReport).html(linkify(UI.mdToHtml(content)));
		try { UI.dlgReportCtl.open(); } catch (e) { /* ignore */ }
		return UI.dlgReport;
	};

	UI.downloadReport = function (kind) {
		var md = UI._previewMd || lastReport || '';
		if (kind === 'html') {
			var html = '<!doctype html><meta charset="utf-8"><title>AI 评审报告</title>' +
				'<body style="font-family:\'Microsoft YaHei\',sans-serif;max-width:1040px;' +
				'margin:0 auto;padding:32px;line-height:1.7;color:#1f2733">' +
				UI.mdToHtml(md) + '</body>';
			U.download('ai-report-' + Date.now() + '.html', html, 'text/html;charset=utf-8');
		} else {
			U.download('ai-report-' + Date.now() + '.md', md);
		}
	};

	/* ------------------------------------------------------ log window -- */

	/**
	 * The log lives in its own non-modal window so it can stay open next to
	 * the editor and be compared with the chat while the agent runs.
	 */
	UI.openLogWindow = function () {
		injectStyle();
		var $ = EAI.jq;

		if (UI.dlgLog && !isAlive(UI.dlgLogCtl)) {
			UI.dlgLog = null;
			UI.dlgLogCtl = null;
		}
		if (UI.dlgLog) {
			try { UI.dlgLogCtl.open(); } catch (e) { /* ignore */ }
			return UI.dlgLog;
		}

		var html = styleBlock() + '<div class="eai-root" style="' + st({
			fontFamily: FONT, fontSize: '13px', color: '#c3d3e6', background: '#101926'
		}) + '">' +
			'<div id="eai-log" style="' + st({
				height: '440px', overflowY: 'auto', background: '#101926', color: '#c3d3e6',
				padding: '12px 14px', fontFamily: MONO, fontSize: '11.5px',
				lineHeight: '1.55', boxSizing: 'border-box',
				'user-select': 'text !important',
				'-webkit-user-select': 'text !important',
				cursor: 'text'
			}) + '"></div>' +
			'</div>' +
			'<div style="' + st({
				padding: '9px 14px', borderTop: '1px solid #26313f', background: '#0d141e',
				display: 'flex', gap: '8px', justifyContent: 'flex-end'
			}) + '">' +
			'<button id="eai-log-copy" class="eai-btn" style="' + st({
				background: '#1b2735', border: '1px solid #33445c', color: '#c3d3e6',
				borderRadius: '8px', padding: '6px 14px', fontSize: '12px', fontFamily: FONT
			}) + '">复制全部</button>' +
			'<button id="eai-log-close" class="eai-btn" style="' + st({
				background: '#1b2735', border: '1px solid #33445c', color: '#c3d3e6',
				borderRadius: '8px', padding: '6px 14px', fontSize: '12px', fontFamily: FONT
			}) + '">关闭</button>' +
			'</div>' +
			'</div>';

		var ctl = EAI.dlg({
			title: '运行日志',
			width: 700,
			height: 540,
			modal: false,
			content: html
		});
		if (!ctl) return null;
		UI.dlgLogCtl = ctl;
		UI.dlgLog = ctl.el;

		$('#eai-log-copy', UI.dlgLog).on('click', function (e) {
			e.preventDefault();
			var text = EAI.logLines.join(String.fromCharCode(10));
			UI.copyText(text, $(this));
		});
		$('#eai-log-close', UI.dlgLog).on('click', function (e) {
			e.preventDefault();
			try { UI.dlgLogCtl.close(); } catch (err) { /* ignore */ }
		});

		UI.renderLogBuffer();
		return UI.dlgLog;
	};

	/** Re-renders the buffered lines (they are kept even before the window opens). */
	UI.renderLogBuffer = function () {
		if (!UI.dlgLog) return;
		var $ = EAI.jq;
		var box = $('#eai-log', UI.dlgLog);
		if (!box.length) return;
		box.empty();
		logSeq = 0;
		EAI.logLines.slice(-400).forEach(function (l) { UI.appendLog(l); });
	};

	/**
	 * Grows the input with its content, up to 6 lines.  The textarea is
	 * absolutely positioned inside the rounded box, so its own height is reset
	 * to "auto" to measure the wrapped content first.
	 */
})();
