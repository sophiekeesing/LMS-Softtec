<template>
    <div class="map-container relative">
        <!-- Original UI Overlays -->
        <div class="absolute top-4 right-4 z-[100]">
            <div class="bg-white rounded-lg shadow-lg p-4 max-w-sm">
                <h1 class="text-xl font-bold text-gray-800 mb-2">🛴 Scooteq</h1>
                <p class="text-sm text-gray-600">Klicken Sie auf einen verfügbaren Scooter, dann auf Ihr Ziel</p>
                <p class="text-xs text-gray-500 mt-1">🔄 Aktive Fahrten werden live angezeigt</p>

                <!-- Scooter status legend -->
                <div class="mt-3 pt-2 border-t border-gray-200">
                    <p class="text-xs font-medium text-gray-600 mb-1">Scooter Status:</p>
                    <div class="flex flex-col gap-1">
                        <div class="flex items-center gap-2">
                            <div class="w-3 h-3 rounded-full bg-green-500"></div>
                            <span class="text-xs text-gray-600">Verfügbar</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <div class="w-3 h-3 rounded-full bg-orange-500"></div>
                            <span class="text-xs text-gray-600">In Benutzung</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <div class="w-3 h-3 rounded-full bg-red-500"></div>
                            <span class="text-xs text-gray-600">Deaktiviert</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- External Component Panels -->
        <div class="absolute top-24 left-4 z-[100] space-y-4">
            <ScooterInfoPanel />
            <RouteInfoPanel />
            <ActiveRidesPanel />
        </div>

        <!-- Map Container -->
        <div id="map" class="absolute top-0 left-0 right-0 bottom-0" ref="mapElement"></div>
    </div>
</template>

<script setup lang="ts">
import "@/assets/leaflet.css";
import ActiveRidesPanel from "@/components/ActiveRidesPanel.vue";
import RouteInfoPanel from "@/components/RouteInfoPanel.vue";
import ScooterInfoPanel from "@/components/ScooterInfoPanel.vue";
import {
    activeRides,
    initializeScooters,
    routeInfo,
    scooters,
    selectedScooter,
    selectScooter,
    setTargetPosition,
    targetPosition,
} from "@/stores/scooters";
import { HAMBURG_CENTER } from "@/utils/mockData";
import L from "leaflet";
import { onMounted, onUnmounted, ref, watch } from "vue";

// Fix Leaflet's default icon path issues with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const mapElement = ref<HTMLElement | null>(null);
const mapRef = ref<L.Map | null>(null);

let map: L.Map | null = null;
let scooterMarkers: L.Marker[] = [];
let routeLayer: L.Polyline | null = null;
let targetMarker: L.Marker | null = null;
let activeRideRoutes: L.Polyline[] = [];
let activeRideTargets: L.Marker[] = [];

// Custom icons
const createScooterIcon = (isAvailable: boolean, isSelected: boolean, isInUse: boolean) => {
    let color = "#ef4444"; // red - unavailable
    if (isInUse) color = "#f59e0b"; // orange - in use
    else if (isAvailable) color = "#10b981"; // green - available

    const iconHtml = `
    <div style="
      background-color: ${color};
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 3px solid ${isSelected ? "#1f2937" : "white"};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    ">
      🛴
    </div>
  `;

    return L.divIcon({
        html: iconHtml,
        className: "custom-scooter-icon",
        iconSize: [30, 30],
        iconAnchor: [15, 15],
    });
};

const createTargetIcon = () => {
    const iconHtml = `
    <div style="
      background-color: #dc2626;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    ">
      📍
    </div>
  `;

    return L.divIcon({
        html: iconHtml,
        className: "custom-target-icon",
        iconSize: [24, 24],
        iconAnchor: [12, 12],
    });
};

const createActiveRideTargetIcon = () => {
    const iconHtml = `
    <div style="
      background-color: #f59e0b;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 2px solid white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    ">
      🎯
    </div>
  `;

    return L.divIcon({
        html: iconHtml,
        className: "custom-active-ride-target-icon",
        iconSize: [20, 20],
        iconAnchor: [10, 10],
    });
};

function initMap() {
    try {
        // Check if map element exists
        const element = mapElement.value || document.getElementById("map");
        if (!element) {
            console.error("Map element not found!");
            return;
        }

        console.log("Map element found:", element);

        // Initialize map with free movement
        map = L.map(element, {
            center: HAMBURG_CENTER,
            zoom: 14,
            // Removed maxBounds to allow free navigation
        });
        mapRef.value = map;
        console.log("Map initialized at:", HAMBURG_CENTER);

        // Add tile layer
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "© OpenStreetMap contributors",
            maxZoom: 19,
        }).addTo(map);

        console.log("Tile layer added");

        // Add map click handler for setting target
        map.on("click", (e) => {
            console.log("Map clicked", e.latlng);
            if (selectedScooter.value && selectedScooter.value.isAvailable && !selectedScooter.value.isInUse) {
                console.log("Selected scooter is available, setting target position");
                setTargetPosition([e.latlng.lat, e.latlng.lng]);
            } else if (selectedScooter.value?.isInUse) {
                console.log("Scooter is in use, cannot set target");
            } else {
                console.log("No available scooter selected");
            }
        });

        console.log("Map click handler added");

        // Force map to invalidate size after a short delay
        setTimeout(() => {
            if (map) {
                map.invalidateSize();
                console.log("Map size invalidated");
            }
        }, 200);
    } catch (error) {
        console.error("Error initializing map:", error);
    }
}

