// Staff sign-in (docs/api.md: /api/auth/*).
import { api } from './http.js';

export const login = async ({ email, password, rememberMe }) => (await api.post('/auth/login', { email, password, rememberMe })).staff;

export const logout = () => api.post('/auth/logout');

export const getSignedInStaff = async () => (await api.get('/auth/me')).staff;
