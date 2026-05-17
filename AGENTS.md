# Repository Guidelines

## Project Structure & Module Organization

ATM is a TypeScript VS Code extension. The activation entry point is `src/extension.ts`; feature modules live under `src/extensions/` such as `image-preview`, `markdown-mdx`, `git-better`, `atm-lint`, and `focus`. Editor setting integrations live in `src/settings/`. Tests are in `src/__test__/` using `*.test.ts`. Static docs, screenshots, videos, and localized README files are under `public/`; marketplace strings are in `package.nls*.json`. Build output is generated in `dist/` and is not source.

## Build, Test, and Development Commands

- `npm install`: install dependencies from `package-lock.json`.
- `npm run check-types`: run strict TypeScript checking with no emitted files.
- `npm run lint`: lint TypeScript files under `src/`.
- `npm run compile`: type-check, lint, and bundle extension/webview assets with `esbuild.js`.
- `npm run watch`: run TypeScript and esbuild watchers during extension development.
- `npm test`: compile tests, compile the extension, lint, then run the VS Code test runner.
- `npm run package`: production bundle used by `vscode:prepublish`.

Use VS Code's Extension Development Host (`F5`) after compiling or while `npm run watch` runs.

## Coding Style & Naming Conventions

Use TypeScript with `strict` mode and ES2022 APIs. Match existing formatting: tabs are common in TypeScript files, semicolons are expected, and import names should be `camelCase` or `PascalCase` per ESLint. Prefer feature-local `core/`, `ui/`, `providers/`, and `assets/` directories. Keep command IDs and settings keys namespaced, for example `atm.feature.action` or `tailwind-css.toggleEnabled`.

## Testing Guidelines

Tests use the VS Code test runner with Node `assert`. Add tests in `src/__test__/` as `feature-name.test.ts` for user-visible behavior, parsers, lint engines, and command logic that can be isolated. Run `npm test` before submitting changes; for faster feedback, run `npm run check-types` and `npm run lint` first.

## Commit & Pull Request Guidelines

Recent commits use concise messages, often with a leading icon and Conventional Commit-style prefix, for example `chore: exclude documentation and test files from the extension package` or `docs: update installation instructions`. Keep commits focused and describe the user-facing or maintenance impact.

Pull requests should include a short description, linked issue when applicable, test results, and screenshots or recordings for UI/webview changes. Note new commands, settings, localized strings, or assets so reviewers can verify `package.json` and `package.nls*.json` together.

## Security & Configuration Tips

Do not commit secrets, API keys, or local VS Code settings. Treat webview code as untrusted-input-facing: sanitize rendered content, avoid inline scripts where possible, and keep external network behavior explicit in feature modules.
