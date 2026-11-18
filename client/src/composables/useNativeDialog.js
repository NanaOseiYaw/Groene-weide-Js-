// Shared behaviour of every pop-up built on the native <dialog> element (ModalDialog, SpotDialog).
// Port of dialog.js from the C# version. The browser already gives us: focus stays inside the
// pop-up and Esc closes it. This adds: a click outside closes it, and focus goes back to the
// button that opened it.
//
// Usage in a component:
//   const dialog = ref(null);
//   const { isOpen, open, close, onClose, onClick } = useNativeDialog(dialog, () => emit('closed'));
//   <dialog ref="dialog" @close="onClose" @click="onClick"> <div v-if="isOpen">…</div> </dialog>
import { nextTick, ref } from 'vue';

export function useNativeDialog(dialogRef, onClosed = () => {}) {
  const isOpen = ref(false);
  let opener = null;

  async function open() {
    opener = document.activeElement;
    isOpen.value = true;
    await nextTick(); // the content must be on the page before the dialog opens
    if (dialogRef.value && !dialogRef.value.open) dialogRef.value.showModal();
  }

  function close() {
    if (dialogRef.value?.open) dialogRef.value.close(); // the "close" event runs onClose
  }

  /** Runs for every way of closing: a button, Esc, or a click outside. */
  function onClose() {
    isOpen.value = false;
    if (opener?.isConnected) opener.focus();
    onClosed();
  }

  /** A click on the dark backdrop lands on the <dialog> element itself, not on its content. */
  function onClick(event) {
    if (event.target === dialogRef.value) close();
  }

  return { isOpen, open, close, onClose, onClick };
}
