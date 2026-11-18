<!--
  Daily overview: who arrives, who leaves, how many spots are occupied. Today by default.
  Below it the same calendar as for guests, with numbers per day (show-stats).
  Printable without the menu and the calendar. Port of DailyOverview.razor.
-->
<script setup>
import { onMounted, ref } from 'vue';
import { addDays, isIsoDate } from '@groene-weide/shared/dates';
import { formatLongDate, formatNights } from '@groene-weide/shared/format';
import { getCalendarMonth, getDay } from '../../api/admin.js';
import AvailabilityCalendar from '../../components/booking/AvailabilityCalendar.vue';
import AlertBox from '../../components/ui/AlertBox.vue';
import AppIcon from '../../components/ui/AppIcon.vue';
import LoadingState from '../../components/ui/LoadingState.vue';
import { loadToday } from '../../composables/useCampsite.js';

const today = ref(null);
const date = ref(null);
const overview = ref(null); // { stats, arrivals, departures }
const loadError = ref(null);
let loadCounter = 0;

onMounted(async () => {
  today.value = await loadToday();
  await showDay(today.value);
});

async function showDay(day) {
  date.value = day;
  await load();
}

async function load() {
  const thisLoad = ++loadCounter; // clicking quickly through days: only the last answer counts
  overview.value = null;
  loadError.value = null;
  try {
    const result = await getDay(date.value);
    if (thisLoad === loadCounter) overview.value = result;
  } catch (problem) {
    if (thisLoad === loadCounter) loadError.value = problem.message;
  }
}

/** The date field: only a complete date counts (while typing, or when emptied, nothing happens). */
function onDateInput(event) {
  if (isIsoDate(event.target.value)) showDay(event.target.value);
}

/** Through a click handler, not onclick="…": the Content-Security-Policy forbids inline scripts. */
const print = () => window.print();

const phone = (row) => (row.phone?.trim() ? ` · tel. ${row.phone}` : '');
const plural = (count, one, more) => (count === 1 ? one : more);
</script>

<template>
  <h1>Dagoverzicht</h1>

  <template v-if="date">
    <div class="day-picker">
      <div class="field">
        <label for="day">Kies een dag</label>
        <input id="day" type="date" :value="date" @change="onDateInput" />
      </div>
      <div class="btn-row">
        <button type="button" class="btn btn--secondary" @click="showDay(addDays(date, -1))"><AppIcon name="chevron-left" /> Vorige dag</button>
        <button type="button" class="btn btn--secondary" @click="showDay(today)">Vandaag</button>
        <button type="button" class="btn btn--secondary" @click="showDay(addDays(date, 1))">Volgende dag <AppIcon name="chevron-right" /></button>
        <button type="button" class="btn btn--secondary no-print" @click="print"><AppIcon name="printer" /> Afdrukken</button>
      </div>
    </div>

    <h2 class="day-title" aria-live="polite">{{ formatLongDate(date) }}</h2>
  </template>

  <AlertBox v-if="loadError" kind="error">
    <p>{{ loadError }}</p>
    <button type="button" class="btn btn--secondary btn--small" @click="load"><AppIcon name="refresh" /> Probeer opnieuw</button>
  </AlertBox>
  <LoadingState v-else-if="!overview" text="Even geduld, het dagoverzicht wordt geladen." />
  <template v-else>
    <ul class="stat-tiles">
      <li class="stat-tiles__item">
        <AppIcon name="arrival" /><span class="stat-tiles__number">{{ overview.stats.checkIns }}</span>
        {{ plural(overview.stats.checkIns, 'aankomst', 'aankomsten') }}
      </li>
      <li class="stat-tiles__item">
        <AppIcon name="departure" /><span class="stat-tiles__number">{{ overview.stats.checkOuts }}</span>
        {{ plural(overview.stats.checkOuts, 'vertrek', 'vertrekken') }}
      </li>
      <li class="stat-tiles__item">
        <AppIcon name="location" /><span class="stat-tiles__number">{{ overview.stats.occupiedSpots }}</span>
        van {{ overview.stats.totalSpots }} plekken bezet
      </li>
      <li class="stat-tiles__item">
        <AppIcon name="people" /><span class="stat-tiles__number">{{ overview.stats.occupancyPercent }}%</span> bezetting
      </li>
    </ul>

    <div class="day-lists">
      <section aria-labelledby="arrivals-heading">
        <h3 id="arrivals-heading"><AppIcon name="arrival" /> Wie komt er?</h3>
        <p v-if="overview.arrivals.length === 0" class="day-lists__empty">Niemand komt op deze dag aan.</p>
        <ul v-else class="name-list">
          <li v-for="r in overview.arrivals" :key="r.id">
            <strong>{{ r.spotName }}</strong> {{ r.guestName }}
            <span class="name-list__meta">{{ formatNights(r.nights) }}{{ phone(r) }}{{ r.isFriendOfBert ? ' · vriend van Bert' : '' }}</span>
          </li>
        </ul>
      </section>
      <section aria-labelledby="departures-heading">
        <h3 id="departures-heading"><AppIcon name="departure" /> Wie vertrekt er?</h3>
        <p v-if="overview.departures.length === 0" class="day-lists__empty">Niemand vertrekt op deze dag.</p>
        <ul v-else class="name-list">
          <li v-for="r in overview.departures" :key="r.id">
            <strong>{{ r.spotName }}</strong> {{ r.guestName }} <span class="name-list__meta">{{ phone(r) }}</span>
          </li>
        </ul>
      </section>
    </div>
  </template>

  <section v-if="date" class="no-print month-overview" aria-labelledby="month-heading">
    <h2 id="month-heading">Maandoverzicht</h2>
    <p>Klik op een dag om die dag hierboven te zien.</p>
    <!-- :key per month: when a day in another month is chosen, the calendar opens on that month. -->
    <AvailabilityCalendar
      :key="date.slice(0, 7)"
      :load-month="getCalendarMonth"
      show-stats
      :selected-day="date"
      @day-selected="showDay"
    />
  </section>
</template>
