<!--
  Reservation list for Bert and Anita: a simple, spreadsheet-like table. Port of ReservationList.razor.
  Search, filter and sort; new reservations appear by themselves (the list refreshes every 30 seconds).
  Cancelling deletes nothing: the status becomes Cancelled and the spot is free again.
-->
<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { formatShortDate } from '@groene-weide/shared/format';
import { cancelReservation, getReservations } from '../../api/admin.js';
import AlertBox from '../../components/ui/AlertBox.vue';
import AppIcon from '../../components/ui/AppIcon.vue';
import EmptyState from '../../components/ui/EmptyState.vue';
import LoadingState from '../../components/ui/LoadingState.vue';
import ModalDialog from '../../components/ui/ModalDialog.vue';
import YesNo from '../../components/ui/YesNo.vue';
import { loadToday } from '../../composables/useCampsite.js';

const REFRESH_MS = 30_000;
const COLUMNS = [
  ['spot', 'Plek'], ['name', 'Naam'], ['from', 'Van'], ['to', 'Tot'], ['nights', 'Nachten'],
  ['status', 'Status'], ['friend', 'Vriend van Bert'], ['paid', 'Betaald'],
];
const TIME = new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit' });

const today = ref(null);
const rows = ref(null);
const search = ref('');
const from = ref('');
const to = ref('');
const status = ref('Confirmed');
const sortKey = ref('from');
const ascending = ref(true);
const updatedAt = ref(null);
const message = ref(null);
const error = ref(null);
const toCancel = ref(null);
const busy = ref(false);
const confirmDialog = ref(null);
const messageBox = ref(null);
let refreshTimer = null;
let loadCounter = 0;

onMounted(async () => {
  today.value = await loadToday();
  from.value = today.value; // default: upcoming reservations
  await load();
  refreshTimer = setInterval(load, REFRESH_MS);
});

onBeforeUnmount(() => clearInterval(refreshTimer));

async function load() {
  const thisLoad = ++loadCounter; // typing quickly in the search box: only the last answer counts
  try {
    const loaded = await getReservations({ search: search.value, from: from.value, to: to.value, status: status.value });
    if (thisLoad !== loadCounter) return;
    rows.value = loaded;
    updatedAt.value = new Date();
    error.value = null;
  } catch (problem) {
    if (thisLoad === loadCounter) error.value = problem.message;
  }
}

async function resetFilters() {
  search.value = '';
  from.value = today.value;
  to.value = '';
  status.value = 'Confirmed';
  sortKey.value = 'from';
  ascending.value = true;
  await load();
}

// ---------- Cancelling ----------

const canCancel = (r) => r.status === 'Confirmed' && r.end >= today.value;

function askCancel(r) {
  toCancel.value = r;
  confirmDialog.value.open();
}

async function confirmCancel() {
  const r = toCancel.value;
  if (!r || busy.value) return;
  busy.value = true;
  try {
    await cancelReservation(r.id);
    message.value = `De reservering van ${r.guestName} is geannuleerd. Plek ${r.spotName} is weer vrij van ${formatShortDate(r.start)} tot ${formatShortDate(r.end)}.`;
    error.value = null;
  } catch (problem) {
    message.value = null;
    error.value = problem.message;
  } finally {
    busy.value = false;
  }
  confirmDialog.value.close(); // focus goes back to the "Annuleer…" button
  await load();
  // With the "Bevestigd" filter the row (and its button) is gone now: then the message gets the focus.
  await nextTick();
  if (!document.activeElement || document.activeElement === document.body) messageBox.value?.focus();
}

// ---------- Sorting ----------

const SORT_VALUE = {
  spot: (r) => r.spotName,
  name: (r) => r.guestName,
  from: (r) => r.start,
  to: (r) => r.end,
  nights: (r) => r.nights,
  status: (r) => r.status,
  friend: (r) => Number(r.isFriendOfBert),
  paid: (r) => r.paymentStatus,
};

function compare(a, b) {
  return typeof a === 'number' ? a - b : String(a).localeCompare(String(b), 'nl', { numeric: true, sensitivity: 'base' });
}

/** Sorted by the chosen column, then by arrival and spot (like ThenBy in the C# version). */
const sortedRows = computed(() => {
  const value = SORT_VALUE[sortKey.value];
  const direction = ascending.value ? 1 : -1;
  return [...(rows.value ?? [])].sort((a, b) =>
    direction * compare(value(a), value(b)) || compare(a.start, b.start) || compare(a.spotName, b.spotName));
});

function sortBy(key) {
  if (sortKey.value === key) ascending.value = !ascending.value;
  else {
    sortKey.value = key;
    ascending.value = true;
  }
}

const ariaSort = (key) => (sortKey.value !== key ? 'none' : ascending.value ? 'ascending' : 'descending');
const sortIcon = (key) => (sortKey.value !== key ? 'sort' : ascending.value ? 'chevron-up' : 'chevron-down');

// ---------- Display ----------

