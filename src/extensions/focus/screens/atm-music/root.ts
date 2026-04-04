import { AtmMusicController, VSCodeApi } from './music/ui/controller';
import { AtmRadioController } from './radio/ui/controller';
import { AudioMode, RadioStationId } from './shared/types';

/**
 * Root brain for ATM audio modes.
 * Keeps mode state and prepares the integration point for radio without
 * changing the current working music flow.
 */
export class AtmAudioRootController {
    private mode: AudioMode = 'music';
    private readonly radioController: AtmRadioController;

    constructor(private readonly musicController: AtmMusicController) {
        this.radioController = new AtmRadioController((stationId) => {
            this.handleRadioStationSelection(stationId);
        });
    }

    public getMode(): AudioMode {
        return this.mode;
    }

    public setMode(mode: AudioMode): void {
        this.mode = mode;
    }

    public toggleMode(): AudioMode {
        this.mode = this.mode === 'music' ? 'radio' : 'music';
        return this.mode;
    }

    public getMusicController(): AtmMusicController {
        return this.musicController;
    }

    public getRadioController(): AtmRadioController {
        return this.radioController;
    }

    private handleRadioStationSelection(_stationId: RadioStationId): void {
        // Wiring with real radio APIs will be implemented in the next step.
    }
}

export function createAtmMusicController(vscode: VSCodeApi): AtmMusicController {
    return new AtmMusicController(vscode);
}

export function createAtmAudioRootController(vscode: VSCodeApi): AtmAudioRootController {
    const musicController = new AtmMusicController(vscode);
    return new AtmAudioRootController(musicController);
}

export type { VSCodeApi };
export { AtmMusicController };
