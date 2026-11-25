# AI Assistant · EasyEDA Std Extension

Version v{{VERSION}} · Project: <https://github.com/easyeda2021/ext-easyeda-std-ai-assistant>

Bring an LLM into the **EasyEDA Std** schematic and PCB editor: schematic review,
component standardisation, BOM analysis, PCB / canvas visual review, schematic
generation from a requirement, and symbol generation from an image.

> **EasyEDA Std (v6) only.** The Pro edition uses a different extension system
> and is not supported.

## Before you start

- EasyEDA Std (v6)
- An OpenAI-compatible or Anthropic-compatible model endpoint and API key
  (usage is billed by your model provider)
- For the Agent features, a model that supports tool / function calling

## What it can do

- **Schematic review** — whole-project netlist; floating pins, naming conflicts,
  unnamed nets
- **Component standardisation** — fill missing footprint / MPN / supplier /
  supplier part from the EDA library plus model knowledge
- **BOM analysis** — missing value or footprint, duplicate parts, purchasing advice
- **PCB / screenshot review** — board outline, placement, net statistics, plus a
  canvas screenshot handed to a vision model
- **Schematic generation** — real parts from the EDA system library first
- **Symbol generation** — body, pins and full attributes from an image or request
- **Agent** — read netlists / BOM / screenshots and edit values, attributes,
  wires and labels directly
- **Multiple providers and models** — keep several endpoints, switch models from
  the panel
- **Bilingual UI** — follows the editor language (Chinese / English)

## Install

1. EasyEDA Std → **Advanced → Extension → Extension configuration → Load extension**
2. Select **all** files in this folder at once (`manifest.json`, `locale.txt`,
   `icon.svg`, `app.js`)
3. Enter any English identifier as the extension ID (for example `aiassistant`)
   and remember it
4. Reload the editor; open the panel from **Advanced ▸ AI Assistant**

Good to know:

- `README.md`, `README.zh-CN.md`, `安装说明.txt` and `INSTALL.en.txt` are
  documentation only; they can be skipped when selecting files.
- The extension ID is part of every command name and keys the local settings:
  **do not change it after installing**.
- To upgrade, remove the old extension first, then load the new files with the
  same ID.

## First run

1. Open **Settings**: choose the protocol, fill in endpoint / API key / model,
   then use **Test connection**
2. Click a pill (schematic review / BOM analysis / standardise parts / generate
   schematic / read symbol), edit the request, then **send** with `Ctrl + Enter`
3. Review tasks finish with a **report card**: preview it or download
   Markdown / HTML
4. The **log** icon in the header opens a separate log window with **Copy all**
5. The input accepts **pasted / dropped images**; the red square button stops a run

## Your data

API keys stay on this machine (extension settings + local storage). Design data
is sent only to the model provider you configure, and only while you run a review
or generation task. Model usage costs are charged by that provider.

## Troubleshooting

Panel → **Settings → Copy diagnostics** (extension ID, API / dialog availability,
document type, model configuration, recent log). Common causes:

- wrong extension ID → menu commands never fire
- endpoint blocked by CORS → requests fail
- model without function calling → Agent tools are unavailable

## Known issues

- **Cross-sheet nets** are inferred from net labels; bus lines and overlapping
  wires without a junction can differ from the editor's own netlist.
- **System-library search** needs a logged-in EasyEDA session; when it fails,
  generation falls back to model-built symbols. Built-in templates cover only
  common parts (R/C/L/D/LED/switch/transistor/crystal/connector).
- **Large projects** are trimmed before review (~24k characters, 300 components,
  200 BOM rows), so only part of a very large project may be reviewed.
- **Agent needs a capable model** — the provider must support tool / function
  calling, and OpenAI-compatible gateways must allow browser CORS.
- **English UI** is a dictionary lookup: any string without an entry stays
  Chinese; unknown editor languages are treated as English.
- **The extension ID is fixed after install** — changing it loses local settings
  and the menu stops working.
- **V6 has no toolbar button** — open the panel from **Advanced ▸ AI Assistant**.
- **Some imported shapes cannot be deleted** by the Agent; remove leftovers
  manually in the editor.

## Feedback & license

Issues and suggestions:
<https://github.com/easyeda2021/ext-easyeda-std-ai-assistant/issues>

Released under the [Apache License 2.0](https://github.com/easyeda2021/ext-easyeda-std-ai-assistant/blob/main/LICENSE).
