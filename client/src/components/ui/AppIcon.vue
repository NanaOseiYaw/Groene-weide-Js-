<!--
  Inline SVG icon. Usage: <AppIcon name="check" />.
  Icons are hidden from screen readers: always put text next to them.
  Only when there is no text next to it, pass `label`; a screen reader then reads that instead.
-->
<script setup>
import { computed } from 'vue';
import { ICON_PATHS } from './icons.js';

const props = defineProps({
  /** Name of the icon, see icons.js. */
  name: { type: String, required: true },
  /** Screen reader text. Only when there is no visible text next to the icon. */
  label: { type: String, default: null },
});

const paths = computed(() => ICON_PATHS[props.name] ?? ICON_PATHS.info);
</script>

<template>
  <!-- v-html is safe here: the paths are constants from icons.js, never user input. -->
  <svg
    class="icon"
    viewBox="0 0 24 24"
    focusable="false"
    :aria-hidden="label ? undefined : 'true'"
    :role="label ? 'img' : undefined"
    :aria-label="label ?? undefined"
    v-html="paths"
  />
</template>
