/* =====================================================================
 * EasyEDA Std extension — "AI Assistant" / AI 助手
 * main.js — bootstrap: menu entries, toolbar button and commands
 *
 * The Std client appends extension menus directly to 「高级」, so a plain
 * flat list would bury the design flow.  Everything therefore lives in a
 * single nested entry:     高级 ▸ AI 助手 ▸ { AI 助手…, 设置…, 关于… }
 * ===================================================================== */
(function () {
	'use strict';

	var EAI = (window.EAI = window.EAI || {});
	var U = EAI.util;

	if (!EAI.api) {
		try { console.error('[EAI] the extension API is not available'); } catch (e) { /* ignore */ }
		return;
	}

	var extId = EAI.discoverExtId();
	EAI.log('AI 助手 ' + EAI.ver + ' starting (id=' + extId + ')');

	/* ------------------------------------------------------------ commands -- */

	var CMD = {
		panel: function () {
			EAI.log('command: open panel');
			EAI.ui.openPanel();
		},
		settings: function () {
			EAI.log('command: open settings');
			EAI.ui.openSettings();
		},
		about: function () {
			EAI.log('command: open about');
			EAI.ui.openAbout();
		}
	};

	var commands = {};
	Object.keys(CMD).forEach(function (k) {
		commands[EAI.cmd(k)] = CMD[k];
	});

	try {
		EAI.api('createCommand', commands);
		EAI.log('commands registered: ' + Object.keys(commands).join(', '));
	} catch (e) {
		EAI.log('createCommand failed: ' + (e && e.message ? e.message : e), 'error');
	}

	/* --------------------------------------------------------------- menu -- */

	var submenu = [
		{ text: 'AI 助手…', cmd: EAI.cmd('panel') },
		{ text: '设置…', cmd: EAI.cmd('settings') },
		{ text: '关于…', cmd: EAI.cmd('about') }
	];

	try {
		EAI.api('createExtensionMenu', [{
			text: 'AI 助手',
			fordoctype: 'all',
			submenu: submenu
		}]);
		EAI.log('menu registered under 高级 ▸ AI 助手');
	} catch (e) {
		EAI.log('createExtensionMenu failed: ' + (e && e.message ? e.message : e), 'error');
	}

	/* ------------------------------------------------------ toolbar button -- */

	try {
		var icon = '';
		try { icon = EAI.api('getRes', 'icon.svg') || ''; } catch (e) { /* ignore */ }

		EAI.api('createToolbarButton', {
			icon: icon,
			title: 'AI 助手',
			text: 'AI助手',
			fordoctype: 'sch,pcb,schlib,pcblib',
			cmd: EAI.cmd('panel'),
			menu: submenu
		});
		EAI.log('toolbar button registered');
	} catch (e) {
		EAI.log('createToolbarButton failed: ' + (e && e.message ? e.message : e), 'error');
	}

	EAI.log('AI 助手 ready.');
	/* drop the full diagnostics into the log so a failing install is obvious */
	EAI.log('— diagnostics —');
	EAI.diagnostics().split(String.fromCharCode(10)).forEach(function (l) { EAI.log(l); });
})();
