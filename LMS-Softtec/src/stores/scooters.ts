import { finishLoading, startScooterLoading, updateLoadingStep } from "@/stores/loading";
import type { RouteInfo, Scooter, ScooterRide } from "@/types/scooter";
import { calculateCost, calculateDistance, generateMockActiveRides, generateMockScooters, generateRandomPosition } from "@/utils/mockData";
import { routingService } from "@/utils/routing";
import { ref } from "vue";

// Global state
export const scooters = ref<Scooter[]>([]);
export const selectedScooter = ref<Scooter | null>(null);
export const targetPosition = ref<[number, number] | null>(null);
export const routeInfo = ref<RouteInfo | null>(null);
export const activeRides = ref<ScooterRide[]>([]);
export const isCalculatingRoute = ref(false);

// Automatic ride system
let automaticRideInterval: number | null = null;
const MIN_AVAILABLE_SCOOTERS = 8; // Mindestanzahl freier Scooter
const MAX_AUTO_RIDES_PERCENTAGE = 0.3; // Maximal 30% der Scooter können automatisch fahren
const AUTO_RIDE_CHECK_INTERVAL = 15000; // Alle 15 Sekunden prüfen
const AUTO_RIDE_PROBABILITY = 0.15; // 15% Chance pro Check, dass ein Scooter startet

// Get active ride for a specific scooter
export function getActiveRideForScooter(scooterId: string): ScooterRide | null {
    return activeRides.value.find((ride) => ride.scooterId === scooterId && ride.isActive) || null;
}

// Automatic ride system functions
function getAvailableScootersForAutoRide(): Scooter[] {
    return scooters.value.filter(
        (scooter) => scooter.isAvailable && !scooter.isInUse && scooter.batteryLevel > 30, // Nur Scooter mit genug Akku
    );
}

function canStartAutomaticRide(): boolean {
    const availableScooters = getAvailableScootersForAutoRide();
    const currentAutoRides = activeRides.value.filter((ride) => ride.isAutomatic).length;
    const maxAutoRides = Math.floor(scooters.value.length * MAX_AUTO_RIDES_PERCENTAGE);

    return availableScooters.length > MIN_AVAILABLE_SCOOTERS && currentAutoRides < maxAutoRides && Math.random() < AUTO_RIDE_PROBABILITY;
}

async function startAutomaticRide(): Promise<void> {
    if (!canStartAutomaticRide()) return;

    const availableScooters = getAvailableScootersForAutoRide();
    if (availableScooters.length === 0) return;

    // Zufälligen Scooter auswählen
    const randomScooter = availableScooters[Math.floor(Math.random() * availableScooters.length)];

    try {
        // Zufällige Zielposition generieren
        const targetPos = generateRandomPosition();

        // Route berechnen
        const routeData = await routingService.calculateRoute(randomScooter.position, targetPos);
        const { duration } = calculateCost(routeData.distance, randomScooter.pricePerMinute);

        // Automatische Fahrt erstellen
        const rideId = `auto-ride-${Date.now()}`;
        const ride: ScooterRide = {
            id: rideId,
            scooterId: randomScooter.id,
            startPosition: [...randomScooter.position] as [number, number],
            currentPosition: [...randomScooter.position] as [number, number],
            targetPosition: targetPos,
            startTime: new Date(),
            estimatedEndTime: new Date(Date.now() + duration * 60 * 1000),
            progress: 0,
            route: routeData.waypoints,
            isActive: true,
            isAutomatic: true, // Markierung für automatische Fahrt
            initialBatteryLevel: randomScooter.batteryLevel,
        };

        // Scooter Status aktualisieren
        randomScooter.isInUse = true;
        randomScooter.isAvailable = false;

        activeRides.value.push(ride);
        simulateRide(ride);

        console.log(`🚗 Automatische Fahrt gestartet: Scooter ${randomScooter.model} (${randomScooter.id}) fährt ${Math.round(routeData.distance)}m`);
    } catch (error) {
        console.warn("Fehler beim Starten der automatischen Fahrt:", error);
    }
}

export function startAutomaticRideSystem(): void {
    if (automaticRideInterval) return; // System bereits gestartet

    automaticRideInterval = setInterval(() => {
        startAutomaticRide();
    }, AUTO_RIDE_CHECK_INTERVAL) as any;

    console.log("🚀 Automatisches Scooter-System gestartet");
}

