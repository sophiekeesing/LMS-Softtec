<template>
  <header class="inline-flex h-16 bg-green-800 w-full">
    <img
      alt="LMS-Softtec logo"
      class="w-[50px] h-[50px] m-1.5"
      src="./assets/logo.png"
    />
    <nav class="items-center ml-8 inline-flex">
      <ul class="inline-flex space-x-5">
        <li class="underline text-white">
          <a href="#/">Home</a>
        </li>
        <li class="underline text-white">
          <a href="#/calculator">Calculator</a>
        </li>
      </ul>
    </nav>
  </header>

  <main>
    <component :is="currentView" />
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import Calculator from "./components/Calculator.vue";
import Home from "./components/Home.vue";
import type { Component } from "vue";

const routes: Record<string, Component> = {
  "#/": Home,
  "#/calculator": Calculator,
};

const currentPath = ref(window.location.hash || "#/");

window.addEventListener("hashchange", () => {
  currentPath.value = window.location.hash || "#/";
});

const currentView = computed(() => {
  return routes[currentPath.value] || Home;
});
</script>
