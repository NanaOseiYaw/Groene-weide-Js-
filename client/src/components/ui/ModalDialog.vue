<!--
  Reusable pop-up with the native <dialog> element (e.g. to confirm a choice). Port of ModalDialog.razor.
  Closes with Esc, with a button or by clicking outside; focus returns to the button that opened it.

  Usage:
    <ModalDialog ref="confirm" title="Plek T01 uitzetten" @closed="…"> …buttons… </ModalDialog>
    confirm.value.open()   /   confirm.value.close()
-->
<script setup>
import { ref, useId } from 'vue';
import { useNativeDialog } from '../../composables/useNativeDialog.js';

defineProps({ title: { type: String, required: true } });
const emit = defineEmits(['closed']);

const dialog = ref(null);
const titleId = `dialog-${useId()}`;
const { isOpen, open, close, onClose, onClick } = useNativeDialog(dialog, () => emit('closed'));

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
