<!--
  Take spots out of use and back into use (wet season, accident, maintenance). Port of SpotManagement.razor.
  A spot that is out of use disappears from guest booking; guests never see the reason.
  Existing reservations on that spot are marked "moet verplaatst worden" and listed at the bottom.
-->
<script setup>
import { computed, nextTick, onMounted, ref } from 'vue';
import { isIsoDate } from '@groene-weide/shared/dates';
import { formatShortDate } from '@groene-weide/shared/format';
import {
  getNeedsMove,
  getSpotOverview,
  setFieldAvailable,
  setFieldUnavailable,
  setSpotAvailable,
  setSpotUnavailable,
} from '../../api/admin.js';
import NeedsMoveList from '../../components/admin/NeedsMoveList.vue';
import SpotTile from '../../components/admin/SpotTile.vue';
import AlertBox from '../../components/ui/AlertBox.vue';
import AppIcon from '../../components/ui/AppIcon.vue';
import LoadingState from '../../components/ui/LoadingState.vue';
import ModalDialog from '../../components/ui/ModalDialog.vue';
import { loadToday } from '../../composables/useCampsite.js';
import { REASONS, reasonText } from '../../components/admin/spot-status.js';

const day = ref(null);
const spots = ref(null);
const needsMove = ref(null);
const message = ref(null);
const messageKind = ref('success');
const loadError = ref(null);
const dialog = ref(null);
const messageBox = ref(null);
/** What needs confirming: { spot?, fieldName, turnOff } (one spot or a whole field). */
const pending = ref(null);
const selectedReason = ref('Maintenance');
const busy = ref(false);
let loadCounter = 0;

onMounted(async () => {
  day.value = await loadToday();
  await load();
});

async function load() {
  const thisLoad = ++loadCounter;
  try {
    const [loadedSpots, loadedNeedsMove] = await Promise.all([getSpotOverview(day.value), getNeedsMove()]);
    if (thisLoad !== loadCounter) return;
    spots.value = loadedSpots;
    needsMove.value = loadedNeedsMove;
    loadError.value = null;
  } catch (problem) {
    if (thisLoad === loadCounter) loadError.value = problem.message;
  }
}

function onDayInput(event) {
  if (!isIsoDate(event.target.value)) return;
  day.value = event.target.value;
  load();
}

/** The spots per field, in the order the API gives them (Kampeerveld, Camperveld, Safariveld). */
const fields = computed(() => {
  const groups = new Map();
  for (const spot of spots.value ?? []) {
    if (!groups.has(spot.fieldName)) groups.set(spot.fieldName, []);
    groups.get(spot.fieldName).push(spot);
  }
  return [...groups].map(([name, fieldSpots]) => ({ name, spots: fieldSpots, offCount: fieldSpots.filter((s) => !s.isAvailable).length }));
});

// ---------- Asking and confirming ----------

const dialogTitle = computed(() => {
  const p = pending.value;
  if (!p) return '';
  if (p.spot) return `Plek ${p.spot.name} uitzetten`;
  return p.turnOff ? `Heel ${p.fieldName} uitzetten` : `Heel ${p.fieldName} weer aanzetten`;
});

function askSpot(spot) {
  pending.value = { spot, fieldName: spot.fieldName, turnOff: true };
  selectedReason.value = 'Maintenance';
  dialog.value.open();
}

function askField(fieldName, turnOff) {
  pending.value = { spot: null, fieldName, turnOff };
  selectedReason.value = 'WetSeason';
  dialog.value.open();
}

async function confirm() {
  const p = pending.value;
  if (!p || busy.value) return;
  busy.value = true;
  try {
    if (p.turnOff) {
      const reason = selectedReason.value;
      const result = p.spot ? await setSpotUnavailable(p.spot.id, reason) : await setFieldUnavailable(p.fieldName, reason);
      const what = p.spot ? `Plek ${p.spot.name} is` : `Alle plekken van het ${p.fieldName} zijn`;
      const moved = result.needsMove;
      showMessage(
        `${what} uitgezet (${reasonText(reason)}). ${
          moved === 0 ? 'Er zijn geen gasten die verplaatst moeten worden.'
          : moved === 1 ? '1 reservering moet verplaatst worden: zie de lijst onderaan.'
          : `${moved} reserveringen moeten verplaatst worden: zie de lijst onderaan.`}`,
        moved > 0 ? 'warning' : 'success',
      );
    } else {
      await setFieldAvailable(p.fieldName);
      showMessage(`Alle plekken van het ${p.fieldName} staan weer aan.`, 'success');
    }
  } catch (problem) {
    showMessage(problem.message, 'error');
  } finally {
    busy.value = false;
  }
  dialog.value.close(); // focus goes back to the button that opened the dialog
  await afterChange();
}

