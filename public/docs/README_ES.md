# 🏗️ ATM — Architecture Guide

> **ATM** (All-in-one Toolkit Modules) es una extensión de VS Code que agrupa múltiples funcionalidades del editor en un solo paquete ultraligero (~30KB). Cada módulo replica y mejora extensiones populares existentes, pero diseñadas para funcionar en **todos los lenguajes** que soporta el editor.

---

## 📐 Diagrama de Arquitectura

![ATM Architecture Diagram](./docs/architecture-diagram.png)

---

## 📊 Estado Actual del Proyecto

| Métrica                  | Valor                            |
| ------------------------ | -------------------------------- |
| **Peso del bundle**      | ~30 KB                           |
| **Módulos activos**      | 2 (`image-preview`, `voice-tts`) |
| **Dependencias runtime** | 1 (`image-size`)                 |
| **Activación**           | `onStartupFinished` (lazy)       |
| **Build tool**           | esbuild (bundle + minify)        |

---

## 🧬 Estructura Actual

```
src/
├── extension.ts              ← Entry Point (activate / deactivate)
├── extensions/
│   ├── extensions.ts         ← Registry: orquesta todos los módulos
│   ├── image-preview/        ← 🖼️ Módulo: Vista previa de imágenes
│   │   ├── index.ts          ← Barrel (re-export público)
│   │   ├── core/
│   │   │   ├── types.ts      ← Interfaces: UrlMatch, Recognizer, UrlMapper, ImageInfo
│   │   │   ├── config.ts     ← Lectura de configuración scoped
│   │   │   ├── recognizers.ts← Detectores de URLs/paths de imágenes (5 tipos)
│   │   │   ├── mappers.ts    ← Resolvedores de paths (data:, http, relativos, workspace)
│   │   │   └── utils.ts      ← Cache de metadata, cache de resolución, helpers
│   │   └── ui/
│   │       └── decorator.ts  ← Decoraciones del editor + HoverProvider
│   │
│   └── voice-tts/            ← 🔊 Módulo: Text-to-Speech
│       ├── index.ts          ← Barrel (re-export público)
│       ├── core/
│       │   ├── types.ts      ← Interfaces: VoiceTtsApi, CatalogVoiceEntry, etc.
│       │   ├── activation.ts ← Activación, permisos, registro de comandos
│       │   ├── core.ts       ← Paths, voces, catálogo, playback (Piper TTS)
│       │   └── installer.ts  ← Descarga binarios, extracción, symlinks
│       └── ui/
│           ├── statusBar.ts  ← Barra de estado (voz + play/stop)
│           └── ui.ts         ← Voice Selector (QuickPick UI)
│
├── shared/
│   └── shared.ts             ← 📦 Barrel para utilidades compartidas (futuro)
│
└── __test__/
    └── extension.test.ts     ← Tests básicos
```

---

## 🔄 Flujo de Datos

### Entry Point → Registry

```
extension.ts
  └─→ activateExtensions(context)      // extensions.ts
       ├─→ activateImagePreview(context) // síncrono
       └─→ activateVoiceTts(context)     // asíncrono (con catch)

extension.ts
  └─→ deactivateVoiceTts()             // limpieza al desactivar
```

### Image Preview — Pipeline

```
Documento abierto/modificado
  └─→ scanDocument()
       ├─→ recognizers[].recognize()   → UrlMatch[]
       ├─→ mappers[].map()            → string (resolved path)
       └─→ Decorations + HoverProvider → UI en el editor
```

### Voice TTS — Pipeline

```
Activación
  └─→ setExecutePermissions() + fixSymlinks()
  └─→ createStatusBarItems()
  └─→ Registro de comandos (togglePlayback, copyAndRead, selectVoice)

Playback
  └─→ ensureVoiceForPlayback()
  └─→ readText() → spawn(piper) | pipe → spawn(player)
```

---

