<!--
  Pop-up with photos and details of a spot (Feature 4), on the native <dialog> element. Port of SpotDialog.razor.
  Close with the ✕ button, the Esc key or by clicking outside the pop-up. On a phone it fills the screen.
-->
<script setup>
import { ref } from 'vue';
import { euro, formatNights } from '@groene-weide/shared/format';
import { useNativeDialog } from '../../composables/useNativeDialog.js';
import AlertBox from '../ui/AlertBox.vue';
import AppIcon from '../ui/AppIcon.vue';
import { iconForAmenity } from '../ui/icons.js';
import PhotoGallery from './PhotoGallery.vue';
import PhotoPlaceholder from './PhotoPlaceholder.vue';

defineProps({
  /** The spot that is shown (GET /api/spots/:id), or null. */
  spot: { type: Object, default: null },
  /** Error message inside the pop-up. */
  error: { type: String, default: null },
  /** "Kies deze plek" is being checked on the server. */
  busy: { type: Boolean, default: false },
});
const emit = defineEmits(['choose', 'closed']);

const dialog = ref(null);
const { isOpen, open, close, onClose, onClick } = useNativeDialog(dialog, () => emit('closed'));

defineExpose({ open, close });
</script>

<template>
  <dialog ref="dialog" class="spot-dialog" aria-labelledby="spot-dialog-title" @close="onClose" @click="onClick">
    <div v-if="isOpen && spot" class="spot-dialog__content">
      <div class="spot-dialog__header">
        <h2 id="spot-dialog-title">Plek {{ spot.name }}</h2>
        <button type="button" class="btn btn--secondary spot-dialog__close" @click="close">
          <AppIcon name="x" /><span class="visually-hidden">Sluit de pop-up</span>
        </button>
      </div>

      <PhotoGallery v-if="spot.photos.length > 0" :key="spot.id" :photos="spot.photos" :spot-name="spot.name" />
      <PhotoPlaceholder v-else />

      <p v-if="spot.description">{{ spot.description }}</p>

      <dl class="facts">
        <div class="facts__item"><AppIcon name="people" /><dt>Personen</dt><dd>maximaal {{ spot.capacity }}</dd></div>
        <div class="facts__item"><AppIcon name="field" /><dt>Veld</dt><dd>{{ spot.fieldName }}</dd></div>
        <div v-if="spot.distanceToiletM !== null" class="facts__item"><AppIcon name="toilet" /><dt>Wc</dt><dd>{{ spot.distanceToiletM }} meter lopen</dd></div>
        <div v-if="spot.distancePoolM !== null" class="facts__item"><AppIcon name="pool" /><dt>Zwembad</dt><dd>{{ spot.distancePoolM }} meter lopen</dd></div>
      </dl>

      <ul v-if="spot.amenities.length > 0" class="amenities" aria-label="Voorzieningen">
        <li v-for="amenity in spot.amenities" :key="amenity"><AppIcon :name="iconForAmenity(amenity)" /> {{ amenity }}</li>
      </ul>

      <div class="spot-dialog__price">
        <p><strong>{{ euro(spot.pricePerNightCents) }}</strong> per nacht</p>
        <p>Totaal voor {{ formatNights(spot.nights) }}: <strong class="spot-dialog__total">{{ euro(spot.totalPriceCents) }}</strong></p>
      </div>

      <div aria-live="assertive">
        <AlertBox v-if="error" kind="error"><p>{{ error }}</p></AlertBox>
      </div>

      <div class="btn-row">
        <button type="button" class="btn btn--large" :disabled="busy" :aria-busy="busy ? 'true' : undefined" @click="emit('choose', spot.id)">
          <template v-if="busy"><AppIcon name="loader" /> <span>Even controleren…</span></template>
          <template v-else><AppIcon name="check" /> <span>Kies deze plek</span></template>
        </button>
        <button type="button" class="btn btn--secondary" @click="close">Andere plek bekijken</button>
      </div>
    </div>
  </dialog>
</template>
