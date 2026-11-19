<!--
  Staff: manage the photos of each spot (upload, alt text, order, delete). Port of PhotoManagement.razor.
  Guests see these photos in the pop-up of a spot; a spot without photos shows "Foto volgt".
-->
<script setup>
import { computed, nextTick, onMounted, ref } from 'vue';
import { deletePhoto, getPhotos, getSpotOverview, movePhoto, updatePhotoAltText } from '../../api/admin.js';
import PhotoUpload from '../../components/admin/PhotoUpload.vue';
import AlertBox from '../../components/ui/AlertBox.vue';
import AppIcon from '../../components/ui/AppIcon.vue';
import EmptyState from '../../components/ui/EmptyState.vue';
import LoadingState from '../../components/ui/LoadingState.vue';
import ModalDialog from '../../components/ui/ModalDialog.vue';

const spots = ref([]);
const spotId = ref(0);
const photos = ref(null);
const message = ref(null);
const messageIsError = ref(false);
const toDelete = ref(null);
const deleteDialog = ref(null);
const messageBox = ref(null);
const busy = ref(false);
let loadCounter = 0;

const spotName = computed(() => spots.value.find((s) => s.id === spotId.value)?.name ?? '');

onMounted(async () => {
  try {
    // The spot overview has every spot (id and name) in field order; that is all the list needs.
    spots.value = (await getSpotOverview()).map(({ id, name }) => ({ id, name }));
  } catch (problem) {
    show(problem.message, true);
  }
});

async function loadPhotos() {
  const thisLoad = ++loadCounter;
  if (spotId.value === 0) {
    photos.value = null;
    return;
  }
  try {
    const loaded = await getPhotos(spotId.value);
    if (thisLoad === loadCounter) photos.value = loaded;
  } catch (problem) {
    if (thisLoad === loadCounter) show(problem.message, true);
  }
}

function spotChanged() {
  photos.value = null;
  message.value = null;
  loadPhotos();
}

async function saveAltText(photo, event) {
  try {
    await updatePhotoAltText(photo.id, event.target.value);
    show('De beschrijving is opgeslagen.', false);
  } catch (problem) {
    show(problem.message, true);
  }
  await loadPhotos();
}

/** Earlier (-1) or later (1). Afterwards the focus stays on the same photo's button, which has moved. */
async function move(photo, direction) {
  try {
    await movePhoto(photo.id, direction);
  } catch (problem) {
    show(problem.message, true);
  }
  await loadPhotos();
  await nextTick();
  // At the top "Eerder" is disabled (and at the bottom "Later"), so then take the other button.
  const same = document.getElementById(`move-${direction}-${photo.id}`);
  (same && !same.disabled ? same : document.getElementById(`move-${-direction}-${photo.id}`))?.focus();
}

function askDelete(photo) {
  toDelete.value = photo;
  deleteDialog.value.open();
}

async function confirmDelete() {
  const photo = toDelete.value;
  if (!photo || busy.value) return;
  busy.value = true;
  try {
    await deletePhoto(photo.id);
    show('De foto is verwijderd.', false);
  } catch (problem) {
    show(problem.message, true);
  } finally {
    busy.value = false;
  }
  deleteDialog.value.close();
  await loadPhotos();
  // The "Verwijder…" button went with the photo: the message gets the focus.
  await nextTick();
  messageBox.value?.focus();
}

async function uploaded() {
  show('De foto is toegevoegd. Gasten zien hem nu in de pop-up van deze plek.', false);
  await loadPhotos();
}

function show(text, isError) {
  message.value = text;
  messageIsError.value = isError;
}
</script>

<template>
  <h1>Foto's per plek</h1>
  <p>Zet hier echte foto's van de plekken. Gasten zien ze in de pop-up van een plek. Zonder foto zien ze "Foto volgt".</p>

  <div class="field">
    <label for="spot">Plek</label>
    <select id="spot" v-model.number="spotId" @change="spotChanged">
      <option :value="0">Kies een plek</option>
      <option v-for="spot in spots" :key="spot.id" :value="spot.id">{{ spot.name }}</option>
    </select>
  </div>

  <div ref="messageBox" aria-live="polite" tabindex="-1">
    <AlertBox v-if="message" :kind="messageIsError ? 'error' : 'success'"><p>{{ message }}</p></AlertBox>
  </div>

  <template v-if="spotId > 0">
    <h2>Foto's van plek {{ spotName }}</h2>
    <LoadingState v-if="!photos" text="Even geduld, de foto's worden geladen." />
    <template v-else>
      <EmptyState v-if="photos.length === 0" title="Nog geen foto's van deze plek" :image="null">
        <p>Gasten zien nu "Foto volgt". Voeg hieronder een foto toe.</p>
      </EmptyState>
      <ol v-else class="photo-admin">
        <li v-for="(photo, index) in photos" :key="photo.id" class="photo-admin__item">
          <img :src="photo.url" :alt="photo.altText" width="240" height="150" loading="lazy" />
          <div class="photo-admin__fields">
            <label :for="`alt-${photo.id}`">Beschrijving (alt-tekst)</label>
            <input :id="`alt-${photo.id}`" type="text" maxlength="255" :value="photo.altText" @change="saveAltText(photo, $event)" />
            <div class="btn-row">
              <button :id="`move--1-${photo.id}`" type="button" class="btn btn--secondary btn--small" :disabled="index === 0" @click="move(photo, -1)">
                <AppIcon name="arrow-up" /> Eerder
              </button>
              <button :id="`move-1-${photo.id}`" type="button" class="btn btn--secondary btn--small" :disabled="index === photos.length - 1" @click="move(photo, 1)">
                <AppIcon name="arrow-down" /> Later
              </button>
              <button type="button" class="btn btn--secondary btn--small" @click="askDelete(photo)"><AppIcon name="trash" /> Verwijder…</button>
            </div>
          </div>
        </li>
      </ol>
    </template>

    <PhotoUpload :key="spotId" :spot-id="spotId" @uploaded="uploaded" />
  </template>

  <ModalDialog ref="deleteDialog" title="Foto verwijderen" @closed="toDelete = null">
    <template v-if="toDelete">
      <p>De foto "{{ toDelete.altText }}" van plek {{ spotName }} verwijderen? Dit kan niet ongedaan worden gemaakt.</p>
      <div class="btn-row">
        <button type="button" class="btn btn--danger" :disabled="busy" :aria-busy="busy ? 'true' : undefined" @click="confirmDelete">
          Ja, verwijder deze foto
        </button>
        <button type="button" class="btn btn--secondary" @click="deleteDialog.close()">Nee, houden</button>
      </div>
    </template>
  </ModalDialog>
</template>
