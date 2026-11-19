<!--
  List of available spots (Feature 4). A click on a spot opens the pop-up with photos.
  Only spots that are free for the whole period are listed. "Kies deze plek" checks again on the
  server, because someone else may have booked the spot in the meantime. Port of SpotList.razor.
-->
<script setup>
import { nextTick, onMounted, ref } from 'vue';
import { euro } from '@groene-weide/shared/format';
import { getAvailableSpots, getSpot } from '../../api/booking.js';
import AlertBox from '../ui/AlertBox.vue';
import AppIcon from '../ui/AppIcon.vue';
import EmptyState from '../ui/EmptyState.vue';
import LoadingState from '../ui/LoadingState.vue';
import { iconForAmenity } from '../ui/icons.js';
import PhotoPlaceholder from './PhotoPlaceholder.vue';
import SpotDialog from './SpotDialog.vue';

const props = defineProps({
  type: { type: String, required: true },
  start: { type: String, required: true },
  end: { type: String, required: true },
  /** The spot that was already chosen (e.g. after going back). */
  selectedSpotId: { type: Number, default: null },
});
const emit = defineEmits(['spot-chosen', 'choose-other-dates']);

const TAKEN = 'Deze plek is net door iemand anders gekozen. Kies een andere plek; de lijst is bijgewerkt.';

const spots = ref(null);
const loadError = ref(null);
const listMessage = ref(null);
const detail = ref(null);
const dialogError = ref(null);
const busy = ref(false);
const dialog = ref(null);

onMounted(load);

async function load() {
  loadError.value = null;
  try {
    spots.value = await getAvailableSpots(props);
  } catch (problem) {
    loadError.value = problem.message;
  }
}

async function openSpot(id) {
  listMessage.value = null;
  dialogError.value = null;
  try {
    detail.value = await getSpot({ id, start: props.start, end: props.end });
  } catch (problem) {
    return problem.code === 'spot_unavailable' ? spotTaken(problem.message) : (listMessage.value = problem.message);
  }
  await nextTick();
  dialog.value.open();
}

/** "Kies deze plek": check again on the server (port of BookingDraft.TrySelectSpotAsync). */
async function choose(id) {
  if (busy.value) return;
  busy.value = true;
  try {
    const spot = await getSpot({ id, start: props.start, end: props.end });
    if (spot.type !== props.type) throw Object.assign(new Error(TAKEN), { code: 'spot_unavailable' });
    dialog.value.close();
    emit('spot-chosen', spot);
  } catch (problem) {
    if (problem.code === 'spot_unavailable') {
      dialog.value.close();
      await spotTaken(problem.message);
    } else {
      dialogError.value = problem.message;
    }
  } finally {
    busy.value = false;
  }
}

/** The spot was just taken: show a message and refresh the list. */
async function spotTaken(message = TAKEN) {
  listMessage.value = message;
  await load();
}

function dialogClosed() {
  detail.value = null;
  dialogError.value = null;
}

const countText = (count) => (count === 1 ? 'Er is 1 plek vrij.' : `Er zijn ${count} plekken vrij.`);
</script>

<template>
  <div aria-live="polite">
    <AlertBox v-if="listMessage" kind="warning"><p>{{ listMessage }}</p></AlertBox>
  </div>

  <AlertBox v-if="loadError" kind="error">
    <p>{{ loadError }}</p>
    <button type="button" class="btn btn--secondary btn--small" @click="load"><AppIcon name="refresh" /> Probeer opnieuw</button>
  </AlertBox>
  <LoadingState v-else-if="!spots" text="Even geduld, we zoeken de vrije plekken." />
  <EmptyState v-else-if="spots.length === 0" title="Geen plek meer vrij in deze periode">
    <p>Alle plekken van dit type zijn bezet op een of meer van je nachten. Kies andere datums: in de kalender zie je welke dagen nog vrij zijn.</p>
    <button type="button" class="btn" @click="emit('choose-other-dates')"><AppIcon name="calendar" /> Kies andere datums</button>
  </EmptyState>
  <template v-else>
    <p class="spot-list__count">{{ countText(spots.length) }} Klik op een plek voor foto's en details.</p>
    <ul class="spot-list">
      <li v-for="spot in spots" :key="spot.id">
        <button type="button" :class="['spot-card', { 'spot-card--chosen': spot.id === selectedSpotId }]" @click="openSpot(spot.id)">
          <img v-if="spot.firstPhoto" class="spot-card__photo" :src="spot.firstPhoto.url" alt="" loading="lazy" width="400" height="250" />
          <PhotoPlaceholder v-else compact decorative />
          <span class="spot-card__body">
            <span class="spot-card__name">Plek {{ spot.name }}</span>
            <span class="spot-card__facts">
              <span><AppIcon name="people" /> {{ spot.capacity }} personen</span>
              <span v-if="spot.distanceToiletM !== null"><AppIcon name="toilet" /> {{ spot.distanceToiletM }} m naar de wc</span>
              <span><AppIcon :name="iconForAmenity(spot.amenities[0] ?? '')" /> {{ spot.amenities.join(', ') }}</span>
            </span>
            <span class="spot-card__price">{{ euro(spot.pricePerNightCents) }} per nacht</span>
            <!-- The visible text is the button name (WCAG 2.5.3); only this part is added for screen readers. -->
            <span class="visually-hidden">{{ spot.firstPhoto ? '' : 'Foto volgt. ' }}Bekijk details.</span>
            <span v-if="spot.id === selectedSpotId" class="spot-card__chosen"><AppIcon name="check" /> Gekozen</span>
          </span>
        </button>
      </li>
    </ul>
  </template>

  <SpotDialog ref="dialog" :spot="detail" :error="dialogError" :busy="busy" @choose="choose" @closed="dialogClosed" />
</template>
