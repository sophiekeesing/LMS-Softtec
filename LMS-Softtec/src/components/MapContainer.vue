<template>
    <div
        :class="[
            mapStore.isFullScreen
                ? 'fixed inset-0 w-screen h-screen rounded-none shadow-none z-[10000] cursor-default'
                : 'fixed left-1/2 top-1/2 w-[50vw] h-[50vh] rounded-2xl shadow-2xl z-10 cursor-pointer -translate-x-1/2 -translate-y-1/2',
            'bg-white overflow-hidden transition-all duration-300 ease-[cubic-bezier(.4,2,.6,1)]',
        ]"
        @click.self="mapStore.toggleFullscreen"
    >
        <OverviewPanel :is-full-screen="mapStore.isFullScreen" />
        <!-- External Component Panels -->
        <div
            class="absolute left-1 right-1 top-20 sm:top-24 sm:left-4 sm:right-auto z-[100] space-y-2 sm:space-y-4 transition-transform duration-300 ease-[cubic-bezier(.4,2,.6,1)]"
            :style="{
                transform: `scale(${mapStore.panelScale})`,
                transformOrigin: 'top left',
            }"
            @click.stop
        >
            <ScooterInfoPanel />
            <RouteInfoPanel />
            <ActiveRidesPanel />
        </div>

        <!-- Non-clickable overlay (only when not fullscreen) -->
        <div
            v-if="!mapStore.isFullScreen"
            class="absolute inset-0 w-full h-full z-[1001] bg-transparent"
            style="pointer-events: all"
        ></div>

        <!-- Map Container -->
        <div
            id="map"
            class="absolute inset-0 w-full h-full z-0"
            ref="mapElement"
        ></div>

        <!-- Expand Button (only when not fullscreen) -->
        <button
            v-if="!mapStore.isFullScreen"
            class="absolute bottom-5 right-5 z-[3000] font-bold bg-white rounded-xl w-32 h-9 cursor-pointer shadow-md transition-colors duration-200 hover:bg-gray-100"
            @click="mapStore.toggleFullscreen"
            title="Vollbild"
        >
            Karte öffnen
        </button>

        <!-- Collapse Button (only when fullscreen) -->
        <button
            v-if="mapStore.isFullScreen"
            class="absolute top-4 right-4 z-[2000] font-bold bg-white border-none rounded-full w-9 h-9 text-xl cursor-pointer shadow-md transition-colors duration-200 hover:bg-gray-100"
            @click.stop="mapStore.toggleFullscreen"
            title="Zurück"
        >
            ⤫
        </button>
    </div>
</template>

<script setup lang="ts">
import "@/assets/leaflet.css";
import ActiveRidesPanel from "@/components/ActiveRidesPanel.vue";
import RouteInfoPanel from "@/components/RouteInfoPanel.vue";
import ScooterInfoPanel from "@/components/ScooterInfoPanel.vue";
import {
    initializeScooters,
    routeInfo,
    scooters,
    selectedScooter,
    activeRides,
    targetPosition,
} from "@/stores/scooters";
import L from "leaflet";
import { watch, onMounted, onUnmounted } from "vue";
import OverviewPanel from "@/components/OverviewPanel.vue";
import { useMapStore } from "@/stores/mapStore";

const mapStore = useMapStore();

// Fix Leaflet's default icon path issues with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

let map: L.Map | null = null;
onMounted(() => {
    console.log("MapContainer mounted");

    // Use multiple attempts to ensure DOM is fully rendered
    setTimeout(async () => {
        console.log("First attempt to initialize map...");
        mapStore.initMap();
        await initializeScooters();
        mapStore.updateScooterMarkers();
        mapStore.updateActiveRides();
        console.log("Map initialization complete");
    }, 100);

    // Backup attempt after more time
    setTimeout(async () => {
        if (map) {
            console.log("Second attempt to initialize map...");
            mapStore.initMap();
            await initializeScooters();
            mapStore.updateScooterMarkers();
            mapStore.updateActiveRides();
        }
    }, 500);
});

onUnmounted(() => {
    mapStore.removeMapOnUnmounted();
});

// Watch for changes and update markers
watch(scooters, mapStore.updateScooterMarkers, { deep: true });
watch(selectedScooter, mapStore.updateScooterMarkers);
watch(routeInfo, mapStore.updateRoute);
watch(targetPosition, mapStore.updateRoute);
watch(activeRides, mapStore.updateActiveRides, { deep: true });
</script>