async function turnOn(spot) {
  try {
    await setSpotAvailable(spot.id);
    showMessage(`Plek ${spot.name} staat weer aan en is weer te boeken.`, 'success');
  } catch (problem) {
    showMessage(problem.message, 'error');
  }
  await afterChange();
}

/** Reload; when the button that had the focus is gone now (e.g. "Zet heel veld aan…"), the message gets it. */
async function afterChange() {
  await load();
  await nextTick();
  if (!document.activeElement || document.activeElement === document.body) messageBox.value?.focus();
}

function showMessage(text, kind) {
  message.value = text;
  messageKind.value = kind;
}
</script>

<template>
  <h1>Plekken</h1>

  <div v-if="day" class="field">
    <label for="day">Gereserveerd op</label>
    <input id="day" type="date" :value="day" @change="onDayInput" />
  </div>

  <ul class="spot-legend" aria-label="Uitleg van de kleuren">
    <li><span class="spot-legend__swatch spot-tile--free"><AppIcon name="check" /></span> vrij</li>
    <li><span class="spot-legend__swatch spot-tile--reserved"><AppIcon name="occupied" /></span> gereserveerd{{ day ? ` op ${formatShortDate(day)}` : '' }}</li>
    <li><span class="spot-legend__swatch spot-tile--held"><AppIcon name="flag" /></span> vastgehouden (reserve-tent)</li>
    <li><span class="spot-legend__swatch spot-tile--unavailable"><AppIcon name="ban" /></span> niet beschikbaar (met reden)</li>
  </ul>

  <div ref="messageBox" aria-live="polite" tabindex="-1">
    <AlertBox v-if="message" :kind="messageKind"><p>{{ message }}</p></AlertBox>
  </div>

  <AlertBox v-if="loadError" kind="error">
    <p>{{ loadError }}</p>
    <button type="button" class="btn btn--secondary btn--small" @click="load"><AppIcon name="refresh" /> Probeer opnieuw</button>
  </AlertBox>
  <LoadingState v-else-if="!spots" text="Even geduld, de plekken worden geladen." />
  <template v-else>
    <section v-for="field in fields" :key="field.name" class="field-group" :aria-labelledby="`field-${field.name}`">
      <div class="field-group__header">
        <h2 :id="`field-${field.name}`">
          {{ field.name }}
          <span class="field-group__count">({{ field.spots.length }} plekken{{ field.offCount > 0 ? `, ${field.offCount} uit` : '' }})</span>
        </h2>
        <div class="btn-row">
          <button type="button" class="btn btn--secondary btn--small" @click="askField(field.name, true)"><AppIcon name="ban" /> Zet heel veld uit…</button>
          <button v-if="field.offCount > 0" type="button" class="btn btn--secondary btn--small" @click="askField(field.name, false)">
            <AppIcon name="check-circle" /> Zet heel veld aan…
          </button>
        </div>
      </div>
      <ul class="spot-tiles">
        <SpotTile v-for="spot in field.spots" :key="spot.id" :spot="spot" @turn-off="askSpot(spot)" @turn-on="turnOn(spot)" />
      </ul>
    </section>

    <NeedsMoveList :reservations="needsMove" />
  </template>

  <!-- Confirmation: take a spot or a field out of use (with a reason), or put a field back into use. -->
  <ModalDialog ref="dialog" :title="dialogTitle" @closed="pending = null">
    <template v-if="pending">
      <template v-if="pending.turnOff">
        <fieldset class="field">
          <legend>Waarom gaat {{ pending.spot ? 'deze plek' : 'dit veld' }} uit?</legend>
          <label v-for="[value, text] in REASONS" :key="value" class="checkbox">
            <input v-model="selectedReason" type="radio" name="reason" :value="value" />
            {{ text }}
          </label>
        </fieldset>
        <p>
          Gasten kunnen {{ pending.spot ? 'deze plek' : 'deze plekken' }} daarna niet meer boeken.
          Bestaande reserveringen komen in de lijst "Moet verplaatst worden".
        </p>
      </template>
      <p v-else>Alle plekken van het {{ pending.fieldName }} kunnen daarna weer geboekt worden.</p>
      <div class="btn-row">
        <button
          type="button"
          :class="['btn', { 'btn--danger': pending.turnOff }]"
          :disabled="busy"
          :aria-busy="busy ? 'true' : undefined"
          @click="confirm"
        >
          {{ pending.turnOff ? (pending.spot ? 'Zet de plek uit' : 'Zet het veld uit') : 'Zet het veld aan' }}
        </button>
        <button type="button" class="btn btn--secondary" @click="dialog.close()">Niets veranderen</button>
      </div>
    </template>
  </ModalDialog>
</template>
