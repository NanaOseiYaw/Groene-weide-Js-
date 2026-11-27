<!--
  Pick a spot on the map of your field. This file does three things:
  1. Ask the server which spots are free.
  2. Give each spot a status: free, taken or chosen.
  3. Open the pop-up when you click a spot.
  We only show the guest's own field, because they already picked the field in step 2.
-->
<script setup>
import { computed, nextTick, onMounted, ref } from 'vue';
import { getAvailableSpots, getSpot } from '../../api/booking.js';
import AlertBox from '../ui/AlertBox.vue';
import AppIcon from '../ui/AppIcon.vue';
import EmptyState from '../ui/EmptyState.vue';
import LoadingState from '../ui/LoadingState.vue';
import { FIELDS } from './field-map.js';
import FieldMap from './FieldMap.vue';
import SpotDialog from './SpotDialog.vue';

const props = defineProps({
  /** 'TentCaravan', 'Camper' or 'Safari' */
  type: { type: String, required: true },
  start: { type: String, required: true },
  end: { type: String, required: true },
  /** Already chosen spot, for example when the guest comes back from the next step */
  selectedSpotId: { type: Number, default: null },
});
const emit = defineEmits(['spot-chosen', 'choose-other-dates']);

const TAKEN = 'Deze plek is net door iemand anders gekozen. Kies een andere plek; de kaart is bijgewerkt.';

const field = computed(() => FIELDS[props.type]);

// null while we are still loading
const freeSpots = ref(null);
const loadError = ref(null);
const message = ref(null);
const detail = ref(null);
const dialogError = ref(null);
const busy = ref(false);
const dialog = ref(null);

onMounted(load);

// ---------- 1. Ask the server which spots are free ----------

async function load() {
  loadError.value = null;
  try {
    freeSpots.value = await getAvailableSpots({ type: props.type, start: props.start, end: props.end });
  } catch (problem) {
    loadError.value = problem.message;
  }
}

// ---------- 2. Give each spot a status ----------
// The server only sends free spots. So if a spot is not in that list, it is taken.
// Guests don't see why (booked or held by staff), it just says "Bezet".

const mapSpots = computed(() => {
  return field.value.spotNames.map((name) => {
    const freeSpot = freeSpots.value.find((spot) => spot.name === name);

    let status = 'taken';
    if (freeSpot && freeSpot.id === props.selectedSpotId) status = 'chosen';
    else if (freeSpot) status = 'free';

    return { name, status, id: freeSpot?.id };
  });
});

// ---------- 3. The pop-up ----------

async function openSpot(id) {
  message.value = null;
  dialogError.value = null;
  try {
    detail.value = await getSpot({ id, start: props.start, end: props.end });
  } catch (problem) {
    return problem.code === 'spot_unavailable' ? spotTaken(problem.message) : (message.value = problem.message);
  }
  await nextTick();
  dialog.value.open();
}

// "Kies deze plek": ask the server again, because someone else may have booked it in the meantime.
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

// Someone else was faster: show a message and load the map again.
async function spotTaken(text = TAKEN) {
  message.value = text;
  await load();
}

function dialogClosed() {
  detail.value = null;
  dialogError.value = null;
}
</script>

<template>
  <div aria-live="polite">
    <AlertBox v-if="message" kind="warning"><p>{{ message }}</p></AlertBox>
  </div>

  <AlertBox v-if="loadError" kind="error">
    <p>{{ loadError }}</p>
    <button type="button" class="btn btn--secondary btn--small" @click="load"><AppIcon name="refresh" /> Probeer opnieuw</button>
  </AlertBox>

  <LoadingState v-else-if="!freeSpots" text="Even geduld, we zoeken de vrije plekken." />

  <EmptyState v-else-if="freeSpots.length === 0" title="Geen plek meer vrij in deze periode">
    <p>Alle plekken op het {{ field.name }} zijn bezet op een of meer van je nachten. Kies andere datums: in de kalender zie je welke dagen nog vrij zijn.</p>
    <button type="button" class="btn" @click="emit('choose-other-dates')"><AppIcon name="calendar" /> Kies andere datums</button>
  </EmptyState>

  <template v-else>
    <p>{{ freeSpots.length }} van de {{ field.spotNames.length }} plekken zijn vrij. Klik op een vrije plek voor foto's en details.</p>

    <!-- Same labels as on the map -->
    <ul class="map-legend" aria-label="Uitleg van de kaart">
      <li><span class="spot-marker spot-marker--free"><AppIcon name="check" /> Vrij</span></li>
      <li><span class="spot-marker spot-marker--taken"><AppIcon name="x" /> Bezet</span></li>
      <li class="map-legend__chosen"><span class="spot-marker spot-marker--chosen"><AppIcon name="star" /> Gekozen</span></li>
    </ul>

    <FieldMap :field="field" :spots="mapSpots" @spot-click="openSpot" />
  </template>

  <SpotDialog ref="dialog" :spot="detail" :error="dialogError" :busy="busy" @choose="choose" @closed="dialogClosed" />
</template>
