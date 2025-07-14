import { updateLoadingStep } from "@/stores/loading";
import type { Scooter, ScooterRide } from "@/types/scooter";
import { routingService } from "./routing";

// Hamburg city center coordinates (Rathaus/Binnenalster)
export const HAMBURG_CENTER: [number, number] = [53.5511, 9.9937];

// Generate random coordinates within Hamburg city bounds (north of Elbe)
// Uses smart placement to avoid water areas
export function generateRandomPosition(): [number, number] {
    // Define safe zones within Hamburg (north of Elbe) to avoid major water bodies
    const safeZones = [
        // Altona/St. Pauli area
        { south: 53.545, north: 53.56, west: 9.95, east: 9.975 },
        // City center/Neustadt
        { south: 53.545, north: 53.565, west: 9.975, east: 10.005 },
        // HafenCity/Speicherstadt area
        { south: 53.54, north: 53.555, west: 10.005, east: 10.03 },
        // Eimsbüttel area
        { south: 53.56, north: 53.58, west: 9.95, east: 9.985 },
        // Rotherbaum/Harvestehude
        { south: 53.56, north: 53.58, west: 9.985, east: 10.02 },
    ];

    // Pick a random safe zone
    const zone = safeZones[Math.floor(Math.random() * safeZones.length)];

    const lat = zone.south + Math.random() * (zone.north - zone.south);
    const lng = zone.west + Math.random() * (zone.east - zone.west);

    return [lat, lng];
}

// Generate mock scooter data (no validation to avoid API rate limits)
export async function generateMockScooters(count: number = 25): Promise<Scooter[]> {
    const scooters: Scooter[] = [];
    const models = ["Xiaomi Mi 3", "Ninebot ES4", "Bird One", "Lime Gen 4", "Tier ES200"];

    console.log(`Generating ${count} scooters with smart positioning (no API validation)...`);
    updateLoadingStep("scooters", "loading", `0 von ${count} E-Scooter erstellt`);

    for (let i = 0; i < count; i++) {
        const isInUse = Math.random() < 0.15; // 15% chance of being in use

        // Update progress
        updateLoadingStep("scooters", "loading", `${i + 1} von ${count} E-Scooter erstellt`);

        // Use smart random positioning to avoid water areas
        const position = generateRandomPosition();

        scooters.push({
            id: `scooter-${i + 1}`,
            position,
            batteryLevel: Math.floor(Math.random() * 80) + 20, // 20-100%
            isAvailable: !isInUse && Math.random() > 0.1, // 10% unavailable for maintenance
            isInUse,
            pricePerMinute: 0.15 + Math.random() * 0.1, // 0.15 - 0.25 €/min
            model: models[Math.floor(Math.random() * models.length)],
            lastUsed: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000), // within last 24h
        });

        // Small delay for UI feedback
        if (i < count - 1) {
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
    }

    updateLoadingStep("scooters", "completed", `${count} E-Scooter erstellt`);
    updateLoadingStep("validation", "completed", `Smart positioning verwendet`);

    console.log(`Generated ${scooters.length} scooters with smart positioning`);
    return scooters;
}

