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