<template>
    <div v-if="activeRides.length > 0" class="bg-white rounded-lg shadow-lg p-3 sm:p-4 max-w-xs text-xs sm:text-sm">
        <h2 class="text-lg font-bold text-gray-800 mb-3">🚴 Aktive Fahrten ({{ activeRides.length }})</h2>
        <p class="text-xs text-gray-500 mb-3">💡 Klicke auf eine Fahrt, um den Scooter auszuwählen</p>

        <div class="space-y-3 max-h-64 overflow-y-auto active-rides-scroll">
            <div
                v-for="ride in activeRides"
                :key="ride.id"
                @click="selectRide(ride)"
                :class="[
                    'border rounded p-3 transition-all duration-300 cursor-pointer hover:bg-gray-50 hover:border-gray-300',
                    isSelectedScooterRide(ride) ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200' : 'border-gray-200',
                ]"
            >
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                        <span class="font-medium text-sm">{{ getScooterModel(ride.scooterId) }}</span>
                        <span v-if="isSelectedScooterRide(ride)" class="text-xs bg-blue-600 text-white px-2 py-1 rounded-full"> Ausgewählt </span>
                    </div>
                    <span class="text-xs text-green-600 font-medium">{{ getCurrentCost(ride).toFixed(2) }}€</span>
                </div>

                <!-- Battery Usage Bar -->
                <div class="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div
                        :class="['h-2 rounded-full transition-all duration-1000', isSelectedScooterRide(ride) ? 'bg-blue-500' : 'bg-red-500']"
                        :style="{ width: `${getBatteryUsagePercentage(ride)}%` }"
                    ></div>
                </div>

                <div class="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Dauer: {{ getRideDuration(ride) }}</span>
                    <span>Akku: {{ Math.round(getBatteryUsagePercentage(ride)) }}%</span>
                </div>

                <div class="text-xs text-gray-500">
                    <span>Start: {{ formatTime(ride.startTime) }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import {
    activeRides,
    calculateBatteryUsage,
    calculateCurrentRideCost,
    calculateRideDuration,
    scooters,
    selectedScooter,
    selectScooterByRide,
} from "@/stores/scooters";
import type { ScooterRide } from "@/types/scooter";
import { onMounted, onUnmounted, ref } from "vue";

// Reactive trigger for live updates
const updateTrigger = ref(0);
let updateInterval: number | null = null;

// Force updates every second for live data
onMounted(() => {
    updateInterval = setInterval(() => {
        updateTrigger.value++;
    }, 1000) as any;
});

onUnmounted(() => {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
});

function getScooterModel(scooterId: string): string {
    const scooter = scooters.value.find((s) => s.id === scooterId);
    return scooter?.model || "Unbekannt";
}

function isSelectedScooterRide(ride: ScooterRide): boolean {
    return selectedScooter.value?.id === ride.scooterId;
}

function selectRide(ride: ScooterRide): void {
    selectScooterByRide(ride);
}

function formatTime(date: Date): string {
    return date.toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

function getCurrentCost(ride: ScooterRide): number {
    updateTrigger.value; // Trigger reactivity
    return calculateCurrentRideCost(ride);
}

function getRideDuration(ride: ScooterRide): string {
    updateTrigger.value; // Trigger reactivity
    const { minutes, seconds } = calculateRideDuration(ride);
    return `${minutes}min ${seconds}s`;
}

function getCurrentBattery(ride: ScooterRide): number {
    updateTrigger.value; // Trigger reactivity
    if (!ride.initialBatteryLevel) return 0;
    return calculateBatteryUsage(ride, ride.initialBatteryLevel);
}

function getBatteryUsagePercentage(ride: ScooterRide): number {
    updateTrigger.value; // Trigger reactivity
    if (!ride.initialBatteryLevel) return 0;
    const usedBattery = ride.initialBatteryLevel - getCurrentBattery(ride);
    return (usedBattery / ride.initialBatteryLevel) * 100;
}

function getRemainingTime(ride: any): string {
    const now = Date.now();
    const remaining = ride.estimatedEndTime.getTime() - now;

    if (remaining <= 0) return "0 min";

    const minutes = Math.ceil(remaining / (1000 * 60));
    return `${minutes} min`;
}
</script>

<style scoped>
.active-rides-scroll {
    scrollbar-width: thin;
    scrollbar-color: #cbd5e0 #f7fafc;
}

.active-rides-scroll::-webkit-scrollbar {
    width: 6px;
}

.active-rides-scroll::-webkit-scrollbar-track {
    background: #f7fafc;
    border-radius: 3px;
}

.active-rides-scroll::-webkit-scrollbar-thumb {
    background: #cbd5e0;
    border-radius: 3px;
}

.active-rides-scroll::-webkit-scrollbar-thumb:hover {
    background: #a0aec0;
}
</style>