const withYear = (date) => `${formatShortDate(date)} ${date.slice(0, 4)}`;
const rowClasses = (r) => ({ 'table__row--warning': r.needsMove, 'table__row--cancelled': r.status === 'Cancelled' });
</script>

<template>
  <h1>Reserveringen</h1>

  <div class="filters">
    <div class="field">
      <label for="search">Zoek op naam of plek</label>
      <input id="search" v-model="search" type="search" placeholder="Bijv. Jansen of T01" @input="load" />
    </div>
    <div class="field">
      <label for="from">Vanaf</label>
      <input id="from" v-model="from" type="date" @change="load" />
    </div>
    <div class="field">
      <label for="to">Tot en met</label>
      <input id="to" v-model="to" type="date" @change="load" />
    </div>
    <div class="field">
      <label for="status">Status</label>
      <select id="status" v-model="status" @change="load">
        <option value="">Alle</option>
        <option value="Confirmed">Bevestigd</option>
        <option value="Cancelled">Geannuleerd</option>
      </select>
    </div>
  </div>
  <div class="btn-row filters__actions">
    <button type="button" class="btn btn--secondary" @click="resetFilters"><AppIcon name="calendar" /> Toon komende reserveringen</button>
    <button type="button" class="btn btn--secondary" @click="load"><AppIcon name="refresh" /> Ververs de lijst</button>
  </div>

  <div ref="messageBox" aria-live="polite" tabindex="-1">
    <AlertBox v-if="message" kind="success"><p>{{ message }}</p></AlertBox>
  </div>
  <AlertBox v-if="error" kind="error"><p>{{ error }}</p></AlertBox>

  <LoadingState v-if="rows === null && !error" text="Even geduld, de reserveringen worden geladen." />
  <EmptyState v-else-if="rows?.length === 0" title="Geen reserveringen gevonden" :image="null">
    <p>Er zijn geen reserveringen die passen bij je zoekopdracht of filters. Pas de zoekterm of de datums aan, of toon alle komende reserveringen.</p>
    <button type="button" class="btn" @click="resetFilters">Toon komende reserveringen</button>
  </EmptyState>
  <template v-else-if="rows">
    <p class="table__meta">
      {{ rows.length }} {{ rows.length === 1 ? 'reservering' : 'reserveringen' }} · bijgewerkt om {{ TIME.format(updatedAt) }}
    </p>

    <div class="table-scroll" role="region" aria-label="Tabel met reserveringen" tabindex="0">
      <table class="table table--sticky-first">
        <thead>
          <tr>
            <th v-for="[key, title] in COLUMNS" :key="key" scope="col" :aria-sort="ariaSort(key)">
              <button type="button" class="table__sort" @click="sortBy(key)">{{ title }} <AppIcon :name="sortIcon(key)" /></button>
            </th>
            <th scope="col">Telefoon</th>
            <th scope="col">E-mail</th>
            <th scope="col"><span class="visually-hidden">Actie</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in sortedRows" :key="r.id" :class="rowClasses(r)">
            <td><strong>{{ r.spotName }}</strong></td>
            <td>
              {{ r.guestName }}
              <span v-if="r.needsMove" class="badge badge--warning"><AppIcon name="alert" /> Moet verplaatst worden</span>
              <span v-if="r.notes?.trim()" class="table__note">{{ r.notes }}</span>
            </td>
            <td class="table__nowrap">{{ withYear(r.start) }}</td>
            <td class="table__nowrap">{{ withYear(r.end) }}</td>
            <td class="table__number">{{ r.nights }}</td>
            <td>{{ r.status === 'Confirmed' ? 'Bevestigd' : 'Geannuleerd' }}</td>
            <td><YesNo :value="r.isFriendOfBert" /></td>
            <td><YesNo :value="r.paymentStatus === 'Paid'" /></td>
            <td class="table__nowrap">{{ r.phone ?? '–' }}</td>
            <td>{{ r.email ?? '–' }}</td>
            <td>
              <button
                v-if="canCancel(r)"
                type="button"
                class="btn btn--secondary btn--small"
                :aria-label="`Annuleer de reservering van ${r.guestName} op plek ${r.spotName}`"
                @click="askCancel(r)"
              >Annuleer…</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </template>

  <ModalDialog ref="confirmDialog" title="Reservering annuleren" @closed="toCancel = null">
    <template v-if="toCancel">
      <p>
        Reservering van <strong>{{ toCancel.guestName }}</strong> op plek <strong>{{ toCancel.spotName }}</strong>
        ({{ formatShortDate(toCancel.start) }} t/m {{ formatShortDate(toCancel.end) }}) annuleren?
      </p>
      <p>Er wordt niets verwijderd: de reservering krijgt de status "Geannuleerd" en de plek is weer vrij.</p>
      <div class="btn-row">
        <button type="button" class="btn btn--danger" :disabled="busy" :aria-busy="busy ? 'true' : undefined" @click="confirmCancel">
          Ja, annuleer
        </button>
        <button type="button" class="btn btn--secondary" @click="confirmDialog.close()">Nee, houden</button>
      </div>
    </template>
  </ModalDialog>
</template>
