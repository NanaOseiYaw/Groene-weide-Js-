<!--
  Draws the map of one field: hedge, grass, the spots and the path.
  It only draws. SpotPicker.vue works out which spots are free and opens the pop-up.
-->
<script setup>
import AppIcon from '../ui/AppIcon.vue';
import FieldSign from '../ui/FieldSign.vue';

defineProps({
  /** One field from field-map.js */
  field: { type: Object, required: true },
  /** [{ name, status, id }], status is 'free', 'taken' or 'chosen' */
  spots: { type: Array, required: true },
});
const emit = defineEmits(['spot-click']);

// An icon and a word for each status, so nobody has to rely on colour.
const STATUS = {
  free: { icon: 'check', text: 'vrij' },
  taken: { icon: 'x', text: 'bezet' },
  chosen: { icon: 'star', text: 'gekozen' },
};
</script>

<template>
  <div class="field-map">
    <div class="field-map__hedge">
      <FieldSign class="field-map__sign" :name="field.name" :icon-name="field.icon" />

      <!-- --columns tells the CSS how many spots go in one row -->
      <ul class="field-map__meadow" :style="{ '--columns': field.columns }" :aria-label="`Plekken op het ${field.name}`">
        <li v-for="spot in spots" :key="spot.name" class="field-map__place">
          <!-- A real button, so it also works with a keyboard and a screen reader -->
          <button
            v-if="spot.status !== 'taken'"
            type="button"
            :class="['field-map__pitch', `field-map__pitch--${spot.status}`]"
            @click="emit('spot-click', spot.id)"
          >
            <AppIcon :name="field.icon" />
            <span :class="['spot-marker', `spot-marker--${spot.status}`]">
              <AppIcon :name="STATUS[spot.status].icon" />{{ spot.name }}<span class="visually-hidden">, {{ STATUS[spot.status].text }}</span>
            </span>
          </button>

          <!-- Taken: looks the same, but you can't click it -->
          <span v-else class="field-map__pitch field-map__pitch--taken">
            <AppIcon :name="field.icon" />
            <span class="spot-marker spot-marker--taken">
              <AppIcon :name="STATUS.taken.icon" />{{ spot.name }}<span class="visually-hidden">, {{ STATUS.taken.text }}</span>
            </span>
          </span>
        </li>
      </ul>
    </div>

    <!-- Tells guests where the field is on the campsite -->
    <p class="field-map__path"><AppIcon name="location" /> Pad naar {{ field.nearby }}</p>
  </div>
</template>
