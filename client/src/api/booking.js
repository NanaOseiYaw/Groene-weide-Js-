// The guest booking flow (docs/api.md: availability, spots, reservations).
import { api, query } from './http.js';

/** Calendar days of one month for a spot type. */
export const getMonth = async ({ type, year, month }) => (await api.get(`/availability${query({ type, year, month })}`)).days;

/** Is this period possible? → { valid, message, alternatives } */
export const checkPeriod = ({ type, start, end }) => api.get(`/availability/check${query({ type, start, end })}`);

/** Spots of this type that are free for the whole period. */
export const getAvailableSpots = async ({ type, start, end }) => (await api.get(`/spots${query({ type, start, end })}`)).spots;

/** Details of one spot with the total price; ApiError code "spot_unavailable" when it was just taken. */
export const getSpot = async ({ id, start, end }) => (await api.get(`/spots/${id}${query({ start, end })}`)).spot;

/** Stores the reservation (payment still open). → { reservation, bookingToken } */
export const createReservation = (booking) => api.post('/reservations', booking);

/** Pays with the booking token from createReservation. → the paid reservation */
export const payReservation = async (id, bookingToken) => (await api.post(`/reservations/${id}/payment`, { bookingToken })).reservation;
