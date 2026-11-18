// The one place where the frontend talks to the API. Every other file uses api.get/post/patch/delete.
//
// - JSON goes in and comes out; a FormData body (photo upload) is sent as a form.
// - The session cookie is sent automatically (same website), the frontend never sees it.
// - Every failure becomes an ApiError with the same fields as the API's error answer
//   (see docs/api.md): status, code, a Dutch message for the user, and messages per form field.

export class ApiError extends Error {
  constructor(status, code, message, fields = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

const NETWORK_ERROR = 'Er is geen verbinding met de website. Controleer je internet en probeer het opnieuw.';
const SERVER_ERROR = 'Er ging iets mis op de server. Probeer het later opnieuw.';

/**
 * @param {string} path  path after /api, e.g. '/spots?type=Camper'
 * @param {{ method?: string, body?: object|FormData, signal?: AbortSignal }} [options]
 * @returns {Promise<any>} the JSON answer, or null for an empty answer (204)
 */
export async function apiRequest(path, { method = 'GET', body, signal } = {}) {
  const isForm = body instanceof FormData;
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: body === undefined || isForm ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      credentials: 'same-origin',
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error; // cancelled on purpose (e.g. the page was left)
    throw new ApiError(0, 'network_error', NETWORK_ERROR);
  }

  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = data?.error;
    throw new ApiError(response.status, error?.code ?? 'server_error', error?.message ?? SERVER_ERROR, error?.fields ?? {});
  }
  return data;
}

export const api = {
  get: (path, options) => apiRequest(path, options),
  post: (path, body, options) => apiRequest(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => apiRequest(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => apiRequest(path, { ...options, method: 'DELETE' }),
};

/** Builds a query string, leaving out empty values: { type: 'Camper', search: '' } → '?type=Camper'. */
export function query(params) {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '');
  return entries.length > 0 ? `?${new URLSearchParams(entries)}` : '';
}