## ✅ Lo Que Está Bien (Fortalezas)

| Aspecto                | Detalle                                                      |
| ---------------------- | ------------------------------------------------------------ |
| **Modularidad**        | Cada módulo es independiente con su propio `index.ts` barrel |
| **Separación core/ui** | Lógica de negocio separada de la capa visual                 |
| **Registry pattern**   | `extensions.ts` centraliza la activación                     |
| **Bundle size**        | ~30KB es excelente para la funcionalidad que ofrece          |
| **Lazy activation**    | `onStartupFinished` no bloquea el arranque del editor        |
| **Caching**            | Image-preview tiene cache con TTL para metadata y resolución |
| **Type safety**        | Interfaces bien definidas en `types.ts` por módulo           |
| **Patrón Strategy**    | Recognizers y Mappers como arrays permiten extensibilidad    |

---

## 🔴 Problemas Actuales y Mejoras

### 1. 🔴 `deactivate()` solo limpia voice-tts

**Problema:** `extension.ts` llama `deactivateVoiceTts()` directamente, pero si agregas más módulos que necesiten limpieza, tendrás que importar cada uno manualmente.

**Solución:** Crear un patrón de `deactivate` en el Registry.

```typescript
// extensions/extensions.ts — PROPUESTA
const cleanupFns: (() => void)[] = [];

export function activateExtensions(context: vscode.ExtensionContext): void {
  activateImagePreview(context);

  activateVoiceTts(context)
    .then(() => cleanupFns.push(deactivateVoiceTts))
    .catch((error) => console.error('[voice-tts] Activation error:', error));
}

export function deactivateExtensions(): void {
  cleanupFns.forEach((fn) => fn());
  cleanupFns.length = 0;
}
```

```typescript
// extension.ts
import {
  activateExtensions,
  deactivateExtensions,
} from './extensions/extensions';

export function activate(context: vscode.ExtensionContext): void {
  activateExtensions(context);
}

export function deactivate(): void {
  deactivateExtensions();
}
```

### 2. 🟡 `core.ts` en voice-tts es demasiado grande (505 líneas)

**Problema:** `core.ts` maneja paths, voces, catálogo y playback — 4 responsabilidades distintas.

**Solución:** Dividir en módulos más pequeños (sin crear archivos innecesarios):

```
voice-tts/core/
├── types.ts        ← (ya existe)
├── activation.ts   ← (ya existe)
├── paths.ts        ← NUEVO: getResourcesBasePath, getPiperPath, getVoicePath, etc.
├── voices.ts       ← NUEVO: getAvailableVoices, loadVoicesCatalog, lookupVoice, etc.
├── playback.ts     ← NUEVO: readText, stopCurrentPlayback, isPlaying
└── installer.ts    ← (ya existe)
```

> **Importante:** Esto NO aumenta el peso del bundle (esbuild los combina igual).

### 3. 🟡 `fileExists()` está duplicada

**Problema:** La misma función `fileExists()` existe en `core.ts` y `installer.ts`.

**Solución:** Moverla a `shared/shared.ts`:

```typescript
// shared/shared.ts
import * as fs from 'fs';

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
```

### 4. 🟡 Código duplicado en activation.ts

**Problema:** Los comandos `togglePlayback` y `copyAndRead` contienen ~50 líneas idénticas para la lógica de "obtener texto seleccionado → leer".

**Solución:** Extraer a una función shared:

```typescript
async function getSelectedText(): Promise<string | null> {
  const previousClipboard = await vscode.env.clipboard.readText();
  try {
    await vscode.commands.executeCommand('editor.action.clipboardCopyAction');
  } catch {
    /* ok */
  }

  const newClipboard = (await vscode.env.clipboard.readText()).trim();
  if (newClipboard && newClipboard !== previousClipboard.trim()) {
    return newClipboard;
  }

  const editor = vscode.window.activeTextEditor;
  if (editor && !editor.selection.isEmpty) {
    return editor.document.getText(editor.selection);
  }

  return null;
}
```

