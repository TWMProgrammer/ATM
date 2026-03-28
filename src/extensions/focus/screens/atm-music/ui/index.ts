/**
 * ATM Music Module Entry Point
 * Exports the controller to be used by the main webview runner.
 */

import { AtmMusicController, VSCodeApi } from './controller';

export function createAtmMusicController(vscode: VSCodeApi): AtmMusicController {
    return new AtmMusicController(vscode);
}

export { AtmMusicController };
