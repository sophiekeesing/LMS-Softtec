import { db } from "@/db";
import {
    finishLoading,
    startScooterLoading,
    updateLoadingStep,
} from "@/stores/loading";
import type { RouteInfo, Scooter, ScooterRide } from "@/types/scooter";
import {
    calculateCost,
    calculateDistance,
    generateMockActiveRides,
    generateMockScooters,
    generateRandomPosition,
} from "@/utils/mockData";
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
    return (
        activeRides.value.find(
            (ride) => ride.scooterId === scooterId && ride.isActive
        ) || null
    );
}

// Automatic ride system functions
function getAvailableScootersForAutoRide(): Scooter[] {
    return scooters.value.filter(
        (scooter) =>
            scooter.isAvailable && !scooter.isInUse && scooter.batteryLevel > 30 // Nur Scooter mit genug Akku
    );
}

function canStartAutomaticRide(): boolean {
    const availableScooters = getAvailableScootersForAutoRide();
    const currentAutoRides = activeRides.value.filter(
        (ride) => ride.isAutomatic
    ).length;
    const maxAutoRides = Math.floor(
        scooters.value.length * MAX_AUTO_RIDES_PERCENTAGE
    );

    return (
        availableScooters.length > MIN_AVAILABLE_SCOOTERS &&
        currentAutoRides < maxAutoRides &&
        Math.random() < AUTO_RIDE_PROBABILITY
    );
}

