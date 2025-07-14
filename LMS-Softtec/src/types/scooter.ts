export interface Scooter {
    id: string;
    position: [number, number]; // [lat, lng]
    batteryLevel: number; // 0-100
    isAvailable: boolean;
    isInUse: boolean;
    pricePerMinute: number; // in Euro
    model: string;
    lastUsed?: Date;
}

export interface ScooterRide {
    id: string;
    scooterId: string;
    startPosition: [number, number];
    currentPosition: [number, number];
    targetPosition: [number, number];
    startTime: Date;
    estimatedEndTime: Date;
    progress: number; // 0-1
    route: [number, number][];
    isActive: boolean;
    initialBatteryLevel?: number; // battery level when ride started
}

export interface RouteInfo {
    distance: number; // in meters
    duration: number; // in minutes
    cost: number; // in Euro
    waypoints: [number, number][];
}
