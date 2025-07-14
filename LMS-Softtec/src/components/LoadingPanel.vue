<template>
    <div v-if="isLoading" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div class="text-center">
                <!-- Loading Spinner -->
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>

                <!-- Current Task -->
                <h3 class="text-lg font-semibold text-gray-800 mb-2">
                    {{ currentTask }}
                </h3>

                <!-- Progress Bar -->
                <div class="w-full bg-gray-200 rounded-full h-2 mb-4">
                    <div class="bg-blue-500 h-2 rounded-full transition-all duration-300" :style="{ width: `${progress}%` }"></div>
                </div>

                <!-- Progress Text -->
                <p class="text-sm text-gray-600 mb-4">
                    {{ progressText }}
                </p>

                <!-- Detailed Status -->
                <div class="text-left space-y-2">
                    <div v-for="step in loadingSteps" :key="step.id" class="flex items-center space-x-2 text-sm">
                        <div
                            class="w-4 h-4 rounded-full flex items-center justify-center text-xs"
                            :class="{
                                'bg-green-500 text-white': step.status === 'completed',
                                'bg-blue-500 text-white animate-pulse': step.status === 'loading',
                                'bg-gray-300': step.status === 'pending',
                            }"
                        >
                            <svg v-if="step.status === 'completed'" class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                    fill-rule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clip-rule="evenodd"
                                />
                            </svg>
                            <div v-else-if="step.status === 'loading'" class="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                        <span
                            :class="{
                                'text-green-600 font-medium': step.status === 'completed',
                                'text-blue-600 font-medium': step.status === 'loading',
                                'text-gray-500': step.status === 'pending',
                            }"
                        >
                            {{ step.label }}
                        </span>
                        <span v-if="step.detail" class="text-gray-400 text-xs"> ({{ step.detail }}) </span>
                    </div>
                </div>

                <!-- Error Message -->
                <div v-if="errorMessage" class="mt-4 p-3 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
                    <strong>Fehler:</strong> {{ errorMessage }}
                </div>

                <!-- Cancel Button (optional) -->
                <button
                    v-if="showCancelButton"
                    @click="$emit('cancel')"
                    class="mt-4 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
                >
                    Abbrechen
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { loadingState } from "@/stores/loading";
import { computed } from "vue";

// Emits
const emit = defineEmits<{
    cancel: [];
}>();

// Props
const props = defineProps<{
    showCancelButton?: boolean;
}>();

// Computed properties
const isLoading = computed(() => loadingState.value.isLoading);
const currentTask = computed(() => loadingState.value.currentTask);
const progress = computed(() => loadingState.value.progress);
const progressText = computed(() => loadingState.value.progressText);
const loadingSteps = computed(() => loadingState.value.steps);
const errorMessage = computed(() => loadingState.value.errorMessage);
</script>