async function startAutomaticRide(): Promise<void> {
    if (!canStartAutomaticRide()) return;

    const availableScooters = getAvailableScootersForAutoRide();
    if (availableScooters.length === 0) return;

    // Zufälligen Scooter auswählen
    const randomScooter =
        availableScooters[Math.floor(Math.random() * availableScooters.length)];

    try {
        // Zufällige Zielposition generieren
        const targetPos = generateRandomPosition();

        // Route berechnen
        const routeData = await routingService.calculateRoute(
            randomScooter.position,
            targetPos
        );
        const { duration } = calculateCost(
            routeData.distance,
            randomScooter.pricePerMinute
        );

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

        // Save to database
        await saveRideToDb(ride);
        await updateScooterInDb(randomScooter.id, {
            isInUse: true,
            isAvailable: false,
            position: randomScooter.position,
        });

        activeRides.value.push(ride);
        simulateRide(ride);

        console.log(
            `🚗 Automatische Fahrt gestartet: Scooter ${randomScooter.model} (${
                randomScooter.id
            }) fährt ${Math.round(routeData.distance)}m`
        );
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

// Development utility to clear all persistent data
export async function clearAllData(): Promise<void> {
    try {
        await db.scooters.clear();
        await db.rides.clear();
        console.log("🗑️ All persistent data cleared");

        // Reset reactive state
        scooters.value = [];
        activeRides.value = [];
        selectedScooter.value = null;
        targetPosition.value = null;
        routeInfo.value = null;
    } catch (error) {
        console.error("Failed to clear persistent data:", error);
    }
}

// Make clear function available globally for testing (development only)
if (typeof window !== "undefined") {
    (window as any).clearAllData = clearAllData;
}

// Database persistence functions
async function saveScooterToDb(scooter: Scooter): Promise<void> {
    try {
        await db.scooters.put(scooter);
    } catch (error) {
        console.error("Failed to save scooter to database:", error);
    }
}

async function saveRideToDb(ride: ScooterRide): Promise<void> {
    try {
        await db.rides.put(ride);
    } catch (error) {
        console.error("Failed to save ride to database:", error);
    }
}

async function loadScootersFromDb(): Promise<Scooter[]> {
    try {
        return await db.scooters.toArray();
    } catch (error) {
        console.error("Failed to load scooters from database:", error);
        return [];
    }
}

async function loadActiveRidesFromDb(): Promise<ScooterRide[]> {
    try {
        // Get all rides and filter active ones in JavaScript since Dexie has issues with boolean queries
        const allRides = await db.rides.toArray();
        const activeRides = allRides.filter((ride) => ride.isActive === true);

        // Fix date objects that might have been serialized as strings
        return activeRides.map((ride) => ({
            ...ride,
            startTime: new Date(ride.startTime),
            estimatedEndTime: new Date(ride.estimatedEndTime),
        }));
    } catch (error) {
        console.error("Failed to load rides from database:", error);
        return [];
    }
}

async function deleteRideFromDb(rideId: string): Promise<void> {
    try {
        await db.rides.delete(rideId);
    } catch (error) {
        console.error("Failed to delete ride from database:", error);
    }
}

async function updateScooterInDb(
    scooterId: string,
    updates: Partial<Scooter>
): Promise<void> {
    try {
        await db.scooters.update(scooterId, updates);
    } catch (error) {
        console.error("Failed to update scooter in database:", error);
    }
}

async function updateRideInDb(
    rideId: string,
    updates: Partial<ScooterRide>
): Promise<void> {
    try {
        await db.rides.update(rideId, updates);
    } catch (error) {
        console.error("Failed to update ride in database:", error);
    }
}

// Clean up old completed rides (older than 24 hours)
async function cleanupOldRides(): Promise<void> {
    try {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const allRides = await db.rides.toArray();
        const oldRides = allRides.filter(
            (ride) =>
                ride.isActive === false && ride.estimatedEndTime < oneDayAgo
        );

        for (const ride of oldRides) {
            await deleteRideFromDb(ride.id);
        }

        if (oldRides.length > 0) {
            console.log(`Cleaned up ${oldRides.length} old completed rides`);
        }
    } catch (error) {
        console.error("Failed to cleanup old rides:", error);
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
export function calculateRideDuration(ride: ScooterRide): {
    minutes: number;
    seconds: number;
} {
    const elapsedMs = Date.now() - ride.startTime.getTime();
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return { minutes, seconds };
}

// Calculate battery usage during ride (simulate realistic usage)
export function calculateBatteryUsage(
    ride: ScooterRide,
    initialBattery: number
): number {
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

        // Try to load existing data from database
        updateLoadingStep("finalize", "loading", "Lade gespeicherte Daten...");

        // Clean up old completed rides first
        await cleanupOldRides();

        const existingScooters = await loadScootersFromDb();
        const existingRides = await loadActiveRidesFromDb();

        console.log("Database loading results:", {
            scootersFound: existingScooters.length,
            ridesFound: existingRides.length,
            ridesDetails: existingRides.map((r) => ({
                id: r.id,
                isActive: r.isActive,
                scooterId: r.scooterId,
                progress: r.progress,
            })),
        });

        if (existingScooters.length > 0) {
            // Use existing data
            console.log(
                `Loaded ${existingScooters.length} scooters from database`
            );
            scooters.value = existingScooters;

            // Filter and restore active rides
            const validActiveRides = existingRides.filter((ride) => {
                const scooter = existingScooters.find(
                    (s) => s.id === ride.scooterId
                );
                const isValid = scooter && ride.isActive;
                console.log(
                    `Ride ${ride.id}: scooter found=${!!scooter}, isActive=${
                        ride.isActive
                    }, valid=${isValid}`
                );
                return isValid;
            });

            activeRides.value = validActiveRides;
            console.log(
                `Loaded ${validActiveRides.length} active rides from database`
            );
            console.log(
                "Active rides:",
                validActiveRides.map((r) => ({
                    id: r.id,
                    progress: r.progress,
                    isActive: r.isActive,
                }))
            );

            // Restart simulations for active rides
            validActiveRides.forEach((ride) => {
                console.log(
                    `Restarting simulation for ride ${
                        ride.id
                    } with progress ${Math.round(ride.progress * 100)}%`
                );
                simulateRide(ride);
            });
        } else {
            // Generate new data and save to database
            console.log("No existing data found, generating new scooters...");
            updateLoadingStep(
                "finalize",
                "loading",
                "Generiere neue E-Scooter..."
            );

            const newScooters = await generateMockScooters(25);
            scooters.value = newScooters;

            // Save all scooters to database
            await Promise.all(
                newScooters.map((scooter) => saveScooterToDb(scooter))
            );
            console.log("Saved new scooters to database");

            // Generate mock active rides for scooters that are in use
            const mockActiveRides = await generateMockActiveRides(newScooters);
            activeRides.value = mockActiveRides;

            // Save all rides to database
            await Promise.all(
                mockActiveRides.map((ride) => saveRideToDb(ride))
            );
            console.log(
                `Generated and saved ${mockActiveRides.length} active rides with real routes`
            );

            // Start simulation for each active ride
            mockActiveRides.forEach((ride) => {
                console.log(
                    `Starting simulation for ride ${
                        ride.id
                    } with progress ${Math.round(ride.progress * 100)}%`
                );
                simulateRide(ride);
            });
        }

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
    console.log(
        "selectScooter called for:",
        scooter.id,
        "available:",
        scooter.isAvailable,
        "inUse:",
        scooter.isInUse
    );

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
        console.log(
            "Scooter selected by ride:",
            ride.id,
            "-> scooter:",
            scooter.id
        );
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

    console.log(
        "Setting target position for scooter:",
        selectedScooter.value.id
    );
    targetPosition.value = position;
    isCalculatingRoute.value = true;

    try {
        console.log("Calculating real route...");
        const routeData = await routingService.calculateRoute(
            selectedScooter.value.position,
            position
        );

        const { cost, duration } = calculateCost(
            routeData.distance,
            selectedScooter.value.pricePerMinute
        );

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
        const distance = calculateDistance(
            selectedScooter.value.position,
            position
        );
        const { cost, duration } = calculateCost(
            distance,
            selectedScooter.value.pricePerMinute
        );

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
// Start a ride
export async function startRide(): Promise<string | null> {
    if (!selectedScooter.value || !targetPosition.value || !routeInfo.value) {
        return null;
    }

    const rideId = `ride-${Date.now()}`;
    const ride: ScooterRide = {
        id: rideId,
        scooterId: selectedScooter.value.id,
        startPosition: [...selectedScooter.value.position] as [number, number],
        currentPosition: [...selectedScooter.value.position] as [
            number,
            number
        ],
        targetPosition: [...targetPosition.value] as [number, number],
        startTime: new Date(),
        estimatedEndTime: new Date(
            Date.now() + routeInfo.value.duration * 60 * 1000
        ),
        progress: 0,
        route: routeInfo.value.waypoints,
        isActive: true,
        initialBatteryLevel: selectedScooter.value.batteryLevel,
    };

    // Update scooter status
    selectedScooter.value.isInUse = true;
    selectedScooter.value.isAvailable = false;

    // Save to database
    await saveRideToDb(ride);
    await updateScooterInDb(selectedScooter.value.id, {
        isInUse: true,
        isAvailable: false,
        position: selectedScooter.value.position,
    });

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
    const totalDuration =
        ride.estimatedEndTime.getTime() - ride.startTime.getTime();
    let lastDbUpdate = 0; // Track last database update
    const dbUpdateInterval = 10000; // Update database every 10 seconds

    const interval = setInterval(async () => {
        if (!ride.isActive) {
            clearInterval(interval);
            return;
        }

        const elapsed = Date.now() - ride.startTime.getTime();
        const newProgress = Math.min(elapsed / totalDuration, 1);

        // Use routing service to interpolate position along real route
        const newCurrentPosition = routingService.interpolatePosition(
            ride.route,
            newProgress
        );

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
                console.log(
                    `Ride ${ride.id}: ${Math.round(
                        newProgress * 100
                    )}% complete`
                );
            }
        }

        // Update scooter position - trigger Vue reactivity by creating new array
        const scooterIndex = scooters.value.findIndex(
            (s) => s.id === ride.scooterId
        );
        if (scooterIndex !== -1) {
            // Create a new scooter object to trigger Vue's reactivity
            const updatedScooter = {
                ...scooters.value[scooterIndex],
                position: [...newCurrentPosition] as [number, number],
            };
            scooters.value[scooterIndex] = updatedScooter;

            // Save to database periodically (every 10 seconds) to avoid too many writes
            if (elapsed - lastDbUpdate >= dbUpdateInterval) {
                lastDbUpdate = elapsed;
                await updateRideInDb(ride.id, {
                    progress: newProgress,
                    currentPosition: newCurrentPosition,
                });
                await updateScooterInDb(ride.scooterId, {
                    position: newCurrentPosition,
                });
            }
        } else {
            console.warn(
                `Scooter ${ride.scooterId} not found in scooters array`
            );
        }

        // End ride when complete
        if (newProgress >= 1) {
            await endRide(ride.id);
            clearInterval(interval);
        }
    }, updateInterval);
}

// End a ride
// End a ride
export async function endRide(rideId: string) {
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

        // Update scooter in database
        await updateScooterInDb(scooter.id, {
            isInUse: false,
            isAvailable: true,
            position: scooter.position,
            lastUsed: scooter.lastUsed,
        });
    }

    // Update ride in database to mark as inactive
    await updateRideInDb(rideId, { isActive: false });

    // Remove from active rides
    activeRides.value.splice(rideIndex, 1);
}

// Clear selection
export function clearSelection() {
    selectedScooter.value = null;
    targetPosition.value = null;
    routeInfo.value = null;
}
