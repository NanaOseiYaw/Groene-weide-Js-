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

const phone = (row) => (row.phone?.trim() ? `tel. ${row.phone.trim()}` : '');
/** "3 nachten · tel. 0612345678 · vriend van Bert": only the parts that are known. */
const arrivalMeta = (row) => [formatNights(row.nights), phone(row), row.isFriendOfBert ? 'vriend van Bert' : ''].filter(Boolean).join(' · ');
const plural = (count, one, more) => (count === 1 ? one : more);
</script>

<template>
  <h1>Dagoverzicht</h1>

  <!-- The day first (what am I looking at?), then the ways to pick another day. -->
  <section v-if="date" class="day-bar" aria-labelledby="day-title">
    <div class="day-bar__heading">
      <h2 id="day-title" class="day-title" aria-live="polite">{{ formatLongDate(date) }}</h2>
      <p v-if="date === today" class="day-bar__today"><AppIcon name="day" /> Vandaag</p>
    </div>
    <div class="day-picker">
      <div class="field">
        <label for="day">Kies een dag</label>
        <input id="day" type="date" :value="date" @change="onDateInput" />
      </div>
      <div class="btn-row">
        <button type="button" class="btn btn--secondary" @click="showDay(addDays(date, -1))"><AppIcon name="chevron-left" /> Vorige dag</button>
        <button type="button" class="btn btn--secondary" :disabled="date === today" @click="showDay(today)">Vandaag</button>
        <button type="button" class="btn btn--secondary" @click="showDay(addDays(date, 1))">Volgende dag <AppIcon name="chevron-right" /></button>
        <button type="button" class="btn btn--secondary no-print" @click="print"><AppIcon name="printer" /> Afdrukken</button>
      </div>
    </div>
  </section>

  <AlertBox v-if="loadError" kind="error">
    <p>{{ loadError }}</p>
    <button type="button" class="btn btn--secondary btn--small" @click="load"><AppIcon name="refresh" /> Probeer opnieuw</button>
  </AlertBox>
  <LoadingState v-else-if="!overview" text="Even geduld, het dagoverzicht wordt geladen." />
  <template v-else>
    <ul class="stat-tiles" aria-label="De dag in cijfers">
      <li class="stat-tiles__item">
        <span class="stat-tiles__icon"><AppIcon name="arrival" /></span>
        <span class="stat-tiles__number">{{ overview.stats.checkIns }}</span>
        <span class="stat-tiles__label">{{ plural(overview.stats.checkIns, 'aankomst', 'aankomsten') }}</span>
      </li>
      <li class="stat-tiles__item">
        <span class="stat-tiles__icon"><AppIcon name="departure" /></span>
        <span class="stat-tiles__number">{{ overview.stats.checkOuts }}</span>
        <span class="stat-tiles__label">{{ plural(overview.stats.checkOuts, 'vertrek', 'vertrekken') }}</span>
      </li>
      <li class="stat-tiles__item">
        <span class="stat-tiles__icon"><AppIcon name="location" /></span>
        <span class="stat-tiles__number">{{ overview.stats.occupiedSpots }}</span>
        <span class="stat-tiles__label">van {{ overview.stats.totalSpots }} plekken bezet</span>
      </li>
      <li class="stat-tiles__item">
        <span class="stat-tiles__icon"><AppIcon name="people" /></span>
        <span class="stat-tiles__number">{{ overview.stats.occupancyPercent }}%</span>
        <span class="stat-tiles__label">bezetting</span>
      </li>
    </ul>

    <div class="day-lists">
      <section class="day-list" aria-labelledby="arrivals-heading">
        <h3 id="arrivals-heading" class="day-list__title">
          <AppIcon name="arrival" /> Wie komt er?
          <span class="day-list__count">{{ overview.arrivals.length }}</span>
        </h3>
        <p v-if="overview.arrivals.length === 0" class="day-list__empty"><AppIcon name="info" /> Niemand komt op deze dag aan.</p>
        <ul v-else class="name-list">
          <li v-for="r in overview.arrivals" :key="r.id" class="name-list__item">
            <span class="name-list__spot">{{ r.spotName }}</span>
            <span>
              <strong class="name-list__name">{{ r.guestName }}</strong>
              <span class="name-list__meta">{{ arrivalMeta(r) }}</span>
            </span>
          </li>
        </ul>
      </section>
      <section class="day-list" aria-labelledby="departures-heading">
        <h3 id="departures-heading" class="day-list__title">
          <AppIcon name="departure" /> Wie vertrekt er?
          <span class="day-list__count">{{ overview.departures.length }}</span>
        </h3>
        <p v-if="overview.departures.length === 0" class="day-list__empty"><AppIcon name="info" /> Niemand vertrekt op deze dag.</p>
        <ul v-else class="name-list">
          <li v-for="r in overview.departures" :key="r.id" class="name-list__item">
            <span class="name-list__spot">{{ r.spotName }}</span>
            <span>
              <strong class="name-list__name">{{ r.guestName }}</strong>
              <span v-if="phone(r)" class="name-list__meta">{{ phone(r) }}</span>
            </span>
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