export function stopAutomaticRideSystem(): void {
    if (automaticRideInterval) {
        clearInterval(automaticRideInterval);
        automaticRideInterval = null;
        console.log("⏹️ Automatisches Scooter-System gestoppt");
    }
}

// Calculate current ride cost based on elapsed time
export function calculateCurrentRideCost(ride: ScooterRide): number {
    const scooter = scooters.value.find((s) => s.id === ride.scooterId);
    if (!scooter) return 0;

    const elapsedMs = Date.now() - ride.startTime.getTime();
    const elapsedMinutes = elapsedMs / (1000 * 60);

    return Math.round(elapsedMinutes * scooter.pricePerMinute * 100) / 100;
}

// Calculate ride duration in minutes and seconds
export function calculateRideDuration(ride: ScooterRide): { minutes: number; seconds: number } {
    const elapsedMs = Date.now() - ride.startTime.getTime();
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return { minutes, seconds };
}

// Calculate battery usage during ride (simulate realistic usage)
export function calculateBatteryUsage(ride: ScooterRide, initialBattery: number): number {
    const elapsedMs = Date.now() - ride.startTime.getTime();
    const elapsedMinutes = elapsedMs / (1000 * 60);

    // Simulate battery usage: roughly 1% per 3-4 minutes of riding
    const batteryUsageRate = 0.3; // percent per minute
    const usedBattery = elapsedMinutes * batteryUsageRate;

    return Math.min(100, Math.max(0, initialBattery - Math.round(usedBattery)));
}

// Initialize scooters
export async function initializeScooters() {
    // Start loading process
    startScooterLoading(25);
    updateLoadingStep("init", "loading");

    try {
        updateLoadingStep("init", "completed");

        // Generate scooters with position validation
        scooters.value = await generateMockScooters(25);

        // Generate mock active rides for scooters that are in use
        const mockActiveRides = await generateMockActiveRides(scooters.value);
        activeRides.value = mockActiveRides;

        console.log(`Generated ${mockActiveRides.length} active rides with real routes`);

        // Start simulation for each active ride
        updateLoadingStep("finalize", "loading", "Fahrten-Simulation wird gestartet...");
        mockActiveRides.forEach((ride) => {
            console.log(`Starting simulation for ride ${ride.id} with progress ${Math.round(ride.progress * 100)}%`);
            simulateRide(ride);
        });

        updateLoadingStep("finalize", "completed");

        // Automatisches Scooter-System starten
        setTimeout(() => {
            startAutomaticRideSystem();
        }, 5000); // Nach 5 Sekunden starten

        finishLoading();
    } catch (error) {
        console.error("Failed to initialize scooters:", error);
        updateLoadingStep("finalize", "error");
    }
}

// Select a scooter
export function selectScooter(scooter: Scooter) {
    console.log("selectScooter called for:", scooter.id, "available:", scooter.isAvailable, "inUse:", scooter.isInUse);

    selectedScooter.value = scooter;

    // Only clear target and route if scooter is in use (since user can't set new destination)
    if (scooter.isInUse) {
        targetPosition.value = null;
        routeInfo.value = null;
    } else {
        // For available scooters, clear previous route planning
        targetPosition.value = null;
        routeInfo.value = null;
    }

    console.log("Scooter selected successfully:", scooter.id);
    return true;
}

// Select a scooter by ride - find scooter associated with the ride
export function selectScooterByRide(ride: ScooterRide) {
    const scooter = scooters.value.find((s) => s.id === ride.scooterId);
    if (scooter) {
        selectScooter(scooter);
        console.log("Scooter selected by ride:", ride.id, "-> scooter:", scooter.id);
        return true;
    }
    console.warn("Scooter not found for ride:", ride.id);
    return false;
}

// Set target position and calculate route
export async function setTargetPosition(position: [number, number]) {
    console.log("setTargetPosition called", position);
    if (!selectedScooter.value) {
        console.log("No scooter selected");
        return;
    }

    console.log("Setting target position for scooter:", selectedScooter.value.id);
    targetPosition.value = position;
    isCalculatingRoute.value = true;

    try {
        console.log("Calculating real route...");
        const routeData = await routingService.calculateRoute(selectedScooter.value.position, position);

        const { cost, duration } = calculateCost(routeData.distance, selectedScooter.value.pricePerMinute);

        routeInfo.value = {
            distance: routeData.distance,
            duration,
            cost,
            waypoints: routeData.waypoints,
        };

        console.log("Real route calculated:", routeInfo.value);
    } catch (error) {
        console.warn("Real routing failed, using direct route:", error);

        // Fallback to direct route
        const distance = calculateDistance(selectedScooter.value.position, position);
        const { cost, duration } = calculateCost(distance, selectedScooter.value.pricePerMinute);

        routeInfo.value = {
            distance,
            duration,
            cost,
            waypoints: [selectedScooter.value.position, position],
        };

        console.log("Fallback route calculated:", routeInfo.value);
    }

    isCalculatingRoute.value = false;
}

