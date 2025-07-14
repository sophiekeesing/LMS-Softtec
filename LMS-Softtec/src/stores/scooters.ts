import { finishLoading, startRouteCalculation, startScooterLoading, updateLoadingStep } from "@/stores/loading";
import type { RouteInfo, Scooter, ScooterRide } from "@/types/scooter";
import { calculateCost, calculateDistance, generateMockActiveRides, generateMockScooters } from "@/utils/mockData";
import { routingService } from "@/utils/routing";
import { ref } from "vue";

// Global state
export const scooters = ref<Scooter[]>([]);
export const selectedScooter = ref<Scooter | null>(null);
export const targetPosition = ref<[number, number] | null>(null);
export const routeInfo = ref<RouteInfo | null>(null);
export const activeRides = ref<ScooterRide[]>([]);
export const isCalculatingRoute = ref(false);

// Get active ride for a specific scooter
export function getActiveRideForScooter(scooterId: string): ScooterRide | null {
    return activeRides.value.find((ride) => ride.scooterId === scooterId && ride.isActive) || null;
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

    // Start route calculation loading
    startRouteCalculation();
    updateLoadingStep("request", "completed");
    updateLoadingStep("calculate", "loading");

    try {
        console.log("Calculating real route...");
        const routeData = await routingService.calculateRoute(selectedScooter.value.position, position);

        updateLoadingStep("calculate", "completed");
        updateLoadingStep("optimize", "loading");

        const { cost, duration } = calculateCost(routeData.distance, selectedScooter.value.pricePerMinute);

        routeInfo.value = {
            distance: routeData.distance,
            duration,
            cost,
            waypoints: routeData.waypoints,
        };

        updateLoadingStep("optimize", "completed");
        updateLoadingStep("complete", "loading");

        console.log("Real route calculated:", routeInfo.value);

        updateLoadingStep("complete", "completed");
        finishLoading();
    } catch (error) {
        console.warn("Real routing failed, using direct route:", error);

        updateLoadingStep("calculate", "error");
        updateLoadingStep("optimize", "loading", "Fallback-Route wird berechnet...");

        // Fallback to direct route
        const distance = calculateDistance(selectedScooter.value.position, position);
        const { cost, duration } = calculateCost(distance, selectedScooter.value.pricePerMinute);

        routeInfo.value = {
            distance,
            duration,
            cost,
            waypoints: [selectedScooter.value.position, position],
        };

        updateLoadingStep("optimize", "completed");
        updateLoadingStep("complete", "completed");
        finishLoading();

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