// Calculate distance between two points (Haversine formula)
export function calculateDistance(pos1: [number, number], pos2: [number, number]): number {
    const R = 6371000; // Earth's radius in meters
    const φ1 = (pos1[0] * Math.PI) / 180;
    const φ2 = (pos2[0] * Math.PI) / 180;
    const Δφ = ((pos2[0] - pos1[0]) * Math.PI) / 180;
    const Δλ = ((pos2[1] - pos1[1]) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

// Calculate cost based on distance and price per minute
export function calculateCost(
    distance: number,
    pricePerMinute: number,
    averageSpeed: number = 15, // km/h
): { cost: number; duration: number } {
    const distanceKm = distance / 1000;
    const duration = (distanceKm / averageSpeed) * 60; // minutes
    const cost = duration * pricePerMinute;

    return {
        cost: Math.round(cost * 100) / 100, // round to 2 decimal places
        duration: Math.round(duration),
    };
}

// Generate mock active rides for scooters that are in use
export async function generateMockActiveRides(scooters: Scooter[]): Promise<ScooterRide[]> {
    const activeRides: ScooterRide[] = [];
    const scootersInUse = scooters.filter((s) => s.isInUse);

    updateLoadingStep("rides", "loading", `0 von ${scootersInUse.length} Fahrten erstellt`);

    // Process rides with real Valhalla routing for realistic routes
    let processedRides = 0;
    for (const scooter of scootersInUse) {
        try {
            updateLoadingStep("rides", "loading", `Fahrt ${processedRides + 1} von ${scootersInUse.length} wird erstellt...`);
            updateLoadingStep("routes", "loading", `Route für ${scooter.model} wird berechnet...`);

            // Generate target position using smart positioning (no API validation needed)
            const targetPosition = generateRandomPosition();

            // Store original position as start position
            const startPosition: [number, number] = [...scooter.position];

            // Calculate real route using Valhalla for active rides
            const routeData = await routingService.calculateRoute(startPosition, targetPosition);
            const { duration } = calculateCost(routeData.distance, scooter.pricePerMinute);

            // Random progress between 10% and 80% (rides in progress)
            const progress = 0.1 + Math.random() * 0.7;

            // Calculate start time based on progress
            const totalDurationMs = duration * 60 * 1000;
            const elapsedMs = totalDurationMs * progress;
            const startTime = new Date(Date.now() - elapsedMs);
            const estimatedEndTime = new Date(startTime.getTime() + totalDurationMs);

            // Use routing service to interpolate position along real route
            const currentPosition = routingService.interpolatePosition(routeData.waypoints, progress);

            // Validate the interpolated position
            if (isNaN(currentPosition[0]) || isNaN(currentPosition[1])) {
                console.error(`Invalid interpolated position for scooter ${scooter.id}:`, currentPosition);
                throw new Error("Invalid position interpolated");
            }

            // Update scooter's current position to match ride progress
            scooter.position = currentPosition;

            const ride: ScooterRide = {
                id: `ride-${scooter.id}-${Date.now()}`,
                scooterId: scooter.id,
                startPosition,
                currentPosition,
                targetPosition,
                startTime,
                estimatedEndTime,
                progress,
                route: routeData.waypoints, // Real route with waypoints
                isActive: true,
                initialBatteryLevel: scooter.batteryLevel + Math.floor(Math.random() * 20), // Simulate initial battery was higher
            };

            activeRides.push(ride);
            processedRides++;

            // Small delay to avoid overwhelming Valhalla API for route calculations
            if (processedRides < scootersInUse.length) {
                await new Promise((resolve) => setTimeout(resolve, 200));
            }
        } catch (error) {
            console.warn(`Failed to generate route for scooter ${scooter.id}, using direct route:`, error);

            // Fallback to direct route
            const targetPosition = generateRandomPosition();
            const startPosition: [number, number] = [...scooter.position];
            const distance = calculateDistance(startPosition, targetPosition);
            const { duration } = calculateCost(distance, scooter.pricePerMinute);
            const progress = 0.1 + Math.random() * 0.7;

            const totalDurationMs = duration * 60 * 1000;
            const elapsedMs = totalDurationMs * progress;
            const startTime = new Date(Date.now() - elapsedMs);
            const estimatedEndTime = new Date(startTime.getTime() + totalDurationMs);

            const [startLat, startLng] = startPosition;
            const [targetLat, targetLng] = targetPosition;
            const currentPosition: [number, number] = [startLat + (targetLat - startLat) * progress, startLng + (targetLng - startLng) * progress];

            scooter.position = currentPosition;

            const ride: ScooterRide = {
                id: `ride-${scooter.id}-${Date.now()}`,
                scooterId: scooter.id,
                startPosition,
                currentPosition,
                targetPosition,
                startTime,
                estimatedEndTime,
                progress,
                route: [startPosition, targetPosition], // Fallback direct route
                isActive: true,
                initialBatteryLevel: scooter.batteryLevel + Math.floor(Math.random() * 20), // Simulate initial battery was higher
            };

            activeRides.push(ride);
            processedRides++;
        }
    }

    updateLoadingStep("rides", "completed", `${activeRides.length} aktive Fahrten erstellt`);
    updateLoadingStep("routes", "completed", `${activeRides.length} Routen berechnet`);

    return activeRides;
}
