# Repository Guidelines

## Project Structure & Module Organization

ATM is a TypeScript VS Code extension. The activation entry point is `src/extension.ts`; feature modules live under `src/extensions/` such as `11-image-preview`, `13-markdown-mdx`, `10-git-better`, `02-atm-lint`, `09-focus`, `21-atm-translate`, and `22-bracket-lynx`. Editor setting integrations live in `src/settings/`. Tests are in `src/__test__/` using `*.test.ts`. Static docs, screenshots, videos, and localized README files are under `public/`; marketplace strings are in `package.nls*.json`. Build output is generated in `dist/` and is not source.

### ATM Translate Architecture

`src/extensions/21-atm-translate/` is organized by responsibility:

- `index.ts`: thin public entry point that exports activation.
- `host/`: VS Code extension-host code such as activation, commands, webview panel lifecycle, message handling, SecretStorage, clipboard/image attachment persistence, and future workspace reference resolution.
- `shared/`: cross-boundary contracts and helpers used by both host and webview, including protocol message types, language metadata, text limits, and image marker utilities.
- `core/`: domain logic for translation, spellcheck, provider config, cache, and shared core types. Keep provider/network logic out of `host/` and UI rendering logic out of `core/`.
- `core/spellcheck/`: local spellcheck engine and dictionaries. Future Spanish spelling improvements should live here first.
- `core/providers/`: reserved for splitting translation providers from `translationService.ts` as the next safe refactor.
- `ui/`: keep only `atm-translate.html`, `atm-translate.css`, and `atm-translate.ts` at the root. Put future UI internals in `ui/utils/` such as `dom.ts`, `state.ts`, `renderer.ts`, `actions.ts`, `keyboard.ts`, `attachments.ts`, or `referencePicker.ts`.

For new ATM Translate functionality, use the existing boundaries: VS Code APIs in `host/`, message shapes in `shared/protocol.ts`, reusable marker/reference models in `shared/`, translation/spellcheck behavior in `core/`, and DOM behavior in `ui/`. Planned future features such as AI-friendly prompt formatting, `@file`/`@folder` references, link references, and richer image/file attachments should be added as focused services rather than folded back into `index.ts` or a large webview script.

## Build, Test, and Development Commands

- `bun install`: install dependencies from `bun.lock`.
- `bun run check-types`: run strict TypeScript checking with no emitted files.
- `bun run lint`: lint TypeScript files under `src/`.
- `bun run compile`: type-check, lint, and bundle extension/webview assets with `esbuild.js`.
- `bun run watch`: run TypeScript and esbuild watchers during extension development.
- `bun run test`: compile tests, compile the extension, lint, then run the VS Code test runner.
- `bun run package`: production bundle used by `vscode:prepublish`.

Use VS Code's Extension Development Host (`F5`) after compiling or while `bun run watch` runs.

## Coding Style & Naming Conventions

Use TypeScript with `strict` mode and ES2022 APIs. Match existing formatting: tabs are common in TypeScript files, semicolons are expected, and import names should be `camelCase` or `PascalCase` per ESLint. Prefer feature-local `core/`, `ui/`, `providers/`, and `assets/` directories. Keep command IDs and settings keys namespaced, for example `atm.feature.action` or `tailwind-css.toggleEnabled`.

## Testing Guidelines

Tests use the VS Code test runner with Node `assert`. Add tests in `src/__test__/` as `feature-name.test.ts` for user-visible behavior, parsers, lint engines, and command logic that can be isolated. Run `bun run test` before submitting changes; for faster feedback, run `bun run check-types` and `bun run lint` first.

## Commit & Pull Request Guidelines

Recent commits use concise messages, often with a leading icon and Conventional Commit-style prefix, for example `chore: exclude documentation and test files from the extension package` or `docs: update installation instructions`. Keep commits focused and describe the user-facing or maintenance impact.

Pull requests should include a short description, linked issue when applicable, test results, and screenshots or recordings for UI/webview changes. Note new commands, settings, localized strings, or assets so reviewers can verify `package.json` and `package.nls*.json` together.

## Security & Configuration Tips

Do not commit secrets, API keys, or local VS Code settings. Treat webview code as untrusted-input-facing: sanitize rendered content, avoid inline scripts where possible, and keep external network behavior explicit in feature modules.
