// Moves keyboard and screen reader focus to the heading of a booking step when it appears
// (port of StepBase.cs), so users of a screen reader hear that a new step started.
// Not when the booking page first opens: then the page heading already gets focus.
//
//   const heading = useStepHeading(props.focusHeading);
//   <h2 ref="heading" tabindex="-1">…</h2>
import { onMounted, ref } from 'vue';

export function useStepHeading(shouldFocus) {
  const heading = ref(null);
  onMounted(() => {
    if (shouldFocus) heading.value?.focus();
  });
  return heading;
}
