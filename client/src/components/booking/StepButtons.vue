<!-- "Terug" and "Verder" at the bottom of every booking step: back on the left, next on the right. -->
<script setup>
import AppIcon from '../ui/AppIcon.vue';

defineProps({
  /** "Verder" stays disabled until the step has a valid choice. */
  canContinue: { type: Boolean, default: true },
});
defineEmits(['back', 'next']);
</script>

<template>
  <div class="btn-row btn-row--split">
    <button type="button" class="btn btn--secondary" @click="$emit('back')"><AppIcon name="chevron-left" /> Terug</button>
    <button type="button" class="btn" :disabled="!canContinue" @click="$emit('next')">Verder <AppIcon name="chevron-right" /></button>
  </div>
</template>
