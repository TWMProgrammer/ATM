# ATM Changelog

ATM is a modular VS Code extension suite with many tools and configurations ready to use.

It includes productivity, diagnostics, documentation, and editor utilities in one package.

Compatible with VS Code, Cursor, Windsurf, Trae.ai, Kiro, and Firebase Studio.

Discover more extensions [here](https://gohit.xyz/)

## Changelog

Following VS Code best practices, ATM uses semantic versioning for all releases.

<br>
<!-- --- -->

---

## [1.9.3] - 2026-04-17

### Added
- **FAAH Module**: Added audio alerts for terminal error notifications ("T-Sound"). Includes custom sound files (`faah.wav`), process interruption support, and mute/unmute functionality.
- **Music Controls**: Added keybindings and commands for "Random AM station" playback.
- **Ignored Files**: Integrated document exclusion logic to safely ignore unneeded files.

### Improved
- **Status Bar**: Enhanced ATM Control Center UI with improved visual hierarchy, minimal tooltip layouts, and a direct GitHub repository link.
- **Inline Comments**: Supported inline comment highlighting by differentiating between whole-line and inline UI decoration types.
- **Focus UI**: Refined quick-access button animations inside the focus screen and adjusted spacing.
- **Architecture**: Refactored the `status-bar` codebase into a scalable modular structure inside `utils`.

---
## [1.9.2] - 2026-04-16
### Improved
- **FAAH**: Enhanced sound file resolution and adding process interruption support for sound player. 
- **Status Bar**: Added FAAH audio configuration management and simplified audio UI.

---

## [1.9.1] - 2026-04-15
### Improved
- **I18N**: Extended localization config for `package.json` updating extension descriptions.

---

## [1.8.6] - 2026-04-08
### Improved
- **Music Controls**: Updated random AM station playback keybinding.
- **Focus UI**: Refined quick-access button animations inside the focus screen and adjusted spacing.

---

## [1.8.5] - 2026-04-08
### Added
- **Comments Code**: Added support for inline comment highlighting logic.

---

## [1.8.1] - 2026-04-07
### Improved
- General bugfixes, tooltip formatting, and extension polishing.

---

## [1.8.0] - 2026-04-06
### Improved
- Core logic update and presentation fixes.

---

## [1.7.0] - 2026-04-06
### Added
- Feature updates and performance optimization patches.

---

## [1.6.0] - 2026-04-06
### Improved
- Settings: Adjusted internal configurations.

---

## [1.5.5] - 2026-04-05
### Improved
- Further refined behaviors and visual changes.

---

## [1.5.1] - 2026-04-05
### Added
- **Code Spell**: Updated custom spellcheck words.
- **Marketplace**: Reordered extension categories.

---

## [1.4.0] - 2026-04-03
### Improved
- Internal architecture optimizations.

---

## [1.3.0] - 2026-04-02
### Improved
- **Internationalization (i18n)**: Changed display name to "ᐱ T ꓟ" across locales and implemented NLS keys for translations.
- Core: Comprehensive update covering commands and views.

---

## [1.2.6] - 2026-03-31
### Improved
- General optimization updates.

---

## [1.2.5] - 2026-03-31
### Improved
- **Dependencies**: Removed `NeteaseCloudMusicApi` dependency to optimize bundle.

---

## [1.2.3] - 2026-03-31
### Improved
- **Config**: Removed source file exclusion patterns from `.vscodeignore`.

---

## [1.2.2] - 2026-03-31
### Added
- **Screenshot Code**: Implemented ready-state validation for screenshot download button.

---
## [1.1.2] - 2025-03-17

- Refactor readme, and better Docs, ES & ZH

---

## [1.1.1] - 2025-03-13

- Add two doc  ES & SH
- Update icons "Liquid glass
- Update version v0.1.2 to v1.1.1

---

## [0.1.2] - 2025-03-13

### Improved

- Enhanced the README with better structure, clear descriptions, and modern design.
- Added images and videos to the documentation for a more visual and engaging experience.

---

## [0.1.1] - 2025-03-13

### Added

- Env Lens extension and commands to reveal and hide `.env` values securely.

### Improved

- General fixes and improvements across existing extensions.
- Stability updates for existing modules and configurations.

---

## [0.0.1] - 2025-03-02

### 🎉 Initial Release

- First public preview of ATM (Advanced Tool Module).
- Creation of the full extension suite and modular architecture.
- Initial release of all ATM extensions and core configurations, ready to use.
- Base command set and integration for VS Code-compatible editors.
