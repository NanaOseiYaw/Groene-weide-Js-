// The staff section (docs/api.md, "Staff endpoints"). One function per endpoint.
//
// Every call goes through `staff`: when the API answers 401 (the session has expired, or the
// staff member signed out in another tab), the browser goes to the sign-in page and comes back
// to the same page afterwards. The error is still thrown, so the page stops what it was doing.
import { ApiError, api, query } from './http.js';
import { router } from '../router.js';
import { useAuth } from '../stores/auth.js';

async function guard(request) {
  try {
    return await request;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      useAuth().forget();
      const here = router.currentRoute.value.fullPath;
      router.push({ path: '/account/login', query: { returnUrl: here } });
    }
    throw error;
  }
}

const staff = {
  get: (path) => guard(api.get(`/admin${path}`)),
  post: (path, body = {}) => guard(api.post(`/admin${path}`, body)),
  patch: (path, body) => guard(api.patch(`/admin${path}`, body)),
  delete: (path) => guard(api.delete(`/admin${path}`)),
};

// ---------- Daily overview ----------

/** Numbers, arrivals and departures of one day → { stats, arrivals, departures } */
export const getDay = (date) => staff.get(`/day/${date}`);

/** Calendar days of one month for all spots, with checkIns/checkOuts per day. */
export const getCalendarMonth = async ({ year, month }) => (await staff.get(`/calendar${query({ year, month })}`)).days;

// ---------- Reservations ----------

/** The spreadsheet-like list. All filters are optional. */
export const getReservations = async ({ search, from, to, status }) =>
  (await staff.get(`/reservations${query({ search: search?.trim(), from, to, status })}`)).reservations;

/** Cancels a reservation (nothing is deleted). → the updated row */
export const cancelReservation = async (id) => (await staff.post(`/reservations/${id}/cancel`)).reservation;

/** Confirmed reservations on spots that are out of use. */
export const getNeedsMove = async () => (await staff.get('/needs-move')).reservations;

// ---------- Phone booking (reserve tents count) ----------

export const getPhoneBookingMonth = async ({ type, year, month }) => (await staff.get(`/availability${query({ type, year, month })}`)).days;

export const checkPhoneBookingPeriod = ({ type, start, end }) => staff.get(`/availability/check${query({ type, start, end })}`);

/** → [{ id, name, isHeld }] */
export const getFreeSpots = async ({ type, start, end }) => (await staff.get(`/free-spots${query({ type, start, end })}`)).spots;

/** → { reservation, emailSent } */
export const createPhoneReservation = (booking) => staff.post('/reservations', booking);

// ---------- Spots out of use / back in use ----------

/** All 60 spots in field order with their status on that day. */
export const getSpotOverview = async (day) => (await staff.get(`/spots${query({ day })}`)).spots;

/** → { spots, needsMove } */
export const setSpotUnavailable = (spotId, reason) => staff.post(`/spots/${spotId}/unavailable`, { reason });
export const setSpotAvailable = (spotId) => staff.post(`/spots/${spotId}/available`);
export const setFieldUnavailable = (fieldName, reason) => staff.post(`/fields/${encodeURIComponent(fieldName)}/unavailable`, { reason });
export const setFieldAvailable = (fieldName) => staff.post(`/fields/${encodeURIComponent(fieldName)}/available`);

// ---------- Photos ----------

/** → [{ id, url, altText, sortOrder }] */
export const getPhotos = async (spotId) => (await staff.get(`/spots/${spotId}/photos`)).photos;

/** Upload as a multipart form: the file in "photo", the description in "altText". → the new photo */
export async function uploadPhoto(spotId, file, altText) {
  const form = new FormData();
  form.append('altText', altText);
  form.append('photo', file);
  return (await staff.post(`/spots/${spotId}/photos`, form)).photo;
}

export const updatePhotoAltText = (photoId, altText) => staff.patch(`/photos/${photoId}`, { altText });

/** direction: -1 = earlier, 1 = later */
export const movePhoto = (photoId, direction) => staff.post(`/photos/${photoId}/move`, { direction });

export const deletePhoto = (photoId) => staff.delete(`/photos/${photoId}`);