---

## 🚀 Arquitectura Futura Propuesta

### Nuevo módulo: `configs/` — Configuraciones nativas de VS Code

Este es el módulo que mencionas para **activar configuraciones nativas automáticamente** al instalar la extensión. La implementación más limpia es usando `configurationDefaults` en `package.json` + un módulo para configuraciones programáticas:

```
src/
├── extension.ts
├── extensions/
│   ├── extensions.ts         ← Agrega activateConfigs()
│   ├── image-preview/        ← 🖼️ (existente)
│   ├── voice-tts/            ← 🔊 (existente)
│   └── configs/              ← ⚙️ NUEVO: Configuraciones nativas
│       ├── index.ts           ← Barrel
│       ├── core/
│       │   ├── types.ts       ← ConfigPreset, ConfigCategory
│       │   └── defaults.ts    ← Mapa de configuraciones por categoría
│       └── ui/
│           └── welcome.ts     ← Panel de bienvenida (opcional)
├── shared/
│   └── shared.ts             ← fileExists + utils compartidas
└── __test__/
```

### Implementación de `configs/`:

**Opción A — Declarativa (RECOMENDADA, peso: 0 bytes de código)**

En `package.json` usando `configurationDefaults`:

```jsonc
// package.json → contributes
"configurationDefaults": {
  // ─── Editor Mejorado ────────────────────────
  "editor.bracketPairColorization.enabled": true,
  "editor.guides.bracketPairs": "active",
  "editor.stickyScroll.enabled": true,
  "editor.cursorBlinking": "expand",
  "editor.cursorSmoothCaretAnimation": "on",
  "editor.smoothScrolling": true,
  "editor.fontLigatures": true,
  "editor.linkedEditing": true,
  "editor.renderWhitespace": "selection",
  "editor.minimap.enabled": false,

  // ─── Terminal Mejorado ──────────────────────
  "terminal.integrated.smoothScrolling": true,
  "terminal.integrated.cursorBlinking": true,

  // ─── Workbench ──────────────────────────────
  "workbench.list.smoothScrolling": true,
  "workbench.tree.indent": 16,
  "workbench.editor.enablePreview": false
}
```

> **Ventaja:** No agrega NADA de peso al bundle. VS Code las aplica como defaults automáticamente. El usuario puede sobreescribir cualquier configuración manualmente.

**Opción B — Programática (para configs que requieren lógica)**

```typescript
// extensions/configs/core/defaults.ts
import * as vscode from 'vscode';

interface ConfigPreset {
  key: string;
  value: unknown;
  target: vscode.ConfigurationTarget;
  condition?: () => boolean; // solo aplicar si se cumple
}

const EDITOR_PRESETS: ConfigPreset[] = [
  {
    key: 'editor.bracketPairColorization.enabled',
    value: true,
    target: vscode.ConfigurationTarget.Global,
  },
  // ... más presets
];

export async function applyDefaults(): Promise<void> {
  const config = vscode.workspace.getConfiguration();

  for (const preset of EDITOR_PRESETS) {
    if (preset.condition && !preset.condition()) continue;

    const current = config.inspect(preset.key);
    // Solo aplicar si el usuario NO ha configurado manualmente
    if (current?.globalValue === undefined) {
      await config.update(preset.key, preset.value, preset.target);
    }
  }
}
```

### Recomendación: **Usa Opción A** (declarativa)

Es la forma oficial recomendada por VS Code. Peso: **0 bytes** adicionales de JavaScript. Se aplica automáticamente. El usuario puede sobreescribir.

---

## 📏 Reglas para Agregar Nuevos Módulos

Para mantener la arquitectura consistente al escalar, cada nuevo módulo debe seguir estas reglas:

### Checklist para nuevo módulo:

