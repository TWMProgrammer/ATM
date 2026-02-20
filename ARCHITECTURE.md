# 🏗️ ATM — Arquitectura

## Arquitectura Actual

```
src/
├── extension.ts                    ← Entry Point (activate / deactivate)
│
├── extensions/
│   ├── extensions.ts               ← Registry: orquesta todos los módulos
│   │
│   ├── image-preview/              ← 🖼️ Módulo: Vista previa de imágenes
│   │   ├── index.ts                ← Barrel (re-export público)
│   │   ├── core/
│   │   │   ├── types.ts            ← Interfaces: UrlMatch, Recognizer, UrlMapper
│   │   │   ├── config.ts           ← Lectura de configuración scoped
│   │   │   ├── recognizers.ts      ← Detectores de URLs/paths (5 tipos)
│   │   │   ├── mappers.ts          ← Resolvedores de paths (4 tipos)
│   │   │   └── utils.ts            ← Cache metadata (TTL 15s), cache resolución (TTL 30s)
│   │   └── ui/
│   │       └── decorator.ts        ← Decoraciones del editor + HoverProvider
│   │
│   └── voice-tts/                  ← 🔊 Módulo: Text-to-Speech
│       ├── index.ts                ← Barrel (re-export público)
│       ├── core/
│       │   ├── types.ts            ← Interfaces: VoiceTtsApi, CatalogVoiceEntry
│       │   ├── activation.ts       ← Activación, permisos, registro de comandos
│       │   ├── core.ts             ← Paths, voces, catálogo, playback (Piper TTS)
│       │   └── installer.ts        ← Descarga binarios, extracción, symlinks
│       └── ui/
│           ├── statusBar.ts        ← Barra de estado (voz + play/stop)
│           └── ui.ts               ← Voice Selector (QuickPick UI)
│
├── shared/
│   └── shared.ts                   ← 📦 Barrel para utilidades compartidas (vacío)
│
└── __test__/
    └── extension.test.ts           ← Tests básicos
```

---

## Arquitectura Propuesta

```
src/
├── extension.ts                    ← Entry Point (activate / deactivate)
│
├── extensions/
│   ├── extensions.ts               ← Registry: activate + deactivate centralizados
│   │
│   ├── image-preview/              ← 🖼️ Vista previa de imágenes (sin cambios)
│   │   ├── index.ts
│   │   ├── core/
│   │   │   ├── types.ts
│   │   │   ├── config.ts
│   │   │   ├── recognizers.ts
│   │   │   ├── mappers.ts
│   │   │   └── utils.ts
│   │   └── ui/
│   │       └── decorator.ts
│   │
│   ├── voice-tts/                  ← 🔊 Text-to-Speech (core.ts dividido)
│   │   ├── index.ts
│   │   ├── core/
│   │   │   ├── types.ts
│   │   │   ├── activation.ts
│   │   │   ├── paths.ts            ← 🆕 getResourcesBasePath, getPiperPath, etc.
│   │   │   ├── voices.ts           ← 🆕 getAvailableVoices, loadCatalog, etc.
│   │   │   ├── playback.ts         ← 🆕 readText, stopPlayback, isPlaying
│   │   │   └── installer.ts
│   │   └── ui/
│   │       ├── statusBar.ts
│   │       └── ui.ts
│   │
│   ├── configs/                    ← ⚙️ 🆕 Configuraciones nativas de VS Code
│   │   ├── index.ts                ← Barrel
│   │   └── core/
│   │       ├── types.ts            ← ConfigPreset, ConfigCategory
│   │       └── defaults.ts         ← Mapa de configuraciones por categoría
│   │
│   ├── error-lens/                 ← 🔴 📋 Futuro: Errores inline en el editor
│   │   ├── index.ts
│   │   ├── core/
│   │   │   ├── types.ts
│   │   │   └── diagnostics.ts
│   │   └── ui/
│   │       └── decorator.ts
│   │
│   ├── color-preview/              ← 🎨 📋 Futuro: Preview de colores en código
│   │   ├── index.ts
│   │   ├── core/
│   │   │   ├── types.ts
│   │   │   └── parser.ts
│   │   └── ui/
│   │       └── decorator.ts
│   │
│   └── .../                        ← La arquitectura soporta N módulos
│
├── shared/
│   └── shared.ts                   ← 📦 fileExists(), getSelectedText(), helpers
│
└── __test__/
    └── extension.test.ts
```
