// Campsite details (name, phone, e-mail, season) for the header, footer and home page.
// Loaded once from GET /api/campsite and shared by every component that calls useCampsite().
// Until the answer arrives (or when the API cannot be reached) safe defaults are shown,
// so the page frame never breaks.
import { readonly, ref } from 'vue';
import { formatDayMonth } from '@groene-weide/shared/format';
import { getCampsite } from '../api/campsite.js';

const campsite = ref({
  name: 'Camping De Groene Weide',
  phone: '',
  phoneHref: '',
  email: '',
  season: { start: '04-01', end: '10-31' },
  today: null,
  firstOpenDay: null,
});
let loading = null;

export function useCampsite() {
  loading ??= getCampsite()
    .then((data) => { campsite.value = data; })
    .catch(() => { loading = null; }); // try again on the next page
  return readonly(campsite);
}

/** "Open van 1 april tot en met 31 oktober", from the season in the settings. */
export function openingText(season) {
  return `Open van ${formatDayMonth(`2000-${season.start}`)} tot en met ${formatDayMonth(`2000-${season.end}`)}`;
}
