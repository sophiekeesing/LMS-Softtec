<template>
<!-- Original UI Overlays -->
    <div class="absolute top-4 right-4 z-[100]" :class="[props.isFullScreen ? 'right-18' : 'right-4']">
      <div class="bg-white rounded-lg shadow-lg p-4 max-w-xs">
        <h1 class="text-xl font-bold text-gray-800 mb-2">🛴 ScooTeq</h1>
        <p class="text-sm text-gray-600">
          Klicken Sie auf einen verfügbaren Scooter, dann auf Ihr Ziel
        </p>
        <p class="text-xs text-gray-500 mt-1">
          🔄 Aktive Fahrten werden live angezeigt
        </p>

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
</template>

<script setup lang="ts">

const props = defineProps({
  isFullScreen: Boolean
});

</script>