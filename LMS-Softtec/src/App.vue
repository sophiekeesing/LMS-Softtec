<template>
    <div id="app">
        <MapContainer />
        <LoadingPanel />
    </div>
</template>

<script setup lang="ts">
import LoadingPanel from "./components/LoadingPanel.vue";
import MapContainer from "./components/MapContainer.vue";
</script>

<style>
html,
body,
#app {
    margin: 0;
    padding: 0;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
}

* {
    box-sizing: border-box;
}

/* Additional Leaflet fixes */
.leaflet-control-container {
    font-family: "Helvetica Neue", Arial, Helvetica, sans-serif;
}

/* GLOBAL FIX: Ensure all Leaflet popups are above everything */
.leaflet-popup-pane {
    z-index: 9999 !important;
}

.leaflet-popup {
    z-index: 10000 !important;
}

.leaflet-popup-content-wrapper {
    z-index: 10001 !important;
}

.leaflet-popup-content {
    z-index: 10002 !important;
}

.leaflet-popup-tip {
    z-index: 10000 !important;
}

.leaflet-popup-close-button {
    z-index: 10003 !important;
}
</style>
