#!/usr/bin/env node
/*
 * Packages the extension into dist/ and gives it a stable, generated ID.
 *
 * EasyEDA Std asks the user to type the extension ID when installing a
 * local extension, and that ID becomes part of every command name
 * ("extension-<id>-<command>").  A random-looking but valid id is
 * generated once and remembered in tools/.extension-id.json, so that
 * repacking never invalidates previously registered commands.
 *
 *   node tools/pack.js            # build dist/
 *   node tools/pack.js --new-id   # force a new id
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'extension');
const DIST = path.join(ROOT, 'dist');
const ID_FILE = path.join(__dirname, '.extension-id.json');

const REQUIRED = [
	'manifest.json', 'locale.txt', 'icon.svg',
	'icon16.png', 'icon24.png', 'icon32.png',
	'core.js', 'llm.js', 'eda.js', 'actions.js', 'tools.js', 'agent.js', 'ui.js', 'main.js'
];

function readOrCreateId(forceNew) {
	let cur = null;
	try { cur = JSON.parse(fs.readFileSync(ID_FILE, 'utf8')); } catch (e) { /* none yet */ }
	if (cur && cur.id && !forceNew) return cur.id;

	/* \w+ only — that is what the Std installer validates */
	const id = 'aia' + crypto.randomBytes(4).toString('hex');
	fs.writeFileSync(ID_FILE, JSON.stringify({ id, createdAt: new Date().toISOString() }, null, 2));
	return id;
}

function main() {
	const forceNew = process.argv.indexOf('--new-id') >= 0;
	const id = readOrCreateId(forceNew);

	/* sanity: every declared file must exist */
	const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
	const missing = REQUIRED.concat(manifest.scripts || [])
		.filter((f, i, a) => a.indexOf(f) === i)
		.filter((f) => !fs.existsSync(path.join(SRC, f)));
	if (missing.length) {
		console.error('Missing files:\n  ' + missing.join('\n  '));
		process.exit(1);
	}

	/* build dist/<id>/ */
	const out = path.join(DIST, id);
	fs.mkdirSync(out, { recursive: true });
	const files = fs.readdirSync(SRC).filter((f) => fs.statSync(path.join(SRC, f)).isFile());
	files.forEach((f) => fs.copyFileSync(path.join(SRC, f), path.join(out, f)));

	const readme = [
		'AI 助手 · EasyEDA 标准版扩展',
		'============================',
		'',
		'扩展 ID（安装时填写）：' + id,
		'',
		'安装步骤',
		'--------',
		'1. 打开 EasyEDA 标准版 → 高级 → 扩展 → 扩展配置',
		'2. 点击「加载扩展 / Load extension」',
		'3. 一次性全选本目录下的所有文件（manifest.json / locale.txt / icon*.* / *.js）',
		'4. 扩展 ID 填写：' + id,
		'5. 确认后编辑器重新加载脚本，工具栏出现「AI助手」按钮',
		'6. 高级菜单 → AI 助手 → 设置… 里填写接口地址 / API Key / 模型',
		'',
		'注意',
		'----',
		'· 文件必须全选，且不能放在子目录里（加载器按文件名匹配 manifest 的 scripts）',
		'· 扩展 ID 一旦安装就不要改，命令名依赖它',
		'· 如果按钮/菜单出现但点不动，打开 设置 → 诊断 复制信息排查'
	].join('\r\n');
	fs.writeFileSync(path.join(out, '安装说明.txt'), readme, 'utf8');

	console.log('packed → dist/' + id);
	console.log('  files: ' + files.length);
	console.log('  extension id: ' + id);
	console.log('\nInstall: 高级 → 扩展 → 扩展配置 → 加载扩展, 全选 dist/' + id + ' 下的文件, ID 填 ' + id);
}

main();
