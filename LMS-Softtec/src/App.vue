<template>
  <div id="app" class="h-full w-full">
    <div class="bg-[#ACCACE] absolute top-0 left-0 w-full z-10">
      <img
        src="./assets/img/ScooTec3.png"
        class="max-w-[10rem] flex shrink-1 p-1"
      />
    </div>
    <MapContainer :full="fullscreen" @update:full="fullscreen = $event" class="absolute inset-0 z-20" />
    <LoadingPanel />
    <button
      v-if="!fullscreen"
      class="absolute bottom-5 left-1/2 -translate-x-1/2 z-[3000] bg-[#ACCACE] rounded-xl w-32 h-9 cursor-pointer shadow-md transition-colors duration-200 hover:bg-gray-100"
      @click="fullscreen = true"
      title="Vollbild"
    >
      Fahrt buchen
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import LoadingPanel from "./components/LoadingPanel.vue";
import MapContainer from "./components/MapContainer.vue";

const fullscreen = ref(false);
</script>

