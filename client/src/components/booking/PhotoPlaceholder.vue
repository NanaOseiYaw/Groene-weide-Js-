<!--
  Placeholder for a spot without a real photo yet. Guests must see what they book, so we never show an
  illustration here. Staff replace it by uploading a real photo of the spot (/admin/photos).
  A <span>, so it may sit inside the spot-card button. Port of PhotoPlaceholder.razor.
-->
<script setup>
import AppIcon from '../ui/AppIcon.vue';

defineProps({
  /** Small version for the cards in the spot list. */
  compact: { type: Boolean, default: false },
  /** Hide from screen readers when the surrounding element already says "Foto volgt". */
  decorative: { type: Boolean, default: false },
});
</script>

<template>
  <span :class="['photo-placeholder', { 'photo-placeholder--compact': compact }]" :aria-hidden="decorative ? 'true' : undefined">
    <AppIcon name="photo" />
    <span class="photo-placeholder__title">Foto volgt</span>
    <span v-if="!compact" class="photo-placeholder__text">Van deze plek hebben we nog geen foto. Bel ons gerust als je wilt weten hoe hij eruitziet.</span>
  </span>
</template>
