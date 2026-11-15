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
	var logoSvg = UI.logoSvg;
	var svgIcon = UI.svgIcon;
	var ICONS = UI.ICONS;
	var iconBtn = UI.iconBtn;
	var segCss = UI.segCss;
	var ghostBtn = UI.ghostBtn;
	var mdToHtml = UI.mdToHtml;

	/* module state (kept in this file after the UI split) */
	var history = [];          /* conversation */
	var lastReport = '';       /* markdown of the last answer */
	var pendingImages = [];    /* images attached by the user */
	var busy = false;          /* an agent run is in flight */

	/* shared helpers live in ui-base.js */
	var isAlive = UI.isAlive;

	/* ----------------------------------------------------------- header -- */

	function headerHtml() {
		return '<div style="' + st({
			display: 'flex', alignItems: 'center', gap: '10px',
			padding: '11px 13px',
			background: 'linear-gradient(135deg,#16294a 0%,#1e3a68 55%,#2e5896 100%)',
			color: '#fff'
		}) + '">' +
			'<div style="' + st({
				width: '34px', height: '34px', borderRadius: '10px',
				background: '#0b1a30', display: 'flex', alignItems: 'center',
				justifyContent: 'center', flex: '0 0 auto',
				boxShadow: '0 4px 14px rgba(0,0,0,.35)'
			}) + '">' + logoSvg(23) + '</div>' +

			'<div style="' + st({
				flex: '1 1 auto', minWidth: '0', overflow: 'hidden'
			}) + '">' +
			'  <div style="' + st({
				fontSize: '13px', fontWeight: '600', letterSpacing: '.3px',
				whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
			}) + '">EasyEDA 智能设计助手</div>' +
			'  <div id="eai-sub" style="' + st({
				fontSize: '11px', opacity: '.78', marginTop: '2px',
				whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
			}) + '">正在读取文档…</div>' +
			'</div>' +

			iconBtn('eai-btn-log', '运行日志（独立窗口）', ICONS.log) +
			iconBtn('eai-btn-clear', '清空会话', ICONS.trash) +
			iconBtn('eai-btn-settings', '设置', ICONS.settings) +
			'</div>';
	}

	/* ------------------------------------------------------------ panel -- */

	function panelHtml() {
		return styleBlock() + '<div class="eai-root" style="' + st({
			fontFamily: FONT, fontSize: '13px', color: C.text, lineHeight: '1.6',
			background: C.bg, margin: '0', padding: '0',
			height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden'
		}) + '">' +
			headerHtml() +

			'<div class="eai-pane" data-pane="chat" style="' + st({
				display: 'flex', flexDirection: 'column',
				flex: '1 1 auto', minHeight: '0', overflow: 'hidden'
			}) + '">' +
			'  <div id="eai-chat" class="eai-chat" style="' + st({
				flex: '1 1 auto', minHeight: '90px', overflowY: 'auto',
				padding: '13px 14px', background: '#f8fafd'
			}) + '"></div>' +
			/* drag up/down to grow the input box, shrink the conversation */
			'  <div id="eai-resize" title="拖动调整输入框高度" style="' + st({
				flex: '0 0 auto', height: '7px', cursor: 'ns-resize',
				display: 'flex', alignItems: 'center', justifyContent: 'center',
				background: C.bg, borderTop: '1px solid ' + C.border
			}) + '"><span style="' + st({
				width: '36px', height: '3px', borderRadius: '3px', background: '#d3dceb'
			}) + '"></span></div>' +
			/* quick actions sit right above the input box */
			'  <div id="eai-pills" style="' + st({
				display: 'flex', flexWrap: 'wrap', gap: '5px',
				padding: '7px 13px 2px', background: C.bg
			}) + '"></div>' +
			composeHtml() +
			'</div>' +

			'</div>';
	}

	/* ---------------------------------------------------------- compose -- */

	function chipStyle() {
		return st({
			display: 'flex', alignItems: 'center', gap: '5px', flex: '0 0 auto',
			maxWidth: '190px', background: '#f1f5fb', border: '1px solid #dce5f2',
			borderRadius: '7px', padding: '2px 4px 2px 3px'
		});
	}

	function composeHtml() {
		return '<div style="' + st({
			padding: '5px 13px 8px', background: C.bg
		}) + '">' +
			/*
			 * One rounded box.  The textarea fills it; the image button, the
			 * attachment chips and the send arrow are overlaid on its bottom
			 * edge, so they never steal a row from the text area.
			 */
			'<div id="eai-inputbox" style="' + st({
				position: 'relative', height: (UI._composeH || 100) + 'px', boxSizing: 'border-box',
				border: '1px solid ' + C.borderStrong, borderRadius: '12px',
				background: '#fff'
			}) + '">' +
			'  <textarea id="eai-input" class="eai-in" style="' + st({
				position: 'absolute', top: '0', left: '0', width: '100%', height: '100%',
				boxSizing: 'border-box', border: 'none', borderRadius: '12px',
				padding: '9px 46px 32px 11px', fontSize: '12.5px', fontFamily: FONT,
				color: C.text, outline: 'none', resize: 'none', lineHeight: '1.5',
				background: 'transparent', display: 'block', overflowY: 'auto'
			}) + '" placeholder="描述需求，或点胶囊按钮填入提示词…&#10;Ctrl + Enter 发送 · 可粘贴图片"></textarea>' +

			'  <div style="' + st({
				position: 'absolute', left: '8px', right: '46px', bottom: '7px',
				height: '26px', display: 'flex', alignItems: 'center', gap: '6px'
			}) + '">' +
			'    <a href="#" id="eai-btn-image" title="添加图片（也可直接粘贴）" style="' + st({
				width: '26px', height: '26px', borderRadius: '7px', flex: '0 0 auto',
				display: 'flex', alignItems: 'center', justifyContent: 'center',
				color: '#5a6b85', textDecoration: 'none', lineHeight: '0',
				background: '#f2f5fa'
			}) + '">' + svgIcon(ICONS.image, 15) + '</a>' +
			'    <div id="eai-chips" style="' + st({
				flex: '1 1 auto', minWidth: '0', display: 'flex',
				alignItems: 'center', gap: '5px', overflow: 'hidden'
			}) + '"></div>' +
			'    <select id="eai-model-pick" title="切换模型" style="' + st({
				height: '26px', maxWidth: '132px', boxSizing: 'border-box', padding: '0 6px',
				borderRadius: '999px', border: '1px solid #dbe4f1', background: '#fff',
				fontSize: '11px', color: '#2b4462', fontFamily: FONT, outline: 'none',
				flex: '0 0 auto'
			}) + '"></select>' +
			'  </div>' +

			'  <button id="eai-send" class="eai-btn" title="发送（Ctrl + Enter）" style="' + st({
				position: 'absolute', right: '7px', bottom: '6px',
				width: '30px', height: '30px', padding: '0', borderRadius: '9px',
				background: C.primary, border: '1px solid ' + C.primary, color: '#fff',
				display: 'flex', alignItems: 'center', justifyContent: 'center',
				boxShadow: '0 2px 8px rgba(47,111,191,.32)', boxSizing: 'border-box'
			}) + '">' + svgIcon(ICONS.send, 14, '#ffffff') + '</button>' +

			'  <input type="file" id="eai-file" accept="image/*" style="display:none">' +
			'</div>' +
			'</div>';
	}

	/* ------------------------------------------------------------ images -- */

	UI.renderChips = function () {
		if (!UI.dlgPanel) return;
		var $ = EAI.jq;
		var box = $('#eai-chips', UI.dlgPanel);
		if (!box.length) return;
		box.empty();
		pendingImages.forEach(function (img, i) {
			var chip = $('<div></div>');
			chip.attr('style', chipStyle());
			chip.append('<img src="' + img.dataUrl + '" alt="" style="' +
				st({
					width: '18px', height: '18px', objectFit: 'cover',
					borderRadius: '4px', display: 'block', flex: '0 0 auto'
				}) + '">');
			chip.append('<span style="' + st({
				fontSize: '11px', color: '#40536f', whiteSpace: 'nowrap',
				overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '118px'
			}) + '">' + U.esc(img.name || '图片') + '</span>');
			var x = $('<a href="#">&#10005;</a>');
			x.attr('style', st({
				fontSize: '10px', color: '#8b96a8', textDecoration: 'none',
				padding: '0 2px', flex: '0 0 auto', lineHeight: '1'
			}));
			x.on('click', function (e) {
				e.preventDefault();
				UI.removeImage(i);
			});
			chip.append(x);
			box.append(chip);
		});
	};

	UI.removeImage = function (i) {
		if (i < 0 || i >= pendingImages.length) return;
		pendingImages.splice(i, 1);
		UI.renderChips();
	};

	UI.attachImageFile = function (file, silent) {
		if (!file) return;
		if (!/^image\//i.test(file.type || '')) return;
		if (pendingImages.length >= 4) {
			UI.appendMsg('sys', '最多附加 4 张图片。');
			return;
		}
		var reader = new FileReader();
		reader.onload = function () {
			var dataUrl = String(reader.result || '');
			pendingImages.push({
				dataUrl: dataUrl,
				base64: dataUrl.split(',')[1] || '',
				mediaType: file.type || 'image/png',
				name: file.name || ('粘贴的图片 ' + (pendingImages.length + 1))
			});
			UI.renderChips();
			if (!silent) UI.appendMsg('sys', '已附加图片：' + (file.name || '剪贴板图片'));
		};
		reader.readAsDataURL(file);
	};

	/** Pulls image files out of a ClipboardEvent / DragEvent. */
	function imagesFromEvent(ev) {
		var out = [];
		var e = (ev && (ev.originalEvent || ev)) || {};
		var dt = e.clipboardData || e.dataTransfer;
		if (dt) {
			var items = dt.items;
			var i;
			if (items) {
				for (i = 0; i < items.length; i++) {
					if (items[i].kind === 'file' && /^image\//.test(items[i].type || '')) {
						var f = items[i].getAsFile();
						if (f) out.push(f);
					}
				}
			}
			if (!out.length && dt.files) {
				for (i = 0; i < dt.files.length; i++) {
					if (/^image\//.test(dt.files[i].type || '')) out.push(dt.files[i]);
				}
			}
		}
		return out;
	}

	/* ------------------------------------------------------------ panel -- */


	UI.openPanel = function () {
		injectStyle();
		var $ = EAI.jq;

		if (UI.dlgPanel && !isAlive(UI.dlgPanelCtl)) {
			UI.dlgPanel = null;
			UI.dlgPanelCtl = null;
		}
		if (UI.dlgPanel) {
			try { UI.dlgPanelCtl.open(); } catch (e) { /* ignore */ }
			UI.refreshStatus();
			return UI.dlgPanel;
		}

		var ctl = EAI.dlg({
			title: U.t('eai.panel.title', 'AI 助手'),
			width: 400,
			height: 640,
			modal: false,
			content: panelHtml()
		});
		if (!ctl) {
			EAI.toast('AI 助手面板打开失败，请看「设置 → 诊断」。', 'error');
			return null;
		}
		UI.dlgPanelCtl = ctl;
		var $d = ctl.el;
		UI.dlgPanel = $d;

		$('#eai-btn-settings', $d).on('click', function (e) {
			e.preventDefault(); UI.openSettings();
		});
		$('#eai-btn-clear', $d).on('click', function (e) {
			e.preventDefault();
			UI.clearChat();
		});

		$('#eai-btn-image', $d).on('click', function (e) {
			e.preventDefault();
			$('#eai-file', $d).trigger('click');
		});
		$('#eai-file', $d).on('change', function () {
			var f = this.files && this.files[0];
			if (f) UI.attachImageFile(f);
			this.value = '';
		});

		/* paste an image straight into the composer */
		$('#eai-input', $d).on('paste', function (e) {
			var files = imagesFromEvent(e);
			if (!files.length) return;
			e.preventDefault();
			files.forEach(function (f) { UI.attachImageFile(f); });
		});

		/* …or drop one onto it */
		$('#eai-inputbox', $d).on('dragover', function (e) {
			e.preventDefault();
			$(this).css('border-color', C.primary);
		}).on('dragleave', function () {
			$(this).css('border-color', C.borderStrong);
		}).on('drop', function (e) {
			e.preventDefault();
			$(this).css('border-color', C.borderStrong);
			imagesFromEvent(e).forEach(function (f) { UI.attachImageFile(f); });
		});

		/* drag the divider to re-size the input box */
		(function enableResize() {
			var handle = $('#eai-resize', $d);
			var box = $('#eai-inputbox', $d);
			if (!handle.length || !box.length) return;
			var dragging = false, startY = 0, startH = 0;

			handle.on('mousedown', function (e) {
				dragging = true;
				startY = e.clientY;
				startH = box[0].offsetHeight || UI._composeH || 112;
				e.preventDefault();
				$(document).off('.eairesize');
				$(document)
					.on('mousemove.eairesize', function (ev) {
						if (!dragging) return;
						var h = Math.max(84, startH - (ev.clientY - startY));

						/* never grow past the space the chat can give up, otherwise
						   the composer would be pushed out of the card */
						var chat = $('#eai-chat', UI.dlgPanel)[0];
						var room = (chat ? chat.offsetHeight : 0) + startH - 60;
						h = Math.max(84, Math.min(h, room));

						UI._composeH = h;
						UI._composeFloor = h;
						box.css('height', h + 'px');
					})
					.on('mouseup.eairesize', function () {
						dragging = false;
						$(document).off('.eairesize');
					});
			});
		})();

		$('#eai-model-pick', $d).on('change', function () {
			var v = String($(this).val() || '');
			var i = v.indexOf('|');
			if (i < 0) return;
			EAI.cfg.setActive(v.slice(0, i), v.slice(i + 1));
			UI.refreshStatus();
		});

		$('#eai-btn-log', $d).on('click', function (e) {
			e.preventDefault();
			UI.openLogWindow();
		});

		$('#eai-send', $d).on('click', function () {
			if (busy) {
				EAI.agent.stop();
				UI.appendMsg('sys', '正在停止…（等待当前请求返回）');
				return;
			}
			UI.send();
		});
		$('#eai-input', $d).on('keydown', function (e) {
			if (e.keyCode === 13 && (e.ctrlKey || e.metaKey)) { e.preventDefault(); UI.send(); }
		});

		/* designator links and the report card live inside the chat stream */
		$('#eai-chat', $d).on('click', '.eai-locate', function (e) {
			e.preventDefault();
			var pre = $(this).data('pre');
			var found = EAI.eda.locateComponent(pre) || EAI.eda.locateFootprint(pre);
			UI.appendMsg(found ? 'sys' : 'err', found ? ('已定位 ' + pre) : ('未找到 ' + pre));
		});

		$('#eai-chat', $d).on('click', '[data-eai-act]', function (e) {
			e.preventDefault();
			var act = $(this).attr('data-eai-act');
			var card = $(this).closest('[data-eai-card]');
			var md = card.length ? card.data('eai-report') : lastReport;
			if (act === 'preview') UI.openReportDialog(md);
			else { UI._previewMd = md || ''; UI.downloadReport(act); }
		});

		UI.renderPills();
		UI.renderModelPicker();
		UI.refreshStatus();
		UI.appendMsg('sys', '你好！当前文档：' + EAI.eda.docKindLabel() +
			'。点上面的胶囊按钮可以快速填入提示词，然后点「发送」。');
		return $d;
	};

	/** Wipes the conversation so the context does not grow forever. */
	UI.clearChat = function () {
		if (!UI.dlgPanel) return;
		var $ = EAI.jq;
		history.length = 0;
		lastReport = '';
		pendingImages.length = 0;
		UI._presetReport = false;
		UI._previewMd = '';
		$('#eai-chat', UI.dlgPanel).empty();
		UI.renderChips();
		var ta = $('#eai-input', UI.dlgPanel);
		if (ta.length) ta.val('');
		UI.appendMsg('sys', '会话已清空，可以开始新的对话。');
		EAI.log('chat cleared');
	};

	UI.activateTab = function (name) {
		if (!UI.dlgPanel) return;
		var $ = EAI.jq;
		$('.eai-tab', UI.dlgPanel).each(function () {
			var active = $(this).data('tab') === name;
			$(this).attr('style', segCss(active));
			if (active) $(this).addClass('eai-active'); else $(this).removeClass('eai-active');
		});
		$('.eai-pane', UI.dlgPanel).each(function () {
			if ($(this).data('pane') === name) $(this).css('display', 'block');
			else $(this).css('display', 'none');
		});
	};

	/* ------------------------------------------------------------ pills -- */

	UI.renderPills = function () {
		if (!UI.dlgPanel) return;
		var $ = EAI.jq;
		var box = $('#eai-pills', UI.dlgPanel);
		if (!box.length) return;
		box.empty();
		EAI.agent.presets().forEach(function (p) {
			var el = $('<span class="eai-pill"></span>');
			el.attr('data-preset', p.id);
			el.attr('style', st({
				display: 'inline-block', padding: '4px 11px', borderRadius: '999px',
				border: '1px solid #dbe4f1', background: '#ffffff',
				color: '#2b4462', fontSize: '11.5px', userSelect: 'none',
				whiteSpace: 'nowrap', cursor: 'pointer', lineHeight: '1.5'
			}));
			el.append(document.createTextNode(p.label));
			el.on('click', function () { UI.usePreset(p); });
			box.append(el);
		});
	};

	UI.usePreset = function (p) {
		if (!UI.dlgPanel) return;
		UI._presetReport = !!p.report;
		var $ = EAI.jq;
		var ta = $('#eai-input', UI.dlgPanel);
		if (!ta.length) return;
		ta.val(p.prompt || '');
		ta.focus();
		try {
			var el = ta[0];
			el.setSelectionRange(el.value.length, el.value.length);
		} catch (e) { /* ignore */ }
		UI.appendMsg('sys', p.prompt
			? ('已填入「' + p.label + '」提示词，可自行修改后发送。')
			: '直接输入你的问题即可。');
	};

	/* ----------------------------------------------------------- status -- */

	UI.refreshStatus = function () {
		if (!UI.dlgPanel) return;
		var $ = EAI.jq;
		var cfg = EAI.cfg.current();
		var txt = cfg.model
			? ((cfg.providerName || (cfg.provider === 'anthropic' ? 'Claude' : 'OpenAI')) +
				' · ' + cfg.model)
			: '未配置';
		if (!cfg.apiKey) txt = '未配置';
		var sub = $('#eai-sub', UI.dlgPanel);
		if (sub.length) {
			try {
				sub.text(EAI.eda.docKindLabel() + ' · ' +
					(EAI.eda.activeTitle() || '未打开文档') + ' · ' + txt)
					.attr('title', EAI.llm.endpoint(cfg));
			} catch (e) { /* ignore */ }
		}
	};

	/* ----------------------------------------------------------- output -- */

	function bubbleStyle(role) {
		var base = {
			padding: '9px 12px', borderRadius: '11px',
			background: '#ffffff', border: '1px solid ' + C.border,
			color: C.text, wordBreak: 'break-word', overflowWrap: 'anywhere'
		};
		if (role === 'user') { base.background = '#eef5ff'; base.borderColor = '#cfe0fb'; }
		if (role === 'sys') { base.background = '#fff8e9'; base.borderColor = '#f0dfb6'; base.color = '#7a5b16'; base.fontSize = '12.5px'; }
		if (role === 'err') { base.background = '#fdeeee'; base.borderColor = '#f2c8c8'; base.color = '#932626'; }
		return st(base);
	}

	function avatarStyle(role) {
		var bg = role === 'user' ? '#5b8fd6'
			: role === 'ai' ? C.primaryDark
				: role === 'err' ? '#c0392b' : '#8c9aad';
		return st({
			width: '28px', height: '28px', borderRadius: '9px', flex: '0 0 auto',
			background: bg, color: '#ffffff', display: 'flex',
			alignItems: 'center', justifyContent: 'center'
		});
	}

	function avatarIcon(role) {
		if (role === 'user') {
			return svgIcon('<circle cx="12" cy="8" r="3.4"/>' +
				'<path d="M5.6 20c0-3.5 2.9-5.8 6.4-5.8s6.4 2.3 6.4 5.8"/>', 15);
		}
		if (role === 'ai') {
			return svgIcon('<path d="M11.4 3.6l1.6 4.2 4.2 1.6-4.2 1.6-1.6 4.2-1.6-4.2L5.6 9.4l4.2-1.6z"/>' +
				'<path d="M18 15.2l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z"/>', 15);
		}
		if (role === 'err') {
			return svgIcon('<path d="M12 4.6l8.4 14.8H3.6z"/><path d="M12 10v4"/>' +
				'<circle cx="12" cy="16.8" r="0.7"/>', 15);
		}
		return svgIcon('<circle cx="12" cy="12" r="8.4"/><path d="M12 11v5"/>' +
			'<circle cx="12" cy="8.1" r="0.7"/>', 15);
	}

	UI.appendMsg = function (role, text, opts) {
		if (!UI.dlgPanel) return null;
		var $ = EAI.jq;
		var box = $('#eai-chat', UI.dlgPanel);
		if (!box.length) return null;
		opts = opts || {};

		var isUser = role === 'user';
		var who = isUser ? '你' : role === 'ai' ? 'AI' : role === 'err' ? '错误' : '系统';

		var el = $('<div class="eai-msg"></div>');
		el.attr('style', st({
			display: 'flex', gap: '9px', marginBottom: '11px', alignItems: 'flex-start',
			flexDirection: isUser ? 'row-reverse' : 'row'
		}));
		el.append('<div style="' + avatarStyle(role) + '">' + avatarIcon(role) + '</div>');

		var body = $('<div></div>');
		body.attr('style', st({
			flex: '1 1 auto', minWidth: '0', display: 'flex',
			flexDirection: 'column',
			alignItems: isUser ? 'flex-end' : 'stretch'
		}));
		body.append('<div style="' + st({
			fontSize: '11px', color: C.muted, marginBottom: '3px',
			textAlign: isUser ? 'right' : 'left'
		}) + '">' + who + '</div>');

		var raw = (opts.raw !== undefined) ? opts.raw : (text || '');

		var bubble = $('<div class="eai-bubble"></div>');
		bubble.attr('style', bubbleStyle(role) + (isUser ? ';max-width:82%' : ''));
		if (opts.html) bubble.html(opts.html);
		else bubble.text(text || '');
		bubble.data('eai-raw', raw);

		body.append(bubble);

		/* a copy button under every AI / error answer — handy to paste into
		   a bug report */
		if ((role === 'ai' || role === 'err') && raw) {
			var foot = $('<div></div>');
			foot.attr('style', st({
				display: 'flex', gap: '6px', marginTop: '3px',
				justifyContent: isUser ? 'flex-end' : 'flex-start'
			}));
			var cbtn = $('<a href="#" title="复制这条内容"></a>');
			cbtn.attr('style', st({
				display: 'inline-flex', alignItems: 'center', gap: '4px',
				color: '#8794a8', textDecoration: 'none', fontSize: '11px',
				padding: '2px 7px 2px 5px', borderRadius: '6px',
				background: 'transparent', lineHeight: '1.6'
			}));
			cbtn.append(svgIcon(ICONS.copy, 13));
			cbtn.append(document.createTextNode(' 复制'));
			cbtn.on('click', function (e) {
				e.preventDefault();
				UI.copyText(bubble.data('eai-raw') || '', cbtn);
			});
			foot.append(cbtn);
			body.append(foot);
		}

		el.append(body);
		box.append(el);
		box[0].scrollTop = box[0].scrollHeight;
		return bubble;
	};

	UI.appendTool = function (name, args) {
		if (!UI.dlgPanel) return null;
		var $ = EAI.jq;
		var box = $('#eai-chat', UI.dlgPanel);
		if (!box.length) return null;

		var el = $('<div class="eai-tool">');
		el.attr('style', st({ display: 'flex', gap: '10px', marginBottom: '9px', alignItems: 'flex-start' }));
		el.append('<div style="' + st({
			width: '28px', height: '28px', borderRadius: '9px', background: C.green,
			color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
			fontSize: '12px', flex: '0 0 auto'
		}) + '">&#9881;</div>');

		var chip = $('<div class="eai-chip"></div>');
		chip.attr('style', st({
			fontSize: '12px', color: C.green, background: '#e8f7f4', border: '1px solid #bfe6df',
			borderRadius: '8px', padding: '5px 11px', maxWidth: '100%',
			overflow: 'hidden', textOverflow: 'ellipsis'
		}));
		chip.append('<b>' + U.esc(name) + '</b> ');
		var a = args === undefined ? '' : U.fmt(args, 150).replace(/\s+/g, ' ');
		chip.append('<span style="color:#5f7a76;font-family:' + MONO + ';font-size:11px">' +
			U.esc(a) + '</span>');

		el.append(chip);
		box.append(el);
		box[0].scrollTop = box[0].scrollHeight;
		return chip;
	};

	/* ------------------------------------------------------------- send -- */

	/* The input height is driven ONLY by the divider (no auto-grow):
	   the textarea fills the box and scrolls internally. */
	UI.autoGrow = function () { /* kept for compatibility */ };

	/** Model switcher next to the send button. */
	UI.renderModelPicker = function () {
		if (!UI.dlgPanel) return;
		var $ = EAI.jq;
		var sel = $('#eai-model-pick', UI.dlgPanel);
		if (!sel.length) return;

		var raw = EAI.cfg.raw();
		var provs = raw.providers || [];
		sel.empty();

		provs.forEach(function (p) {
			var models = p.models || [];
			if (!models.length) return;
			var g = $('<optgroup></optgroup>').attr('label', p.name || 'Provider');
			models.forEach(function (m) {
				var o = $('<option></option>')
					.attr('value', p.id + '|' + m.id)
					.text(m.name || '(未命名)');
				if (p.id === (raw.active && raw.active.providerId) &&
					m.id === (raw.active && raw.active.modelId)) {
					o.attr('selected', 'selected');
				}
				g.append(o);
			});
			sel.append(g);
		});

		if (!sel.children().length) sel.append('<option value="">未配置</option>');
	};

	/** Swaps the send arrow for a stop square while the agent is running. */
	UI.setBusy = function (on) {
		busy = !!on;
		if (!UI.dlgPanel) return;
		var $ = EAI.jq;
		var btn = $('#eai-send', UI.dlgPanel);
		if (!btn.length) return;
		if (on) {
			btn.html(svgIcon(ICONS.stop, 13, '#ffffff'))
				.attr('title', '停止')
				.css({ background: '#c05353', borderColor: '#c05353' });
		} else {
			btn.html(svgIcon(ICONS.send, 14, '#ffffff'))
				.attr('title', '发送（Ctrl + Enter）')
				.css({ background: C.primary, borderColor: C.primary });
		}
	};

	UI.send = function () {
		if (busy) { UI.appendMsg('sys', '正在处理，请稍候或点「停止」。'); return; }
		if (!UI.dlgPanel) { UI.openPanel(); return; }
		var $ = EAI.jq;

		var ta = $('#eai-input', UI.dlgPanel);
		var text = (ta.val() || '').trim();
		if (!text && !pendingImages.length) return;

		if (!EAI.cfg.ready()) {
			UI.appendMsg('err', '还没有配置模型。请先在「设置」里填写接口地址、API Key 和模型名。');
			UI.openSettings();
			return;
		}

		var userMsg = { role: 'user', content: [] };
		if (text) userMsg.content.push({ type: 'text', text: text });
		pendingImages.forEach(function (img) {
			userMsg.content.push({
				type: 'image', mediaType: img.mediaType, data: img.base64
			});
		});

		ta.val('');
		pendingImages.length = 0;
		UI.renderChips();

		UI.appendMsg('user', text || '(图片)');

		/* each submission is self-contained: drop images from earlier turns so a
		   new symbol can never be built from an old screenshot */
		history.forEach(function (m) {
			if (m.content) {
				m.content = m.content.filter(function (p) { return p.type !== 'image'; });
			}
		});

		history.push(userMsg);
		UI.runAgent(history);
	};

	UI.runAgent = function (msgs) {
		var $ = EAI.jq;
		UI.setBusy(true);

		var cfg = EAI.cfg.current();
		var system = {
			role: 'system',
			content: [{
				type: 'text',
				text: [
					'你是一位资深硬件工程师，作为插件运行在 EasyEDA（嘉立创EDA 标准版）里。',
					'你可以通过工具直接读取和修改用户当前打开的文档。',
					'当前文档类型：' + EAI.eda.docKindLabel() + '。',
					'回答语言：' + (cfg.language === 'en' ? 'English' : '中文') + '。',
					'规则：',
					'1. 需要数据时先调用工具，不要凭空猜测电路内容；',
					'2. 提到元件时使用准确位号（R12、C3、U1），这样用户能点它定位；',
					'3. 修改文档前先说明你打算改什么；修改后用简短话语汇报；',
					'4. 用 Markdown 输出，网表/BOM 用表格；评审结论按「严重 / 一般 / 建议」分级。',
					'5. 工具调用结束后必须给出**完整**的最终结论；不要只写「接下来将…」就停止。',
					'6. 对话里可能有多张历史图片：生成符号时只使用**当前这条消息**的图片，' +
					'绝不要把之前会话的图片再做一遍。',
					'7. create_symbol 一次调用就会画好矩形框、逐个引脚与 c_para 属性，' +
					'调用后不要再截图核对或反复修正。',
					'8. 画原理图时必须优先用系统库：先 search_library 搜型号，命中就 ' +
					'place_device 放置；只有系统库没有时，才用 create_symbol 凭你的知识' +
					'生成符号（给出符号名、引脚编号、引脚名称）并直接放到画布。'
				].join('\n')
			}]
		};

		var aiBubble = null;
		var lastText = '';

		EAI.agent.run({
			messages: [system].concat(msgs),
			onEvent: function (ev) {
				if (!UI.dlgPanel) return;
				if (ev.type === 'text' && ev.text) {
					lastText = ev.text;
					if (!aiBubble) {
						aiBubble = UI.appendMsg('ai', '', { html: UI.mdToHtml(ev.text), raw: ev.text });
					} else {
						aiBubble.html(UI.mdToHtml(ev.text));
						aiBubble.data('eai-raw', ev.text);
					}
					var box = $('#eai-chat', UI.dlgPanel);
					if (box.length) box[0].scrollTop = box[0].scrollHeight;
				} else if (ev.type === 'tool') {
					UI.appendTool(ev.name, ev.args);
				} else if (ev.type === 'image') {
					UI.appendMsg('sys', '已截取画布 ' + ev.width + 'x' + ev.height + ' 并发送给模型。');
				}
			}
		}).then(function (r) {
			var finalText = String(r.text || '').trim();
			if (finalText) {
				history.push({ role: 'assistant', content: [{ type: 'text', text: finalText }] });
				if (!aiBubble) UI.appendMsg('ai', '', { html: UI.mdToHtml(finalText), raw: finalText });
				/* only the review / analysis features produce a report card */
				if (UI._presetReport) UI.showReport(finalText);
			} else if (r.limitReached) {
				UI.appendMsg('err', '达到「最大工具步数」上限，模型仍未给出最终结论。' +
					'可以在设置里把这个值调大，或再发一句「继续」。');
			} else if (lastText) {
				UI.appendMsg('sys', '模型只返回了中间说明（已在上方显示），没有给出最终结论。' +
					'可以再发一句「请给出最终报告」，或换一个指令跟随更好的模型。');
			} else {
				UI.appendMsg('err', '模型没有返回内容。请检查接口地址与模型名，或查看「日志」页。');
			}
			if (r.aborted) UI.appendMsg('sys', '已停止。');
		}).catch(function (err) {
			var msg = err && err.message ? err.message : String(err);
			UI.appendMsg('err', msg);
			if (err && err.isCors) {
				UI.appendMsg('sys', '这是浏览器跨域（CORS）限制。请确认接口地址允许跨域访问，或改用官方域名。');
			}
			EAI.log('agent failed: ' + msg, 'error');
		}).then(function () {
			UI.setBusy(false);
			UI._presetReport = false;
			UI.refreshStatus();
		});
	};

})();