```
1. 📁 Crear en src/extensions/<nombre-módulo>/
2. 📂 Crear subcarpetas core/ y ui/ (si aplica)
3. 📄 Crear index.ts como barrel (solo re-exports públicos)
4. 📋 Crear core/types.ts para interfaces del módulo
5. 🔌 Registrar en extensions/extensions.ts
6. 🧹 Si necesita cleanup → registrar deactivate en el Registry
7. ⚙️ Si tiene configuración → agregar en package.json > contributes > configuration
8. 📖 Documentar en ARCHITECTURE.md
```

### Patrón estándar de un módulo:

```typescript
// extensions/<nuevo-módulo>/index.ts
export { activate<NuevoModulo> } from './core/activation';
export { deactivate<NuevoModulo> } from './core/activation'; // si aplica
export type { <NuevoModulo>Api } from './core/types';       // si aplica
```

```typescript
// extensions/<nuevo-módulo>/core/activation.ts
import type * as vscode from 'vscode';

export function activate<NuevoModulo>(context: vscode.ExtensionContext): void {
  // Registrar providers, decorations, commands, etc.
}
```

---

## 🎯 Prioridades de Mejora

| #   | Mejora                                       | Impacto  | Esfuerzo | Peso añadido |
| --- | -------------------------------------------- | -------- | -------- | ------------ |
| 1   | `configurationDefaults` en package.json      | 🟢 Alto  | 🟢 Bajo  | **0 bytes**  |
| 2   | Registry con `deactivateExtensions()`        | 🟢 Alto  | 🟢 Bajo  | ~10 bytes    |
| 3   | Extraer `fileExists` a shared                | 🟡 Medio | 🟢 Bajo  | -~20 bytes   |
| 4   | Extraer `getSelectedText()` en activation.ts | 🟡 Medio | 🟢 Bajo  | -~50 bytes   |
| 5   | Dividir `core.ts` de voice-tts               | 🟡 Medio | 🟡 Medio | 0 bytes      |

---

## 🔮 Roadmap de Módulos Futuros

![ATM Future Architecture](./docs/architecture-future.png)

```
src/extensions/
├── image-preview/    ✅ Activo
├── voice-tts/        ✅ Activo
├── configs/          ⏳ Próximo — Configuraciones nativas
├── error-lens/       📋 Futuro — Errores inline en el editor
├── color-preview/    📋 Futuro — Preview de colores en código
├── font-preview/     📋 Futuro — Preview de fuentes
├── bracket-lens/     📋 Futuro — Mejoras de brackets
└── ...               📋 La arquitectura soporta N módulos
```

---

## 📦 Dependencias

| Paquete      | Tipo    | Usado por     | Propósito                                               |
| ------------ | ------- | ------------- | ------------------------------------------------------- |
| `image-size` | runtime | image-preview | Detectar dimensiones de imagen sin leer todo el archivo |
| `esbuild`    | dev     | build         | Bundling + minificación                                 |
| `typescript` | dev     | build         | Type checking                                           |
| `eslint`     | dev     | lint          | Calidad de código                                       |

> **Regla:** Cada nueva dependencia runtime debe justificarse por su peso vs. beneficio. Si puedes resolver algo con las APIs de VS Code o Node.js nativas, hazlo.

---

## ⚡ Principios de Rendimiento

1. **Activación lazy:** `onStartupFinished` — nunca bloquear el arranque
2. **Cache con TTL:** Metadata de imágenes (15s), Resolución de paths (30s)
3. **Throttle/Debounce:** Scans de documentos (500ms), Updates de status bar (50ms)
4. **Lectura parcial:** Solo leer headers de imagen (4096 bytes), no el archivo completo
5. **Sin dependencias innecesarias:** Solo 1 dep runtime (`image-size`)
6. **esbuild bundle:** Tree-shaking + minificación = peso mínimo

---

_Última actualización: 2026-02-19_
_Versión: 0.0.1_
