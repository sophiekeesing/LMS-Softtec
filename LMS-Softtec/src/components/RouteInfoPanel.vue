<template>
    <div v-if="routeInfo && selectedScooter && targetPosition" class="bg-white rounded-lg shadow-lg p-3 sm:p-4 max-w-xs sm:max-w-sm text-xs sm:text-sm md:text-base">
        <h2 class="text-lg font-bold text-gray-800 mb-3">Route berechnet</h2>

        <div class="space-y-2 mb-4">
            <div class="flex justify-between">
                <span class="text-gray-600">Entfernung:</span>
                <span class="font-medium">{{ (routeInfo.distance / 1000).toFixed(2) }} km</span>
            </div>

            <div class="flex justify-between">
                <span class="text-gray-600">Geschätzte Dauer:</span>
                <span class="font-medium">{{ routeInfo.duration }} min</span>
            </div>

            <div class="flex justify-between">
                <span class="text-gray-600">Geschätzte Kosten:</span>
                <span class="font-medium text-lg text-blue-600">{{ routeInfo.cost.toFixed(2) }}€</span>
            </div>
        </div>

        <div class="flex space-x-2">
            <button
                @click="startRide"
                :disabled="isCalculatingRoute"
                class="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
                <span v-if="isCalculatingRoute">Berechne...</span>
                <span v-else>🚀 Fahrt starten</span>
            </button>

            <button @click="clearSelection" class="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50">Abbrechen</button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { clearSelection, isCalculatingRoute, routeInfo, selectedScooter, startRide as startScooterRide, targetPosition } from "@/stores/scooters";
import { watch } from "vue";

// Debug watchers
watch(routeInfo, (newValue) => {
    console.log("RouteInfo changed:", newValue);
});

watch(selectedScooter, (newValue) => {
    console.log("SelectedScooter changed:", newValue?.id);
});

watch(targetPosition, (newValue) => {
    console.log("TargetPosition changed:", newValue);
});

function startRide() {
    const rideId = startScooterRide();
    if (rideId) {
        console.log(`Fahrt gestartet: ${rideId}`);
    }
}
</script>
