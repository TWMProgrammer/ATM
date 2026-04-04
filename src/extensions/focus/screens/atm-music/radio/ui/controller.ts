import { RadioStationId } from '../../shared/types';

export class AtmRadioController {
    private currentStation: RadioStationId | null = null;

    constructor(private readonly onStationSelected: (stationId: RadioStationId) => void) {}

    public selectStation(stationId: RadioStationId): void {
        this.currentStation = stationId;
        this.onStationSelected(stationId);
    }

    public getCurrentStation(): RadioStationId | null {
        return this.currentStation;
    }
}
