import { defineStore } from "pinia";
import "@/assets/leaflet.css";
import {
    activeRides,
    routeInfo,
    scooters,
    selectedScooter,
    selectScooter,
    setTargetPosition,
    targetPosition,
} from "@/stores/scooters";
import { HAMBURG_CENTER } from "@/utils/mockData";
import L from "leaflet";
import { computed, ref } from "vue";

export const useMapStore = defineStore("map", () => {
    const isFullScreen = ref(false);

    const mapElement = ref<HTMLElement | null>(null);
    const mapRef = ref<L.Map | null>(null);

    // Make all map objects reactive
    const scooterMarkers = ref<L.Marker<any>[]>([]);
    const routeLayer = ref<L.Polyline | null>(null);
    const targetMarker = ref<L.Marker | null>(null);
    const activeRideRoutes = ref<L.Polyline[]>([]);
    const activeRideTargets = ref<L.Marker<any>[]>([]) as import('vue').Ref<L.Marker<any>[]>;

    const panelScale = computed(() => (isFullScreen.value ? 1.25 : 0.85));

    const toggleFullscreen = () => {
        isFullScreen.value = !isFullScreen.value;
        setTimeout(() => {
            mapRef.value?.invalidateSize();
        }, 200);
    };

    const removeMapOnUnmounted = () => {
        if (mapRef.value) {
            mapRef.value.remove();
            mapRef.value = null;
        }
    };

    const initMap = () => {
        if (mapRef.value) {
            // Prevent double initialization
            return;
        }
        const element = mapElement.value || document.getElementById("map");
        if (!element) {
            console.error("Map element not found!");
            return;
        }
        const map = L.map(element, {
            center: HAMBURG_CENTER,
            zoom: 14,
        });
        mapRef.value = map;

        L.tileLayer(
            "https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.png",
            {
                minZoom: 0,
                maxZoom: 18,
                attribution:
                    '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.stamen.com/" target="_blank">Stamen Design</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            }
        ).addTo(map);

        map.on("click", (e) => {
            if (
                selectedScooter.value &&
                selectedScooter.value.isAvailable &&
                !selectedScooter.value.isInUse
            ) {
                setTargetPosition([e.latlng.lat, e.latlng.lng]);
            }
        });

        setTimeout(() => {
            map.invalidateSize();
        }, 200);
    };

    // --- ICONS ---
    const createScooterIcon = (
        isAvailable: boolean,
        isSelected: boolean,
        isInUse: boolean
    ) => {
        let color = "#ef4444";
        if (isInUse) color = "#f59e0b";
        else if (isAvailable) color = "#10b981";
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

    // --- MARKERS ---
    const updateScooterMarkers = () => {
        scooterMarkers.value.forEach((marker) =>
            mapRef.value?.removeLayer(marker as unknown as L.Layer)
        );
        scooterMarkers.value = [];

        scooters.value.forEach((scooter) => {
            if (
                !scooter.position ||
                scooter.position.length !== 2 ||
                isNaN(scooter.position[0]) ||
                isNaN(scooter.position[1])
            ) {
                return;
            }
            const isSelected = selectedScooter.value?.id === scooter.id;
            const icon = createScooterIcon(
                scooter.isAvailable,
                isSelected,
                scooter.isInUse
            );
            const marker = L.marker(scooter.position, { icon }).addTo(
                mapRef.value as L.Map
            );
            marker.on("click", () => {
                selectScooter(scooter);
                setTimeout(() => {
                    marker.openPopup();
                }, 100);
            });
            scooterMarkers.value.push(marker);
        });
    };

    // --- ROUTE ---
    const updateRoute = () => {
        if (routeLayer.value) {
            mapRef.value?.removeLayer(routeLayer.value as unknown as L.Layer);
            routeLayer.value = null;
        }
        if (targetMarker.value) {
            mapRef.value?.removeLayer(targetMarker.value as unknown as L.Layer);
            targetMarker.value = null;
        }
        if (routeInfo.value && selectedScooter.value && targetPosition.value) {
            routeLayer.value = L.polyline(routeInfo.value.waypoints, {
                color: "#3b82f6",
                weight: 4,
                opacity: 0.7,
            }).addTo(mapRef.value as L.Map);

            targetMarker.value = L.marker(targetPosition.value, {
                icon: createTargetIcon(),
            }).addTo(mapRef.value as L.Map);
        }
    };

    // --- ACTIVE RIDES ---
    const updateActiveRides = () => {
        activeRideRoutes.value.forEach((route) =>
            mapRef.value?.removeLayer(route as unknown as L.Layer)
        );
        activeRideTargets.value.forEach((target) =>
            mapRef.value?.removeLayer(target as L.Layer)
        );
        activeRideRoutes.value = [];
        activeRideTargets.value = [];

        activeRides.value.forEach((ride) => {
            if (ride.isActive) {
                const rideRoute = L.polyline(ride.route, {
                    color: "#f59e0b",
                    weight: 2,
                    opacity: 0.4,
                    dashArray: "5, 5",
                }).addTo(mapRef.value as L.Map);
                activeRideRoutes.value.push(rideRoute);

                const rideTarget = L.marker(ride.targetPosition, {
                    icon: createActiveRideTargetIcon(),
                }).addTo(mapRef.value as L.Map);
                activeRideTargets.value.push(rideTarget);
            }
        });
    };

    return {
        isFullScreen,
        mapElement,
        mapRef,
        scooterMarkers,
        routeLayer,
        targetMarker,
        activeRideRoutes,
        activeRideTargets,
        panelScale,
        toggleFullscreen,
        removeMapOnUnmounted,
        initMap,
        updateScooterMarkers,
        updateActiveRides,
        updateRoute,
    };
});

