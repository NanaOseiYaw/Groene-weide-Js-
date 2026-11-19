// Public campsite data (docs/api.md: GET /api/campsite and GET /api/spot-types).
import { api } from './http.js';

export const getCampsite = () => api.get('/campsite');

export const getSpotTypes = async () => (await api.get('/spot-types')).spotTypes;
