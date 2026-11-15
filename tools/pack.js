#!/usr/bin/env node
/*
 * Builds the extension and ships it as a versioned zip.
 *
 *   node tools/pack.js                  # patch version +1
 *   node tools/pack.js --version 1.2.3  # explicit version
 *   node tools/pack.js --no-zip         # unpacked folder only
 *
 * Output (all under dist/, which is git-ignored):
 *   dist/<project>-v<version>/          unpacked — used to load locally
 *   dist/<project>-v<version>.zip       the artifact published with a release
 *
 * The zip holds the extension files at its root (no wrapper folder) so that
 * "加载扩展 / Load extension" can select every file at once.
 *
 * The extension id is NOT baked into the build: the installer asks the user
 * for any id and the extension detects it at runtime (see discoverExtId).
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'extension');
const DIST = path.join(ROOT, 'dist');
const PROJECT = 'ext-easyeda-std-ai-assistant';

/* every file the installer needs — a missing one breaks the load at runtime */
const REQUIRED = [
	'manifest.json', 'locale.txt', 'icon.svg',
	'core.js', 'prompts.js', 'i18n.js', 'llm.js', 'eda.js', 'eda-netlist.js',
	'actions.js', 'tools.js', 'agent.js',
	'ui-base.js', 'ui.js', 'ui-report.js', 'ui-settings.js', 'ui-about.js', 'main.js'
];

/* --------------------------------------------------------------- version -- */

/**
 * Every build bumps the patch number: 0.0.1 -> 0.0.2 -> 0.0.3 ...
 * manifest.json is the single source of truth; the extension reads the same
 * value at runtime for its About page and diagnostics.
 */
function bumpVersion(explicit) {
	const file = path.join(SRC, 'manifest.json');
	const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
	const from = manifest.version || '0.0.0';

	if (explicit) {
		manifest.version = String(explicit).replace(/^v/i, '');
		fs.writeFileSync(file, JSON.stringify(manifest, null, '\t') + '\n');
		return { from, to: manifest.version };
	}

	const parts = String(from).split('.').map(function (n) {
		const v = parseInt(n, 10);
		return isFinite(v) && v >= 0 ? v : 0;
	});
	while (parts.length < 3) parts.push(0);
	parts[2] += 1;
	manifest.version = parts.join('.');
	fs.writeFileSync(file, JSON.stringify(manifest, null, '\t') + '\n');
	return { from, to: manifest.version };
}

/* ------------------------------------------------------------------- zip -- */

const CRC_TABLE = (function () {
	const table = new Int32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
		table[n] = c;
	}
	return table;
})();

function crc32(buf) {
	let c = -1;
	for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
	return (c ^ -1) >>> 0;
}

/**
 * Writes a deflate zip without any dependency, so the same build works on
 * Windows, macOS and CI runners.
 *
 * @param {{name:string, data:Buffer}[]} entries
 */