// Start a ride
export function startRide(): string | null {
    if (!selectedScooter.value || !targetPosition.value || !routeInfo.value) {
        return null;
    }

    const rideId = `ride-${Date.now()}`;
    const ride: ScooterRide = {
        id: rideId,
        scooterId: selectedScooter.value.id,
        startPosition: [...selectedScooter.value.position] as [number, number],
        currentPosition: [...selectedScooter.value.position] as [number, number],
        targetPosition: [...targetPosition.value] as [number, number],
        startTime: new Date(),
        estimatedEndTime: new Date(Date.now() + routeInfo.value.duration * 60 * 1000),
        progress: 0,
        route: routeInfo.value.waypoints,
        isActive: true,
        initialBatteryLevel: selectedScooter.value.batteryLevel,
    };

    // Update scooter status
    selectedScooter.value.isInUse = true;
    selectedScooter.value.isAvailable = false;

    activeRides.value.push(ride);

    // Start ride simulation
    simulateRide(ride);

    // Clear selection
    selectedScooter.value = null;
    targetPosition.value = null;
    routeInfo.value = null;

    return rideId;
}

// Simulate ride progress
function simulateRide(ride: ScooterRide) {
    const updateInterval = 1000; // Update every second
    const totalDuration = ride.estimatedEndTime.getTime() - ride.startTime.getTime();

    const interval = setInterval(() => {
        if (!ride.isActive) {
            clearInterval(interval);
            return;
        }

        const elapsed = Date.now() - ride.startTime.getTime();
        const newProgress = Math.min(elapsed / totalDuration, 1);

        // Use routing service to interpolate position along real route
        const newCurrentPosition = routingService.interpolatePosition(ride.route, newProgress);

        // Find and update the ride in the activeRides array to trigger reactivity
        const rideIndex = activeRides.value.findIndex((r) => r.id === ride.id);
        if (rideIndex !== -1) {
            // Create a new ride object to trigger Vue's reactivity
            activeRides.value[rideIndex] = {
                ...activeRides.value[rideIndex],
                progress: newProgress,
                currentPosition: newCurrentPosition,
            };

            // Debug log every 10 seconds
            if (Math.floor(elapsed / 1000) % 10 === 0) {
                console.log(`Ride ${ride.id}: ${Math.round(newProgress * 100)}% complete`);
            }
        }

        // Update scooter position - trigger Vue reactivity by creating new array
        const scooterIndex = scooters.value.findIndex((s) => s.id === ride.scooterId);
        if (scooterIndex !== -1) {
            // Create a new scooter object to trigger Vue's reactivity
            scooters.value[scooterIndex] = {
                ...scooters.value[scooterIndex],
                position: [...newCurrentPosition] as [number, number],
            };
        } else {
            console.warn(`Scooter ${ride.scooterId} not found in scooters array`);
        }

        // End ride when complete
        if (newProgress >= 1) {
            endRide(ride.id);
            clearInterval(interval);
        }
    }, updateInterval);
}

// End a ride
export function endRide(rideId: string) {
    const rideIndex = activeRides.value.findIndex((r) => r.id === rideId);
    if (rideIndex === -1) return;

    const ride = activeRides.value[rideIndex];
    ride.isActive = false;

    // Update scooter status
    const scooter = scooters.value.find((s) => s.id === ride.scooterId);
    if (scooter) {
        scooter.isInUse = false;
        scooter.isAvailable = true;
        scooter.position = [...ride.targetPosition] as [number, number];
        scooter.lastUsed = new Date();
    }

    // Remove from active rides
    activeRides.value.splice(rideIndex, 1);
}

// Clear selection
export function clearSelection() {
    selectedScooter.value = null;
    targetPosition.value = null;
    routeInfo.value = null;
}
