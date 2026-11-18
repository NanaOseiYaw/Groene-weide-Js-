// Who is signed in (staff only; guests never sign in).
// The session itself is an HttpOnly cookie that JavaScript cannot read; this store only keeps
// the name and role the API returns, so the menu and the router guard know what to show.
import { readonly, ref } from 'vue';
import { ApiError } from '../api/http.js';
import { getSignedInStaff, login, logout } from '../api/auth.js';

const staff = ref(null);
let checking = null;

export function useAuth() {
  return {
    /** { id, name, email, role } or null. */
    staff: readonly(staff),

    /** Asks the server once whether this browser is signed in (the router guard waits for it). */
    ensureChecked() {
      checking ??= getSignedInStaff()
        .then((signedIn) => { staff.value = signedIn; })
        .catch((error) => {
          staff.value = null;
          if (!(error instanceof ApiError) || error.status !== 401) checking = null; // e.g. offline: ask again later
        });
      return checking;
    },

    async signIn(credentials) {
      staff.value = await login(credentials);
      checking = Promise.resolve();
    },

    async signOut() {
      try {
        await logout();
      } finally {
        staff.value = null;
        checking = Promise.resolve();
      }
    },
  };
}
