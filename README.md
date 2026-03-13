<p align="center">
  <img src="https://raw.githubusercontent.com/bastndev/ATM/refs/heads/main/assets/images/banner.jpg" width="100%" alt="ATM Banner">
</p>

<h1 align="center">ATM — Advanced Tool Module</h1>

<p align="center">
  <em>A professional, modular extension suite that supercharges your VS Code workflow — zero‑config, ultra‑lightweight.</em>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=bastndev.atm"><img src="https://img.shields.io/badge/Marketplace-ATM-007ACC?style=for-the-badge&logo=visual-studio-code" alt="VS Code Marketplace"></a>
  <img src="https://img.shields.io/badge/Status-Preview-teal?style=for-the-badge" alt="Status">
  <img src="https://img.shields.io/badge/Bundle-~30KB-black?style=for-the-badge" alt="Bundle Size">
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="License">
</p>

<p align="center">
  <sub>Compatible with <b>VS Code</b> · <b>Cursor</b> · <b>Windsurf</b> · <b>Trae.ai</b> · <b>Kiro</b> · <b>Firebase Studio</b></sub>
</p>

<p align="center">
  <a href="docs/README_ES.md">📖 Documentación en Español</a>
</p>

---

## ⚡ Why ATM?

Most developers install **10+ extensions** that overlap, conflict, and slow down their editor.  
**ATM** replaces them all with a single, modular, ultra‑light package (~30 KB bundled).

- 🚀 **Zero‑config** — works out of the box with sensible defaults
- 🧩 **Modular architecture** — each feature is an independent module
- 🪶 **Minimal footprint** — lazy activation via `onStartupFinished`
- 🌐 **Universal** — works across every language VS Code supports

---

## 💠 Core Modules

> **14 built‑in modules** — each one replaces a standalone extension.

### 🖼️ Image Preview

Professional gutter thumbnails and hover previews for images & SVGs.  
Supports data URIs, HTTP URLs, relative paths, and workspace resolution.

|                |        |
| -------------- | ------ |
| **Attribute**  | Visual |
| **Efficiency** | S‑Tier |

### 🔊 Voice TTS

