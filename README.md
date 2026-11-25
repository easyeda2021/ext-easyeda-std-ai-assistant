# AI Assistant · EasyEDA Std Extension

[中文](README.zh-CN.md) · Repository: <https://github.com/easyeda2021/ext-easyeda-std-ai-assistant>

Bring an LLM into the **EasyEDA Std** schematic and PCB editor: schematic review,
BOM analysis and component standardisation, PCB / canvas visual review, schematic
generation from a requirement, and symbol generation from an image.

> **EasyEDA Std only** (v6). The Pro edition's `.eext` and
> `eda.dmt_*` APIs are a different system and are not supported.

Contributions are welcome — see [Contributing](#contributing) for the workflow
and [Known issues](#known-issues) for current limitations.

---

## Features

- **Schematic review** — whole-project netlist (component → pin → net); floating
  pins, naming conflicts, unnamed nets
- **Component standardisation** — finds parts missing footprint / MPN / supplier /
  supplier part and fills them from the EDA library plus model knowledge
- **BOM analysis** — missing value or footprint, duplicate parts, purchasing advice
- **PCB / screenshot review** — board outline, placement, net statistics, plus a
  canvas screenshot handed to a vision model
- **Schematic generation** — real parts from the EDA system library first, symbols
  drawn on the fly only when nothing matches
- **Symbol generation** — body rectangle, individual pins and full attributes
  (including Manufacturer Part) in a single call
- **Agent loop** — the model reads netlists / BOM / screenshots and can edit
  values, attributes, wires and labels; tool calls collapse into one expandable
  progress card (live while running, summarised when done)
- **Multiple providers / models** — store several providers and models, fetch a
  provider's model list, switch models from the panel
- **Bilingual UI** — menus, toolbar, dialogs and body text follow the editor language

## Install

Download the latest `ext-easyeda-std-ai-assistant-v<version>.zip` from
[Releases](https://github.com/easyeda2021/ext-easyeda-std-ai-assistant/releases)
and unzip it.

1. EasyEDA Std → **Advanced → Extension → Extension configuration → Load extension**
2. Select **all** unzipped files at once (`manifest.json`, `locale.txt`,
   `icon.svg`, every `.js`)
3. Enter any English identifier as the extension ID (for example `aiassistant`)

The package also ships `README.md`, `README.zh-CN.md`, `安装说明.txt` and
`INSTALL.en.txt` for offline reference; these docs can be selected or skipped —
they do not affect loading.

> The ID becomes part of every command name and keys the local configuration, so
> **do not change it after installing**. To upgrade, remove the old extension and
> load the new files with the same ID. The ID is not baked into the build.

Build locally:

```bash
node tools/pack.js     # → dist/ext-easyeda-std-ai-assistant-v<version>.zip
```

## Quick start

- Open the panel from **Advanced ▸ AI Assistant ▸ AI Assistant…** (older clients also get a toolbar button)
- Open **Settings** first: choose the protocol, fill in endpoint / API key / model,
  then use *Test connection*
- Click a pill (schematic review / BOM analysis / standardise parts / generate
  schematic / read symbol …) to fill in the request, then **send** (`Ctrl + Enter`)
- Review tasks finish with a **report card**: preview it or download Markdown / HTML
- The **log** icon in the header opens a separate log window with *Copy all*
- The input accepts **pasted / dropped images**; the red square button stops a run

## Layout

```
extension/              the extension itself
  manifest.json         manifest (name / version / icons / scripts)
  locale.txt            host menu & dialog-title strings (read by the editor Locale)
  icon.svg              icon (SVG only)
  core.js               namespace / config / extension-id detection / logging
  prompts.js            every model-facing prompt (persona, task rules, nudges)
  i18n.js               full UI localisation (Chinese → English at render time)
  llm.js                OpenAI + Anthropic clients (chat / vision / tool calls)
  eda.js                document model: components, BOM, PCB, screenshots, locating
  eda-netlist.js        connectivity engine (wires / pins / net labels)
  actions.js            writes back to the document: values, attributes, wires, symbols
  tools.js              tools exposed to the model (JSON Schema + implementation)
  agent.js              agent loop + quick pills
  ui-base.js            UI primitives: tokens / inline styles / icons / Markdown
  ui.js                 panel: header, composer, messages, agent wiring
  ui-report.js          report card + preview + log window
  ui-settings.js        settings dialog
  ui-about.js           about dialog
  main.js               bootstrap: menu, toolbar button, commands
tools/pack.js           build: bump version, produce folder + zip
.github/workflows/      manual build & GitHub release
```

## Build & release

```bash
node tools/pack.js                  # patch version +1
node tools/pack.js --version 0.1.0  # explicit version
node tools/pack.js --no-zip         # unpacked folder only
```

Output lives in `dist/` (git-ignored):

- `dist/ext-easyeda-std-ai-assistant-v<version>/` — unpacked, for a local install
- `dist/ext-easyeda-std-ai-assistant-v<version>.zip` — release asset, files at the zip root

Every build writes the **user-facing** `README.md` / `README.zh-CN.md` (from
`README.user.md` / `README.user.zh-CN.md`, with the version filled in) plus
`安装说明.txt` / `INSTALL.en.txt` into the folder and the zip. The repo READMEs
keep the developer-facing build, layout and contribution notes.

Release: GitHub Actions → **Release → Run workflow** (version optional; empty
bumps the patch). The workflow publishes a release tagged `<version>` (no `v`
prefix) with the zip attached. Publishing a release on GitHub also builds and
attaches the zip; an existing empty release can be filled with the `tag` input.

- Single source of truth for the version: `extension/manifest.json`
- `dist/` and `tmp/` are not committed

## Troubleshooting

Panel → Settings → **Copy diagnostics** (extension id, API / dialog availability,
document type, model configuration, recent log). Common causes: wrong extension
ID (commands never fire), endpoint blocked by CORS, model without function calling.

## Docs

| Document | Contents |
|---|---|
| [README.zh-CN.md](README.zh-CN.md) | Chinese README (developer-facing) |
| [README.user.md](README.user.md) / [README.user.zh-CN.md](README.user.zh-CN.md) | user-facing READMEs packaged into the zip |
| [easyeda-std-extension-api.md](easyeda-std-extension-api.md) | extension development guide (Chinese): workflow + full API appendix + file-format field appendix |
| [PRD.md](PRD.md) | full requirements, tool specs, data model, API appendix |
| [CHANGELOG.md](CHANGELOG.md) | per-day changes and highlights |
| [AGENTS.md](AGENTS.md) | repository conventions for AI coding agents |

## Contributing

Issues and pull requests are welcome — bug reports, new review rules, extra
providers and translations all help.

- Keep each change focused; explain the problem, the approach and how you
  tested it (editor menu / panel / offline tests).
- Follow the repository conventions in [AGENTS.md](AGENTS.md): ES5-style JS
  (`var` / `function` only), prompts only in `extension/prompts.js`, inline
  styles via `st()`, and no file over 800 lines.
- Sync the docs when behaviour changes: `README.md` / `README.zh-CN.md`,
  `PRD.md` and `CHANGELOG.md`.
- Run `node --check` on the files you touched and `node tools/pack.js --no-zip`
  to confirm the build.
- For a bug report, attach the diagnostics from **Settings → Copy diagnostics**
  and the log-window output when possible.

Contributions are released under the Apache License 2.0.

## Known issues

- **Cross-sheet nets** are inferred from net labels; bus lines and overlapping
  wires without a junction can differ from the editor's own netlist.
- **System-library search** needs a logged-in EasyEDA session; when it fails,
  generation falls back to model-built symbols. The built-in templates cover
  only common parts (R/C/L/D/LED/switch/transistor/crystal/connector).
- **Context caps** — the whole-project netlist is trimmed (~24k characters,
  300 components, 200 BOM rows), so very large projects are reviewed partially.
- **No function calling, no Agent** — the provider must support tool calls, and
  OpenAI-compatible gateways must also allow browser CORS.
- **English UI** is a dictionary lookup: a new string without an `i18n.js` entry
  stays Chinese, and unknown editor locales are treated as English.
- **The extension ID is fixed after install** — command names and local settings
  are keyed by it; changing it loses settings and the menu stops working.
- **V6 toolbar button** — `createToolbarButton` no longer renders in V6; use
  **Advanced ▸ AI Assistant**. `insertShape` / `edit.unitConvert` are not
  registered either.
- **Deleting imported shapes** — `api('delete')` has no effect on shapes imported
  through jsonCache; the extension rewrites the document source instead and only
  covers shape types it understands.

## License

Released under the [Apache License 2.0](LICENSE).