function writeZip(entries, outPath) {
	const now = new Date();
	const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) |
		Math.floor(now.getSeconds() / 2)) & 0xFFFF;
	const dosDate = (((now.getFullYear() - 1980) << 9) |
		((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;

	const local = [];
	const central = [];
	let offset = 0;

	entries.forEach(function (entry) {
		const name = Buffer.from(entry.name, 'utf8');
		const packed = zlib.deflateRawSync(entry.data);
		const crc = crc32(entry.data);

		const lh = Buffer.alloc(30);
		lh.writeUInt32LE(0x04034b50, 0);   /* local file header */
		lh.writeUInt16LE(20, 4);           /* version needed */
		lh.writeUInt16LE(0x0800, 6);       /* UTF-8 name */
		lh.writeUInt16LE(8, 8);            /* deflate */
		lh.writeUInt16LE(dosTime, 10);
		lh.writeUInt16LE(dosDate, 12);
		lh.writeUInt32LE(crc, 14);
		lh.writeUInt32LE(packed.length, 18);
		lh.writeUInt32LE(entry.data.length, 22);
		lh.writeUInt16LE(name.length, 26);
		lh.writeUInt16LE(0, 28);
		local.push(lh, name, packed);

		const ch = Buffer.alloc(46);
		ch.writeUInt32LE(0x02014b50, 0);   /* central directory header */
		ch.writeUInt16LE(20, 4);
		ch.writeUInt16LE(20, 6);
		ch.writeUInt16LE(0x0800, 8);
		ch.writeUInt16LE(8, 10);
		ch.writeUInt16LE(dosTime, 12);
		ch.writeUInt16LE(dosDate, 14);
		ch.writeUInt32LE(crc, 16);
		ch.writeUInt32LE(packed.length, 20);
		ch.writeUInt32LE(entry.data.length, 24);
		ch.writeUInt16LE(name.length, 28);
		ch.writeUInt16LE(0, 30);           /* extra */
		ch.writeUInt16LE(0, 32);           /* comment */
		ch.writeUInt16LE(0, 34);           /* disk */
		ch.writeUInt16LE(0, 36);           /* internal attrs */
		ch.writeUInt32LE(0, 38);           /* external attrs */
		ch.writeUInt32LE(offset, 42);
		central.push(ch, name);

		offset += lh.length + name.length + packed.length;
	});

	const centralBuf = Buffer.concat(central);
	const eocd = Buffer.alloc(22);
	eocd.writeUInt32LE(0x06054b50, 0);
	eocd.writeUInt16LE(0, 4);
	eocd.writeUInt16LE(0, 6);
	eocd.writeUInt16LE(entries.length, 8);
	eocd.writeUInt16LE(entries.length, 10);
	eocd.writeUInt32LE(centralBuf.length, 12);
	eocd.writeUInt32LE(offset, 16);
	eocd.writeUInt16LE(0, 20);

	fs.writeFileSync(outPath, Buffer.concat(local.concat([centralBuf, eocd])));
}

/* ------------------------------------------------------------- installer -- */

function installNotes(version) {
	const bar = '='.repeat(46);
	return [
		'AI 助手 · EasyEDA 标准版扩展',
		bar,
		'',
		'版本：v' + version,
		'',
		'安装步骤',
		'--------',
		'1. 打开 EasyEDA 标准版 → 高级 → 扩展 → 扩展配置',
		'2. 点击「加载扩展 / Load extension」',
		'3. 一次性全选本目录下的所有文件（manifest.json / locale.txt / icon*.* / *.js）',
		'4. 扩展 ID 自行填写一个英文标识（例如 aiassistant），记下来即可',
		'5. 确认后刷新页面，工具栏出现「AI 助手」按钮',
		'6. 高级菜单 → AI 助手 → 设置… 里填写接口地址 / API Key / 模型',
		'',
		'注意',
		'----',
		'· 文件必须全选，且不能放在子目录里（加载器按文件名匹配 manifest 的 scripts）',
		'· 扩展 ID 安装后不要改：命令名与本地配置都以它为键',
		'· 如果按钮/菜单出现但点不动，打开 设置 → 诊断 复制信息排查'
	].join('\r\n');
}

/* ------------------------------------------------------------------ main -- */

function main() {
	const vIdx = process.argv.indexOf('--version');
	const explicitVersion = vIdx >= 0 ? process.argv[vIdx + 1] : null;
	const noZip = process.argv.indexOf('--no-zip') >= 0;

	/* sanity: every file the extension needs must exist */
	const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
	const missing = REQUIRED.concat(manifest.scripts || [])
		.filter((f, i, a) => a.indexOf(f) === i)
		.filter((f) => !fs.existsSync(path.join(SRC, f)));
	if (missing.length) {
		console.error('Missing files:\n  ' + missing.join('\n  '));
		process.exit(1);
	}

	const { from, to } = bumpVersion(explicitVersion);

	const name = PROJECT + '-v' + to;
	const out = path.join(DIST, name);
	fs.rmSync(out, { recursive: true, force: true });
	fs.mkdirSync(out, { recursive: true });

	const files = fs.readdirSync(SRC).filter((f) => fs.statSync(path.join(SRC, f)).isFile());
	files.forEach((f) => fs.copyFileSync(path.join(SRC, f), path.join(out, f)));
	fs.writeFileSync(path.join(out, '安装说明.txt'), installNotes(to), 'utf8');

	let zipPath = null;
	if (!noZip) {
		zipPath = path.join(DIST, name + '.zip');
		const entries = fs.readdirSync(out).sort().map(function (f) {
			return { name: f, data: fs.readFileSync(path.join(out, f)) };
		});
		writeZip(entries, zipPath);
	}

	console.log('version: ' + from + ' -> ' + to);
	console.log('  folder : dist/' + name + '/  (' + files.length + ' files)');
	if (zipPath) console.log('  zip    : dist/' + name + '.zip');
}

main();
