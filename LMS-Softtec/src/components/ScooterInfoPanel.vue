<template>
    <div v-if="selectedScooter" class="bg-white rounded-lg shadow-lg p-4 max-w-sm">
        <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg font-bold text-gray-800">
                {{ selectedScooter.isInUse ? "Scooter in Benutzung" : "Ausgewählter Scooter" }}
            </h2>
            <button @click="clearSelection" class="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        <div class="space-y-2">
            <div class="flex justify-between">
                <span class="text-gray-600">Modell:</span>
                <span class="font-medium">{{ selectedScooter.model }}</span>
            </div>

            <div class="flex justify-between">
                <span class="text-gray-600">Batterie:</span>
                <span class="font-medium" :class="batteryColor"> {{ selectedScooter.batteryLevel }}% </span>
            </div>

            <div class="flex justify-between">
                <span class="text-gray-600">Preis:</span>
                <span class="font-medium">{{ selectedScooter.pricePerMinute.toFixed(2) }}€/min</span>
            </div>

            <!-- Show active ride info if scooter is in use -->
            <div v-if="selectedScooter.isInUse" class="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                <h3 class="text-sm font-semibold text-orange-800 mb-2">🚀 Scooter in Fahrt</h3>
                <p class="text-sm text-orange-700">Dieser Scooter ist aktuell unterwegs. Schauen Sie im Aktive Fahrten Panel für Details.</p>
            </div>

            <!-- Show route selection hint for available scooters -->
            <div v-else-if="selectedScooter.isAvailable && !selectedScooter.isInUse" class="mt-3 p-2 bg-blue-50 rounded">
                <p class="text-sm text-blue-700">👆 Klicken Sie auf die Karte, um Ihr Ziel auszuwählen</p>
            </div>

            <!-- Show deactivated message for deactivated scooters -->
            <div v-else-if="!selectedScooter.isAvailable && !selectedScooter.isInUse" class="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <h3 class="text-sm font-semibold text-gray-800 mb-2">⚠️ Scooter deaktiviert</h3>
                <div class="space-y-2 text-sm text-gray-700">
                    <p>Dieser Scooter ist derzeit nicht verfügbar. Mögliche Gründe:</p>
                    <ul class="list-disc list-inside space-y-1 text-xs text-gray-600">
                        <li v-if="selectedScooter.batteryLevel < 20">Niedriger Batteriestand ({{ selectedScooter.batteryLevel }}%)</li>
                        <li v-else>Wartung oder technische Probleme</li>
                        <li>Außerhalb des Servicegebiets</li>
                        <li>Wird gerade aufgeladen oder gewartet</li>
                    </ul>
                    <p class="text-xs text-gray-500 mt-2">
                        <span v-if="selectedScooter.lastUsed"> Zuletzt verwendet: {{ formatLastUsed(selectedScooter.lastUsed) }} </span>
                        <span v-else>Noch nie verwendet</span>
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { clearSelection, selectedScooter } from "@/stores/scooters";
import { computed } from "vue";

const batteryColor = computed(() => {
    if (!selectedScooter.value) return "";
    const battery = selectedScooter.value.batteryLevel;
    if (battery >= 70) return "text-green-600";
    if (battery >= 30) return "text-yellow-600";
    return "text-red-600";
});

const formatLastUsed = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
        return `vor ${diffDays} Tag${diffDays === 1 ? "" : "en"}`;
    } else if (diffHours > 0) {
        return `vor ${diffHours} Stunde${diffHours === 1 ? "" : "n"}`;
    } else {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return `vor ${diffMinutes} Minute${diffMinutes === 1 ? "" : "n"}`;
    }
};
</script>
