<!--
  Staff sign-in. Port of Login.razor: same texts, same checks, same messages.
  There is no registration page; accounts are made with "npm run create-staff".
-->
<script setup>
import { computed, nextTick, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AlertBox from '../../components/ui/AlertBox.vue';
import AppIcon from '../../components/ui/AppIcon.vue';
import { useAuth } from '../../stores/auth.js';

const route = useRoute();
const router = useRouter();
const auth = useAuth();

const form = reactive({ email: '', password: '', rememberMe: false });
const fieldErrors = ref({});
const error = ref(null);
const lockedOut = ref(false);
const busy = ref(false);
const emailInput = ref(null);
const passwordInput = ref(null);

const loggedOut = computed(() => route.query.loggedOut === '1');

async function submit() {
  if (busy.value) return;
  error.value = null;
  lockedOut.value = false;
  fieldErrors.value = {};
  if (!form.email.trim()) fieldErrors.value.email = 'Vul je e-mailadres in.';
  if (!form.password) fieldErrors.value.password = 'Vul je wachtwoord in.';
  if (Object.keys(fieldErrors.value).length > 0) return focusFirstError();

  busy.value = true;
  try {
    await auth.signIn({ email: form.email.trim(), password: form.password, rememberMe: form.rememberMe });
    router.replace(safeReturnUrl(route.query.returnUrl));
  } catch (problem) {
    form.password = '';
    lockedOut.value = problem.code === 'locked_out';
    if (problem.code === 'validation_failed') {
      fieldErrors.value = problem.fields;
      focusFirstError();
    } else {
      error.value = problem.message;
    }
  } finally {
    busy.value = false;
  }
}

async function focusFirstError() {
  await nextTick();
  (fieldErrors.value.email ? emailInput : passwordInput).value?.focus();
}

/** Only go back to a page on this website after signing in (no "open redirect"). */
function safeReturnUrl(url) {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\') && !url.startsWith('/account')
    ? url
    : '/admin';
}
</script>

<template>
  <div class="login">
    <h1>Inloggen voor medewerkers</h1>

    <AlertBox v-if="loggedOut && !error" kind="success"><p>Je bent uitgelogd.</p></AlertBox>
    <AlertBox v-if="error" :kind="lockedOut ? 'warning' : 'error'"><p>{{ error }}</p></AlertBox>

    <form novalidate @submit.prevent="submit">
      <div class="field">
        <label for="email">E-mailadres</label>
        <input
          id="email"
          ref="emailInput"
          v-model="form.email"
          type="email"
          autocomplete="username"
          :class="{ invalid: fieldErrors.email }"
          :aria-invalid="fieldErrors.email ? 'true' : undefined"
          :aria-describedby="fieldErrors.email ? 'email-error' : undefined"
        />
        <div v-if="fieldErrors.email" id="email-error" class="validation-message">{{ fieldErrors.email }}</div>
      </div>
      <div class="field">
        <label for="password">Wachtwoord</label>
        <input
          id="password"
          ref="passwordInput"
          v-model="form.password"
          type="password"
          autocomplete="current-password"
          :class="{ invalid: fieldErrors.password }"
          :aria-invalid="fieldErrors.password ? 'true' : undefined"
          :aria-describedby="fieldErrors.password ? 'password-error' : undefined"
        />
        <div v-if="fieldErrors.password" id="password-error" class="validation-message">{{ fieldErrors.password }}</div>
      </div>
      <div class="check-field">
        <input id="remember-me" v-model="form.rememberMe" type="checkbox" />
        <label class="checkbox" for="remember-me">Onthoud mij 30 dagen</label>
      </div>

      <button type="submit" class="btn btn--large btn--block" :aria-busy="busy ? 'true' : undefined" :disabled="busy">
        <AppIcon name="lock" /> {{ busy ? 'Bezig met inloggen…' : 'Inloggen' }}
      </button>
    </form>
  </div>
</template>
