<!--
  One spot on the "Plekken" page: name, status (colour + icon + text) and one button.
  It is the same button for "Zet uit…" and "Zet aan", so keyboard focus stays on it after the change.
-->
<script setup>
import AppIcon from '../ui/AppIcon.vue';
import { statusClass, statusIcon, statusText } from './spot-status.js';

defineProps({
  /** { id, name, status, isAvailable, reservedBy, unavailableReason } */
  spot: { type: Object, required: true },
});
const emit = defineEmits(['turn-off', 'turn-on']);
</script>

<template>
  <li :class="['spot-tile', `spot-tile--${statusClass(spot.status)}`]" :title="statusText(spot)">
    <span class="spot-tile__name">{{ spot.name }}</span>
    <span class="spot-tile__status"><AppIcon :name="statusIcon(spot.status)" /> {{ statusText(spot) }}</span>
    <button
      type="button"
      class="btn btn--secondary btn--small spot-tile__action"
      :aria-label="`${spot.isAvailable ? 'Zet uit' : 'Zet aan'}: plek ${spot.name}`"
      @click="emit(spot.isAvailable ? 'turn-off' : 'turn-on')"
    >{{ spot.isAvailable ? 'Zet uit…' : 'Zet aan' }}</button>
  </li>
</template>