Built‑in text‑to‑speech engine powered by [Piper TTS](https://github.com/rhasspy/piper).  
Copy & read code aloud with high‑fidelity voice models.

|                |                                                                 |
| -------------- | --------------------------------------------------------------- |
| **Attribute**  | Utility                                                         |
| **Efficiency** | Fast                                                            |
| **Shortcut**   | <kbd>Shift</kbd>+<kbd>Space</kbd> — Copy & Read                 |
|                | <kbd>Shift</kbd>+<kbd>Alt</kbd>+<kbd>Space</kbd> — Select Voice |

### 🔍 Code Spell

Advanced spell‑checking engine for modern codebases.  
Auto‑detects identifiers, strings, and comments — supports custom dictionaries.

|                |         |
| -------------- | ------- |
| **Attribute**  | Quality |
| **Efficiency** | Native  |

### ⛔ Error Lens

Ultra‑low‑latency inline diagnostics.  
Errors and warnings are projected directly onto the affected line.

|                |       |
| -------------- | ----- |
| **Attribute**  | Guard |
| **Efficiency** | Elite |

### 🎨 Color Box

Fluid color decoration system for CSS, Hex, RGB, and HSL values.  
Renders inline color swatches right in your code.

|                |        |
| -------------- | ------ |
| **Attribute**  | Design |
| **Efficiency** | Fluid  |

### ✅ Annotations (TODO / FIXME)

Smart indexer for `TODO`, `FIXME`, `HACK`, and `NOTE` annotations.  
Scan the workspace instantly with a single command.

|                |                                      |
| -------------- | ------------------------------------ |
| **Attribute**  | Flow                                 |
| **Efficiency** | Core                                 |
| **Command**    | `ATM: List TODO / FIXME Annotations` |

### 📝 MDX Supreme

First‑class MDX support with syntax highlighting, translations, and live preview.  
Includes full TextMate grammar and embedded language support for 30+ languages.

|                |                                                                 |
| -------------- | --------------------------------------------------------------- |
| **Attribute**  | Logic                                                           |
| **Efficiency** | Smart                                                           |
| **Shortcut**   | <kbd>Shift</kbd>+<kbd>Alt</kbd>+<kbd>M</kbd> — Open MDX Preview |

### 🔗 Git Better

Professional line‑blame metadata and deep GitHub integration.  
Copy commit hashes, open commits on GitHub, and toggle inline blame.

|                |        |
| -------------- | ------ |
| **Attribute**  | Social |
| **Efficiency** | Cloud  |

### 📸 Screenshot

Capture selected code fragments as high‑definition images.  
Perfect for presentations, documentation, and social sharing.

|                |                                               |
| -------------- | --------------------------------------------- |
| **Attribute**  | Export                                        |
| **Efficiency** | Web                                           |
| **Trigger**    | Right‑click selection → `ATM (📸) screenshot` |

### 📦 Versioning

Dynamic dependency inspector for `package.json`.  
Multi‑provider version checking with inline decorations and one‑click update.

|                |                                                            |
| -------------- | ---------------------------------------------------------- |
| **Attribute**  | System                                                     |
| **Efficiency** | Auto                                                       |
| **Command**    | `ATM: Check Package Versions` / `ATM: Update All Packages` |

### ⚡ SVG Better

High‑performance SVG optimization pipeline powered by [SVGO](https://github.com/svg/svgo).  
Optimize any `.svg` file directly from the editor title bar.

|                |        |
| -------------- | ------ |
| **Attribute**  | Asset  |
| **Efficiency** | Native |

### 📋 Copy Tag

Instant visual feedback with micro‑animations when copying text.  
Customizable highlight colors, foreground, and duration.

|                |                                                                 |
| -------------- | --------------------------------------------------------------- |
| **Attribute**  | UX                                                              |
| **Efficiency** | Instant                                                         |
| **Shortcut**   | <kbd>Ctrl</kbd>+<kbd>C</kbd> (<kbd>⌘</kbd>+<kbd>C</kbd> on Mac) |

### 📄 Markdown Text

Enhanced Markdown preview with custom task‑list checkboxes, Mermaid diagram rendering, and useful snippets.

|                |        |
| -------------- | ------ |
| **Attribute**  | Docs   |
| **Efficiency** | Native |

### 🐛 Color Debugging

Visual color‑coding for debugging sessions.  
Enhances readability of debug output and variables.

|                |        |
| -------------- | ------ |
| **Attribute**  | Debug  |
| **Efficiency** | Visual |

---

## ⌨️ Keyboard Shortcuts

| Shortcut                                          | Action                          |
| ------------------------------------------------- | ------------------------------- |
| <kbd>Shift</kbd>+<kbd>Space</kbd>                 | Voice TTS: Copy & Read          |
| <kbd>Shift</kbd>+<kbd>Alt</kbd>+<kbd>Space</kbd>  | Voice TTS: Select Voice         |
| <kbd>Shift</kbd>+<kbd>Alt</kbd>+<kbd>M</kbd>      | Open MDX Preview                |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Space</kbd> | Translate Extension Page        |
| <kbd>Ctrl</kbd>+<kbd>C</kbd>                      | Copy Tag: Highlight Copied Text |

---

## ⚙️ Configuration

ATM is designed to be **zero‑config** from the start. However, every module can be fine‑tuned in your `settings.json`:

### Image Preview

```jsonc
{
  "atm.image.preview.showImagePreviewOnGutter": true, // Show gutter thumbnails
  "atm.image.preview.showUnderline": true, // Underline image URLs
  "atm.image.preview.imagePreviewMaxHeight": 100, // Max hover preview height (px)
  "atm.image.preview.imagePreviewMaxWidth": -1, // Max hover preview width (px, -1 = auto)
  "atm.image.preview.sourceFolder": "src", // Additional source folder
  "atm.image.preview.sourceFolders": ["static", "public"], // Additional source folders
  "atm.image.preview.currentColorForSVG": "white", // Default currentColor for SVGs
}
```

### Voice TTS

```jsonc
{
  "atm.voiceTts.voice": "en_US-hfc_female-medium", // Voice model (use Select Voice to change)
}
```

### Code Spell

```jsonc
{
  "atm.codeSpell.customWords": [], // Custom words added to the dictionary
}
```

### Copy Tag

```jsonc
{
  "atm.copyTag.enabled": true, // Enable copy highlight
  "atm.copyTag.backgroundColor": "rgba(45, 212, 191, 0.3)", // Highlight color
  "atm.copyTag.foregroundColor": "", // Optional text color
  "atm.copyTag.timeout": 250, // Highlight duration (ms, 50–2000)
}
```

### Other Settings

```jsonc
{
  "atm.colorBgTag.enabled": true, // Enable HTML tag background coloring
}
```

---

## 🔱 Design Philosophy (Dota‑Style Attributes)

Inspired by high‑performance game systems, ATM segments its capabilities into three primary vectors:

| Vector           | Icon | Modules                               | Purpose                                 |
| ---------------- | ---- | ------------------------------------- | --------------------------------------- |
| **Agility**      | ⚡   | SVG Better, Copy Tag, Error Lens      | Near‑zero latency operations            |
| **Strength**     | 🛡️   | Code Spell, Annotations, Versioning   | Defensive layer against bugs & debt     |
| **Intelligence** | 🔮   | Voice TTS, Image Preview, MDX Supreme | Expands the developer's cognitive reach |

---

## 📐 Architecture

ATM follows a strict modular architecture where each extension is an independent module with its own `core/` (business logic) and `ui/` (presentation) layers.

```
src/
├── extension.ts            ← Entry point
├── extensions/
│   ├── extensions.ts       ← Central registry
│   ├── image-preview/      ← 🖼️  Gutter previews
│   ├── voice-tts/          ← 🔊  Text-to-speech
│   ├── code-spell/         ← 🔍  Spell checker
│   ├── error-lens/         ← ⛔  Inline diagnostics
│   ├── color-box/          ← 🎨  Color decorations
│   ├── comments-code/      ← ✅  TODO/FIXME indexer
│   ├── markdown-mdx/       ← 📝  MDX support
│   ├── markdown-text/      ← 📄  Markdown preview
│   ├── translate-doc/      ← 🌐  Translation engine
│   ├── git-better/         ← 🔗  Git blame + GitHub
│   ├── screenshot-code/    ← 📸  Code screenshots
│   ├── version-package/    ← 📦  Dependency checker
│   ├── svg-better/         ← ⚡  SVG optimizer
│   └── color-debugging/    ← 🐛  Debug colors
└── settings/
    ├── code/               ← Editor enhancements
    │   ├── copy-tag/       ←   Copy highlight
    │   ├── color-bg-tag/   ←   HTML tag colors
    │   ├── line-bg-tag/    ←   Line backgrounds
    │   └── auto-tag-x2/    ←   Auto‑close/rename tags
    └── native/             ← Native VS Code config overrides
```

> For the full architecture breakdown, see **[ARCHITECTURE.md](ARCHITECTURE.md)**.

---

## 🚀 Getting Started

1. **Install** — Search for `ATM` in the VS Code Extensions panel, or install from the [Marketplace](https://marketplace.visualstudio.com/items?itemName=bastndev.atm).
2. **Reload** — That's it. All modules activate automatically.
3. **Customize** _(optional)_ — Fine‑tune any module via `Settings > Extensions > ATM`.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repository
2. Create your feature branch — `git checkout -b feature/amazing-module`
3. Follow the [module architecture](#-architecture) pattern
4. Submit a pull request

> See the [Architecture Guide](docs/README_ES.md) for detailed module conventions.

---

## 📄 License

Distributed under the **MIT License**. See [LICENCE](LICENCE) for details.

---

<p align="center">
  <sub>Built with precision by</sub><br>
  <b><a href="https://github.com/bastndev">Gohit X & (bastndev)</a></b>
</p>
