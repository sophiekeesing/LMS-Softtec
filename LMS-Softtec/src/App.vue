<template>
  <div id="app">
    <div class="bg-[#ACCACE] absolute top-0 left-0 w-full z-10">
      <img
        src="./assets/img/ScooTec3.png"
        class="max-w-[10rem] flex shrink-1 p-1"
      />
    </div>
    <MapContainer class="absolute inset-0 z-20" />
    <LoadingPanel />
  </div>
</template>

<script setup lang="ts">
import LoadingPanel from "./components/LoadingPanel.vue";
import MapContainer from "./components/MapContainer.vue";
</script>

