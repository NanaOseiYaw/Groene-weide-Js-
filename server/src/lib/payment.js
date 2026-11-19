// Payment. In the MVP it is simulated: no money changes hands.
// Every payment service has the same shape:
//   await payment.pay({ reservationId, amountCents })  →  { success: true } or { success: false }
// A real provider (iDEAL/Wero via a payment company) comes later with the same shape,
// with its keys in .env.

/** Test mode: always succeeds after a short delay, so the guest sees "Betalen…" for a moment. */
export function createFakePaymentService({ delayMs = 1500 } = {}) {
  return {
    async pay() {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return { success: true };
    },
  };
}
