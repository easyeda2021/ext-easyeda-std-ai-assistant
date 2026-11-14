/* =====================================================================
 * EasyEDA Std extension — "AI Assistant"
 * main.js — bootstrap: menu entries, toolbar button and commands
 *
 * A Std extension is activated from
 *   高级 > 扩展 > 扩展配置  (Advanced > Extension > Extension configuration)
 * and it gets its own id from the installer.  Every command therefore has
 * to be named "extension-<id>-<command>".
 * ===================================================================== */
(function () {
	'use strict';

	var EAI = (window.EAI = window.EAI || {});
	var U = EAI.util;

	if (!EAI.api) {
		EAI.log('the extension API is not available — aborting', 'error');
		return;
	}

	var extId = EAI.discoverExtId();
	EAI.log('AI Assistant ' + EAI.ver + ' starting (id=' + extId + ')');

	/* --------------------------------------------------------- commands -- */

	function needDoc(types) {
		var dt = EAI.eda.docType();
		if (!dt) {
			EAI.toast(U.t('eai.hint.noDoc', 'Please open a schematic or a PCB first.'), 'warn');
			return null;
		}
		if (types && types.indexOf(dt) < 0) {
			EAI.toast('This action needs an open ' + types.join(' / ') + ' document.', 'warn');
			return null;
		}
		return dt;
	}

	function cmdPanel() {
		EAI.ui.openPanel();
	}

	function cmdSettings() {
		EAI.ui.openSettings();
	}

	function cmdReview() {
		if (!needDoc(null)) return;
		EAI.ui.openPanel();
		EAI.ui.runAction('review');
	}

	function cmdBom() {
		if (!needDoc(null)) return;
		EAI.ui.openPanel();
		EAI.ui.runAction('bom');
	}

	function cmdSnapshot() {
		if (!needDoc(null)) return;
		EAI.ui.openPanel();
		EAI.ui.runAction('snapshot');
	}

	function cmdEdit() {
		if (!needDoc(null)) return;
		EAI.ui.openPanel();
		EAI.ui.runAction('edit');
	}

	function cmdGenerate() {
		if (!needDoc(null)) return;
		EAI.ui.openPanel();
		EAI.ui.runAction('generate');
	}

	function cmdSymbol() {
		if (!needDoc(null)) return;
		EAI.ui.openPanel();
		EAI.ui.runAction('symbol');
	}

	function cmdAbout() {
		var cfg = EAI.cfg.current();
		EAI.toast('AI Assistant v' + EAI.ver + '\n' +
			'protocol: ' + cfg.provider + '\n' +
			'model: ' + (cfg.model || '-') + '\n' +
			'endpoint: ' + (cfg.baseUrl || '-'));
	}

	var commands = {};
	commands[EAI.cmd('panel')] = cmdPanel;
	commands[EAI.cmd('settings')] = cmdSettings;
	commands[EAI.cmd('review')] = cmdReview;
	commands[EAI.cmd('bom')] = cmdBom;
	commands[EAI.cmd('snapshot')] = cmdSnapshot;
	commands[EAI.cmd('edit')] = cmdEdit;
	commands[EAI.cmd('generate')] = cmdGenerate;
	commands[EAI.cmd('symbol')] = cmdSymbol;
	commands[EAI.cmd('about')] = cmdAbout;

	try {
		EAI.api('createCommand', commands);
	} catch (e) {
		EAI.log('createCommand failed: ' + e, 'error');
	}

	/* ------------------------------------------------------------ menus -- */

	function label(key, fallback) { return U.t(key, fallback); }

	var menuItems = [
		{
			text: label('eai.menu.settings', 'AI Settings...'),
			fordoctype: 'all',
			cmd: EAI.cmd('settings')
		},
		{
			text: label('eai.menu.review', 'AI Schematic Review (Netlist)'),
			fordoctype: 'sch',
			cmd: EAI.cmd('review')
		},
		{
			text: label('eai.menu.bom', 'AI BOM Analysis'),
			fordoctype: 'sch,pcb',
			cmd: EAI.cmd('bom')
		},
		{
			text: label('eai.menu.snapshot', 'AI Snapshot Review'),
			fordoctype: 'sch,pcb',
			cmd: EAI.cmd('snapshot')
		},
		{
			text: label('eai.menu.edit', 'AI Batch Edit (Value / Designator)'),
			fordoctype: 'sch',
			cmd: EAI.cmd('edit')
		},
		{
			text: label('eai.menu.generate', 'AI Generate Schematic'),
			fordoctype: 'sch',
			cmd: EAI.cmd('generate')
		},
		{
			text: label('eai.menu.symbol', 'AI Symbol from Image'),
			fordoctype: 'sch,schlib',
			cmd: EAI.cmd('symbol')
		},
		{
			text: label('eai.menu.about', 'About AI Assistant'),
			fordoctype: 'all',
			cmd: EAI.cmd('about')
		}
	];

	try {
		EAI.api('createExtensionMenu', menuItems);
	} catch (e) {
		EAI.log('createExtensionMenu failed: ' + e, 'error');
	}

	/* ----------------------------------------------------- toolbar button */

	try {
		var icon = EAI.api('getRes', 'icon.svg');
		EAI.api('createToolbarButton', {
			icon: icon || '',
			title: 'AI Assistant',
			text: 'AI',
			fordoctype: 'sch,pcb',
			cmd: EAI.cmd('panel'),
			menu: menuItems
		});
	} catch (e) {
		EAI.log('createToolbarButton failed: ' + e, 'error');
	}

	/* ------------------------------------------------------------- done -- */

	EAI.log('AI Assistant ready.');
})();
