# AI Assistant · EasyEDA Std Extension

[中文](README.md) · Repository: <https://github.com/easyeda2021/ext-easyeda-std-ai-assistant>

Bring an LLM into the **EasyEDA Std** schematic and PCB editor: schematic review,
BOM analysis and component standardisation, PCB / canvas visual review, schematic
generation from a requirement, and symbol generation from an image.

> **EasyEDA Std only** (v6). The Pro edition's `.eext` and
> `eda.dmt_*` APIs are a different system and are not supported.

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

Release: GitHub Actions → **Release → Run workflow** (version optional; empty
bumps the patch). The workflow publishes a release tagged `v<version>` with the
zip attached.

- Single source of truth for the version: `extension/manifest.json`
- `dist/` and `tmp/` are not committed

## Troubleshooting

Panel → Settings → **Copy diagnostics** (extension id, API / dialog availability,
document type, model configuration, recent log). Common causes: wrong extension
ID (commands never fire), endpoint blocked by CORS, model without function calling.

## Docs

| Document | Contents |
|---|---|
| [README.md](README.md) | Chinese README |
| [easyeda-std-extension-api.md](easyeda-std-extension-api.md) | extension development guide (Chinese): API, document model, UI, networking, config, pitfalls |
| [PRD.md](PRD.md) | full requirements, tool specs, data model, API appendix |
| [CHANGELOG.md](CHANGELOG.md) | per-day changes and highlights |
| [AGENTS.md](AGENTS.md) | repository conventions for AI coding agents |

## Known limitations

- Cross-sheet connectivity relies on net labels; unusual bus / overlapping shapes
  may differ slightly from the editor
- The system-library search needs a logged-in session; failures fall back to
  model-generated symbols
- English UI is a dictionary lookup — a new string without an entry stays Chinese
