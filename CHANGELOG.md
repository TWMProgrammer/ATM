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
- **FAAH**: Enhanced sound file resolution and added process interruption support for the sound player. 
- **Status Bar**: Added FAAH audio configuration management and simplified audio UI.

---

## [1.9.1] - 2026-04-15
### Added
- **Global Status Bar**: Centralized status bar items into a unified global hover UI via a new `zhared` module. Includes "Normal" and "Pro" layout presets, dynamic auto-refresh, and a debounced architecture.
- **AI Data ID**: Added model family icons to tooltip rows and included exhausted models in summary calculations.

### Improved
- **UI/UX**: Updated hover UI to display "ATM Control Center", streamlined compact mode, and disabled unnecessary animations to boost performance.
- **ESLint**: Added an operational warning visibility toggle and simplified plugin configurations.
- **Music View**: Added a loading transition, inline CSS injection for faster webview startup, and automatic focus to radio mode if no track is selected.

---

## [1.8.6] - 2026-04-08
### Improved
- **Linting**: Added filtering for non-code ESLint warnings to reduce noise and enhanced overall linting feedback.
- **Dependencies**: Updated ESLint configurations and underlying packages.

---

## [1.8.5] - 2026-04-08
### Added
- **Radio & Favorites**: Built an AM station favorites system with UI toggles, state persistence, and URL normalization for seamless music streaming.
- **Audio Visualizer**: Added a 4-bar animated equalizer visualizer to active radio station buttons, synchronized with audio events.
- **Global Music Toggle**: Added a global command to toggle music playback via keyboard shortcuts.

### Improved
- **Music UI Layout**: Center-aligned items in the radio panel, froze primary button widths, and updated the favorite button states for full/empty slots.
- **Status Warnings**: Replaced engine failure diagnostics with window notifications and implemented server-to-client status tracking in the status bar.
- **Iconography**: Updated the main extension icon asset.

---

## [1.8.1] - 2026-04-07
### Added
- **ATM Lint Integration**: Comprehensive native ESLint Language Server integration (client & server) with Astro support, Code Actions for fixes, and workspace-aware `cwd` resolution.
- **Spell Check**: Implemented the Dice coefficient algorithm for significantly improved spell-check suggestion accuracy.
- **Claude Warnings**: Added a Claude peak hour warning badge to the AI data quota tooltip.

### Improved
- **Lint UI**: Reduced left margins for decorators and added rule-based emojis to lint Code Action titles for quicker visual parsing.
- **Performance**: Added document linting debounce, document versioning to prevent stale code actions, and robust LSP client lifecycle management.

---

## [1.8.0] - 2026-04-06
### Added
- **ESLint LSP**: Brought Astro support to the ESLint client document selector and implemented Code Actions.
- **Client/Server ESLint Architecture**: Built the initial build configuration and established client-server communication via a robust LSP setup.
- **AI Data ID**: Added model basket aggregation for more accurate credit consumption tracking.

### Improved
- **Translate Doc**: Added progressive opacity fade-out to the UI, improved translation caching with hash keys and size limits, and fixed a release-notes memory leak.
- **Music View**: Redesigned skeleton loading UI for dynamic layout representations.

---

## [1.7.0] - 2026-04-06
### Added
- **Multi-language Support**: Added translations for `RU`, `PT-BR`, `FR`, and `DE` along with new NLS dictionaries for complete UI coverage. 
- **Translate Doc Features**: Added translation abort support, TTS feedback badges, localized media hints, and support for additional languages in the Quick Pick menu.

### Improved
- **Notifications**: Polished notification deletion interactions.
- **I18n Architecture**: Massively refactored to internationalize extension commands and views using NLS localization keys.

---

## [1.6.0] - 2026-04-06
### Improved
- **Iconography**: Redesigned warning icons (e.g., "20% AI data left").
- **Performance**: Stripped unused event activations from the `package.json` map.

---

## [1.5.5] - 2026-04-05
### Added
- **Music UI**: Added an animated music icon to the radio tab button inside the Quick Access menu.

### Improved
- **Focus UI**: Enhanced overall aesthetics with typography tweaks, better tab padding, and customized cursor pointers for music states. Re-balanced the ATM-time display glow, and introduced dynamic playback state animations.

---

## [1.5.1] - 2026-04-05
### Added
- **Streams**: Added and updated several stream URLs for global AM stations, including Singapore and Mexico.
- **Local Stats Tracking**: Replaced GitHub streak calculation with local daily coding streak state management.

### Improved
- **TTS Logic**: Prioritized focused UI element selection over text editor selection during voice invocation.
- **Bento UI**: Refreshed UI elements around streak tracking, renaming default placeholder strings, and ensuring transparent themes mirror VS Code environment vars.

---

## [1.4.0] - 2026-04-03
### Added
- **Comments Code**: Added dynamic gutter icons to comment decorators. Supported styling for specific tag detection patterns (like TODO, FIXME, MARK) and whole-line highlighting with dynamic background generation.
- **Screenshot Code**: Enhanced the screenshot panel with new logic and better CSS layouts. Included ATM brand footers to outputs.

### Improved
- **Image Validation**: Hardened validation logic filtering non-data URIs securely.
- **Split Views**: Guarded against file operation collisions to prevent interference during split-view rename actions.

---

## [1.3.0] - 2026-04-02
### Added
- **Github Bento UI**: Implemented a dynamic heatmap grid rendering with month labels and optimized scrolling behaviors.
- **Performance**: Built a memory cache for data providers to heavily optimize the UI rendering path. Updates now happen via dynamic DOM repaints instead of complete webview reloads.

### Improved
- **Music Visualization**: Swapped out static glow orbs with interactive, frame-driven audio wave animations under the music player.
- **API Reuse**: Prevented webview crashes by securely reusing existing `vscode` API instances from window bounds.

---

## [1.2.6] - 2026-03-31
### Improved
- **Screenshot**: Further centralized VS Code API access points across modules for better stability.

---

## [1.2.5] - 2026-03-31
### Improved
- **Dependencies**: Excluded bloated dependencies from compilation (like `NeteaseCloudMusicApi`), switching strategies for lazy loading instead to drastically decrease the extension bundle load speed.

---

## [1.2.3] - 2026-03-31
### Added
- **Pomodoro Timer**: Introduced Pomodoro functionalities right into the native extension state! Includes UI connections.

### Improved
- **Git Blame**: Hardened Git blame functionality with filters explicitly checking for nested error boundaries.

---

## [1.2.2] - 2026-03-31
### Added
- **Markdown Tools**: Created Markdown image icon providers. Introduced full autocomplete enhancements and better caching behaviors.

### Improved
- **Hover Definitions**: Changed mapped loops to execute sequentially on native components to prevent async collisions during path resolutions inside Hover providers.
- **Decorations**: Optimized decorators by grouping gutters into distinct rendering passes, solving UI tearing during tab switching.

---
## [1.1.2] - 2025-03-17
### Improved
- **Documentation**: Refactored README and improved Spanish (ES) and Chinese (ZH) documentation.

---

## [1.1.1] - 2025-03-13
### Added
- **Documentation**: Added Spanish (ES) and Chinese (ZH) documentation files.

### Improved
- **Iconography**: Updated icons to the "Liquid glass" style.
- Version bumped from 0.1.2 to 1.1.1.

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
