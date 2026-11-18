<!--
  Reusable pop-up with the native <dialog> element (e.g. to confirm a choice).
  Port of ModalDialog.razor + dialog.js. The browser gives us for free: focus stays inside
  the pop-up and Esc closes it. On top of that: clicking outside closes it, and focus returns
  to the button that opened it.

  Usage:
    <ModalDialog ref="confirm" title="Plek T01 uitzetten" @closed="…"> …buttons… </ModalDialog>
    confirm.value.open()   /   confirm.value.close()
-->
<script setup>
import { nextTick, ref, useId } from 'vue';

defineProps({ title: { type: String, required: true } });
const emit = defineEmits(['closed']);

const dialog = ref(null);
const isOpen = ref(false);
const titleId = `dialog-${useId()}`;
let opener = null;

async function open() {
  opener = document.activeElement;
  isOpen.value = true;
  await nextTick(); // the content must be on the page before the dialog opens
  if (!dialog.value.open) dialog.value.showModal();
}

function close() {
  if (dialog.value?.open) dialog.value.close(); // the "close" event below does the rest
}

/** Runs for every way of closing: a button, Esc, or a click outside. */
function onClose() {
  isOpen.value = false;
  if (opener?.isConnected) opener.focus();
  emit('closed');
}

/** A click on the dark backdrop lands on the <dialog> element itself, not on its content. */
function onClick(event) {
  if (event.target === dialog.value) close();
}

defineExpose({ open, close });
</script>

<template>
  <dialog ref="dialog" class="modal" :aria-labelledby="titleId" @close="onClose" @click="onClick">
    <div v-if="isOpen" class="modal__content">
      <h2 :id="titleId">{{ title }}</h2>
      <slot />
    </div>
  </dialog>
</template>
