<!--
  "Nieuwe foto toevoegen" on the photo page: a file (jpg, png or webp, max 5 MB) and a description.
  The browser checks what it can first; the server checks again (also the real content of the file).
-->
<script setup>
import { nextTick, ref } from 'vue';
import { uploadPhoto } from '../../api/admin.js';
import AlertBox from '../ui/AlertBox.vue';
import AppIcon from '../ui/AppIcon.vue';

const MAX_BYTES = 5 * 1024 * 1024;

const props = defineProps({ spotId: { type: Number, required: true } });
const emit = defineEmits(['uploaded']);

const fileInput = ref(null);
const altInput = ref(null);
const altText = ref('');
const fieldErrors = ref({});
const error = ref(null);
const busy = ref(false);

async function upload() {
  if (busy.value) return;
  error.value = null;
  const file = fileInput.value.files?.[0];
  const errors = {};
  if (!file) errors.photo = 'Kies eerst een foto.';
  else if (file.size > MAX_BYTES) errors.photo = 'De foto is groter dan 5 MB. Kies een kleinere foto.';
  if (!altText.value.trim()) errors.altText = 'Beschrijf wat er op de foto staat.';
  else if (altText.value.trim().length > 255) errors.altText = 'Maximaal 255 tekens.';
  fieldErrors.value = errors;
  if (Object.keys(errors).length > 0) return focusFirstError();

  busy.value = true;
  try {
    await uploadPhoto(props.spotId, file, altText.value.trim());
    altText.value = '';
    fileInput.value.value = '';
    emit('uploaded');
  } catch (problem) {
    if (problem.code === 'validation_failed') {
      fieldErrors.value = problem.fields;
      return focusFirstError();
    }
    error.value = problem.message;
  } finally {
    busy.value = false;
  }
}

async function focusFirstError() {
  await nextTick();
  (fieldErrors.value.photo ? fileInput : altInput).value?.focus();
}

const describedBy = (field, hint) => [hint, fieldErrors.value[field] ? `${field}-error` : null].filter(Boolean).join(' ') || undefined;
</script>

<template>
  <section class="card upload" aria-labelledby="upload-heading">
    <h2 id="upload-heading">Nieuwe foto toevoegen</h2>
    <form novalidate @submit.prevent="upload">
      <div class="field">
        <label for="file">Foto (jpg, png of webp, maximaal 5 MB)</label>
        <input
          id="file" ref="fileInput" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          :aria-invalid="fieldErrors.photo ? 'true' : undefined" :aria-describedby="describedBy('photo')"
          @change="fieldErrors = {}; error = null"
        />
        <div v-if="fieldErrors.photo" id="photo-error" class="validation-message">{{ fieldErrors.photo }}</div>
      </div>
      <div class="field">
        <label for="new-alt">Wat staat er op de foto?</label>
        <span id="new-alt-hint" class="field__hint">Bijvoorbeeld: "Grasveld met uitzicht op de bomen". Dit wordt voorgelezen aan blinde gasten.</span>
        <input
          id="new-alt" ref="altInput" v-model="altText" type="text" maxlength="255"
          :class="{ invalid: fieldErrors.altText }" :aria-invalid="fieldErrors.altText ? 'true' : undefined"
          :aria-describedby="describedBy('altText', 'new-alt-hint')"
        />
        <div v-if="fieldErrors.altText" id="altText-error" class="validation-message">{{ fieldErrors.altText }}</div>
      </div>

      <div aria-live="assertive">
        <AlertBox v-if="error" kind="error" title="Uploaden lukte niet"><p>{{ error }}</p></AlertBox>
      </div>

      <button type="submit" class="btn" :disabled="busy" :aria-busy="busy ? 'true' : undefined">
        <template v-if="busy"><AppIcon name="loader" /> <span>Bezig met uploaden…</span></template>
        <template v-else><AppIcon name="upload" /> <span>Foto uploaden</span></template>
      </button>
    </form>
  </section>
</template>
