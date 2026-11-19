// Text size of the staff section, chosen per person and remembered in this browser.
// The default ("standard", 20px) is already large: the staff section is readable without changing
// anything. "Groot" and "Extra groot" are for days or people that need more; "Kleiner" is for
// whoever prefers more on one screen. Everything in the staff section is in em, so the whole
// layout (buttons, tables, the calendar) grows along. Browser zoom keeps working on top of this.
import { readonly, ref } from 'vue';

export const TEXT_SIZES = Object.freeze([
  { value: 'small', label: 'Kleiner' },
  { value: 'standard', label: 'Standaard' },
  { value: 'large', label: 'Groot' },
  { value: 'xlarge', label: 'Extra groot' },
]);

const STORAGE_KEY = 'gw-text-size';
const DEFAULT = 'standard';
const isKnown = (value) => TEXT_SIZES.some((size) => size.value === value);

function readStored() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isKnown(value) ? value : DEFAULT;
  } catch {
    return DEFAULT; // private window or storage blocked: the default is fine
  }
}

const textSize = ref(readStored());

export function useTextSize() {
  function setTextSize(value) {
    if (!isKnown(value)) return;
    textSize.value = value;
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Not remembered, but it still applies for this visit.
    }
  }
  return { textSize: readonly(textSize), setTextSize };
}
