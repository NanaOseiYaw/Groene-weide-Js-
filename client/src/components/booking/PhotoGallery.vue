<!--
  Photos of one spot: swipe on a phone (CSS scroll-snap), or use the buttons; a counter says
  "Foto 2 van 5". Port of initGallery() in dialog.js.
-->
<script setup>
import { computed, ref } from 'vue';
import AppIcon from '../ui/AppIcon.vue';

const props = defineProps({
  photos: { type: Array, required: true }, // [{ id, url, altText }]
  spotName: { type: String, required: true },
});

const track = ref(null);
const index = ref(0);
const counter = computed(() => `Foto ${index.value + 1} van ${props.photos.length}`);

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function go(target) {
  index.value = Math.max(0, Math.min(props.photos.length - 1, target));
  track.value.scrollTo({ left: index.value * track.value.clientWidth, behavior: reduceMotion() ? 'auto' : 'smooth' });
}

/** After swiping: update the counter. */
function onScroll() {
  const shown = Math.round(track.value.scrollLeft / track.value.clientWidth);
  if (shown !== index.value) index.value = shown;
}
</script>

<template>
  <div class="gallery" role="group" aria-roledescription="fotogalerij" :aria-label="`Foto's van plek ${spotName}`">
    <div ref="track" class="gallery__track" tabindex="0" role="group" aria-label="Foto's, swipe of gebruik de knoppen" @scroll.passive="onScroll">
      <img v-for="photo in photos" :key="photo.id" class="gallery__photo" :src="photo.url" :alt="photo.altText" loading="lazy" width="800" height="500" />
    </div>
    <div v-if="photos.length > 1" class="gallery__controls">
      <button type="button" class="btn btn--secondary btn--small" :disabled="index === 0" @click="go(index - 1)"><AppIcon name="chevron-left" /> Vorige</button>
      <span class="gallery__counter" aria-live="polite">{{ counter }}</span>
      <button type="button" class="btn btn--secondary btn--small" :disabled="index === photos.length - 1" @click="go(index + 1)">Volgende <AppIcon name="chevron-right" /></button>
    </div>
  </div>
</template>