function updateScooterMarkers() {
    // Clear existing markers
    scooterMarkers.forEach((marker) => map?.removeLayer(marker));
    scooterMarkers = [];

    // Add scooter markers
    scooters.value.forEach((scooter) => {
        // Validate position
        if (!scooter.position || scooter.position.length !== 2 || isNaN(scooter.position[0]) || isNaN(scooter.position[1])) {
            console.warn(`Invalid position for scooter ${scooter.id}:`, scooter.position);
            return; // Skip this scooter
        }

        const isSelected = selectedScooter.value?.id === scooter.id;
        const icon = createScooterIcon(scooter.isAvailable, isSelected, scooter.isInUse);

        try {
            const marker = L.marker(scooter.position, { icon }).addTo(map!);

            // Add click handler
            marker.on("click", () => {
                // Allow selection of any scooter (available or in use)
                selectScooter(scooter);

                // Automatically open popup when scooter is selected
                setTimeout(() => {
                    marker.openPopup();
                }, 100);
            });

            scooterMarkers.push(marker);
        } catch (error) {
            console.error(`Failed to create marker for scooter ${scooter.id}:`, error);
        }
    });
}

function updateRoute() {
    // Clear existing route
    if (routeLayer) {
        map?.removeLayer(routeLayer);
        routeLayer = null;
    }

    if (targetMarker) {
        map?.removeLayer(targetMarker);
        targetMarker = null;
    }

    if (routeInfo.value && selectedScooter.value && targetPosition.value) {
        // Add route line
        routeLayer = L.polyline(routeInfo.value.waypoints, {
            color: "#3b82f6",
            weight: 4,
            opacity: 0.7,
        }).addTo(map!);

        // Add target marker
        targetMarker = L.marker(targetPosition.value, { icon: createTargetIcon() }).addTo(map!);
    }
}

function updateActiveRides() {
    // Clear existing active ride routes and targets
    activeRideRoutes.forEach((route) => map?.removeLayer(route));
    activeRideTargets.forEach((target) => map?.removeLayer(target));
    activeRideRoutes = [];
    activeRideTargets = [];

    // Add routes for all active rides
    activeRides.value.forEach((ride) => {
        if (ride.isActive) {
            // Add route line using all waypoints from the real route
            const rideRoute = L.polyline(ride.route, {
                color: "#f59e0b", // orange color for active rides
                weight: 2,
                opacity: 0.4,
                dashArray: "5, 5", // dashed line
            }).addTo(map!);
            activeRideRoutes.push(rideRoute);

            // Add target marker for active ride
            const rideTarget = L.marker(ride.targetPosition, {
                icon: createActiveRideTargetIcon(),
            }).addTo(map!);
            activeRideTargets.push(rideTarget);
        }
    });
}

onMounted(() => {
    console.log("MapContainer mounted");

    // Use multiple attempts to ensure DOM is fully rendered
    setTimeout(async () => {
        console.log("First attempt to initialize map...");
        initMap();
        await initializeScooters();
        updateScooterMarkers();
        updateActiveRides();
        console.log("Map initialization complete");
    }, 100);

    // Backup attempt after more time
    setTimeout(async () => {
        if (!map) {
            console.log("Second attempt to initialize map...");
            initMap();
            await initializeScooters();
            updateScooterMarkers();
            updateActiveRides();
        }
    }, 500);
});

onUnmounted(() => {
    if (map) {
        map.remove();
    }
});

// Watch for changes and update markers
watch(scooters, updateScooterMarkers, { deep: true });
watch(selectedScooter, updateScooterMarkers);
watch(routeInfo, updateRoute);
watch(targetPosition, updateRoute);
watch(activeRides, updateActiveRides, { deep: true });
</script>

<style>
.map-container {
    position: relative;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
}

#map {
    width: 100% !important;
    height: 100% !important;
    z-index: 0;
}

.custom-scooter-icon,
.custom-target-icon,
.custom-active-ride-target-icon {
    background: none !important;
    border: none !important;
}

/* Fix for leaflet tiles not loading properly */
.leaflet-container {
    width: 100% !important;
    height: 100% !important;
    background: #e5e7eb;
}

/* Ensure map tiles load */
.leaflet-tile {
    max-width: none !important;
}

/* FIX: Ensure popups are above everything else */
.leaflet-popup-pane {
    z-index: 1000 !important;
}

.leaflet-popup {
    z-index: 1001 !important;
}

.leaflet-popup-content-wrapper {
    z-index: 1002 !important;
    border-radius: 8px !important;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2) !important;
}

.leaflet-popup-content {
    margin: 8px 12px !important;
    font-family: system-ui, -apple-system, sans-serif !important;
    z-index: 1003 !important;
}

.leaflet-popup-tip {
    z-index: 1001 !important;
}

/* Ensure popup close button is visible */
.leaflet-popup-close-button {
    z-index: 1004 !important;
    color: #374151 !important;
    font-weight: bold !important;
}

.leaflet-popup-close-button:hover {
    color: #111827 !important;
}

/* Custom popup positioning */
.custom-popup .leaflet-popup-content-wrapper {
    max-width: 250px !important;
    min-width: 200px !important;
}

.custom-popup .leaflet-popup-tip-container {
    margin-top: -1px !important;
}

/* Force popups to stay in view */
.leaflet-popup {
    margin-bottom: 20px !important;
}
</style>
