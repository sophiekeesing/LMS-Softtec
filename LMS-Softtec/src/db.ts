import Dexie, { type EntityTable } from "dexie";
import type { Scooter, ScooterRide } from "./types/scooter";

const db = new Dexie("LMS-Softtec_ScooterDB") as Dexie & {
    scooters: EntityTable<Scooter, "id">;
    rides: EntityTable<ScooterRide, "id">;
};

db.version(1).stores({
    scooters:
        "++id, position, batteryLevel, isAvailable, isInUse, pricePerMinute, model, lastUsed",
    rides: "++id, scooterId, startPosition, currentPosition, targetPosition, startTime, estimatedEndTime, progress, route, isActive, initialBatteryLevel, isAutomatic",
});

export { db };
