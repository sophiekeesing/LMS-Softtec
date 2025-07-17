<template>
  <div
    :class="[
      isFullScreen
        ? 'fixed inset-0 w-screen h-screen rounded-none shadow-none z-[10000] cursor-default'
        : 'fixed left-1/2 top-1/2 w-[50vw] h-[50vh] rounded-2xl shadow-2xl z-10 cursor-pointer -translate-x-1/2 -translate-y-1/2',
      'bg-white overflow-hidden transition-all duration-300 ease-[cubic-bezier(.4,2,.6,1)]'
    ]"
    @click.self="toggleFullscreen"
  >
    <OverviewPanel :is-full-screen="isFullScreen"/>
    <!-- External Component Panels -->
    <div
      class="absolute left-1 right-1 top-20 sm:top-24 sm:left-4 sm:right-auto z-[100] space-y-2 sm:space-y-4 transition-transform duration-300 ease-[cubic-bezier(.4,2,.6,1)]"
      :style="{
        transform: `scale(${panelScale})`,
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
      v-if="!isFullScreen"
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
      v-if="!isFullScreen"
      class="absolute bottom-5 right-5  z-[3000] font-bold bg-white rounded-xl w-32 h-9 cursor-pointer shadow-md transition-colors duration-200 hover:bg-gray-100"
      @click="toggleFullscreen"
      title="Vollbild"
    >
      Karte öffnen
    </button>

    <!-- Collapse Button (only when fullscreen) -->
    <button
      v-if="isFullScreen"
      class="absolute top-4 right-4 z-[2000] font-bold bg-white border-none rounded-full w-9 h-9 text-xl cursor-pointer shadow-md transition-colors duration-200 hover:bg-gray-100"
      @click.stop="toggleFullscreen"
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
import { computed, defineEmits, defineProps, ref, watch, onMounted, onUnmounted } from "vue";
import OverviewPanel from "@/components/OverviewPanel.vue";

const isFullScreen = ref<boolean>(false);

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

const mapElement = ref<HTMLElement | null>(null);
const mapRef = ref<L.Map | null>(null);

let map: L.Map | null = null;
let scooterMarkers: L.Marker[] = [];
let routeLayer: L.Polyline | null = null;
let targetMarker: L.Marker | null = null;
let activeRideRoutes: L.Polyline[] = [];
let activeRideTargets: L.Marker[] = [];

// Custom icons
const createScooterIcon = (
  isAvailable: boolean,
  isSelected: boolean,
  isInUse: boolean
) => {
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
    L.tileLayer("https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.png", {
            minZoom: 0,
            maxZoom: 18,
            attribution:
                '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.stamen.com/" target="_blank">Stamen Design</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

    console.log("Tile layer added");

    // Add map click handler for setting target
    map.on("click", (e) => {
      console.log("Map clicked", e.latlng);
      if (
        selectedScooter.value &&
        selectedScooter.value.isAvailable &&
        !selectedScooter.value.isInUse
      ) {
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
    if (
      !scooter.position ||
      scooter.position.length !== 2 ||
      isNaN(scooter.position[0]) ||
      isNaN(scooter.position[1])
    ) {
      console.warn(
        `Invalid position for scooter ${scooter.id}:`,
        scooter.position
      );
      return; // Skip this scooter
    }

    const isSelected = selectedScooter.value?.id === scooter.id;
    const icon = createScooterIcon(
      scooter.isAvailable,
      isSelected,
      scooter.isInUse
    );

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
      console.error(
        `Failed to create marker for scooter ${scooter.id}:`,
        error
      );
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
    targetMarker = L.marker(targetPosition.value, {
      icon: createTargetIcon(),
    }).addTo(map!);
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
const panelScale = computed(() => (isFullScreen.value ? 1.25 : 0.85));

function toggleFullscreen() {
  isFullScreen.value = !isFullScreen.value
  setTimeout(() => {
    if (mapRef.value) mapRef.value.invalidateSize();
  }, 200);
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

