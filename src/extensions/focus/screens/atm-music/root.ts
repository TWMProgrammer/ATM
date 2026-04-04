import { AtmMusicController, VSCodeApi } from './music/ui/controller';

export function createAtmMusicController(vscode: VSCodeApi): AtmMusicController {
    return new AtmMusicController(vscode);
}

export type { VSCodeApi };
export { AtmMusicController };
