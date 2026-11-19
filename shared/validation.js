// Rules for guest details, used in two places:
// - in the browser, so the guest sees a mistake straight away
// - on the server, as the real check (the browser can always be bypassed)
// Same rules and Dutch messages as GuestDetailsForm.cs in the C# version.

/** 06 12345678, +31 6 12345678, 012-3456789 … (starts with a digit or +, 10 to 20 characters). */
export const PHONE_PATTERN = /^\+?[0-9][0-9 \-()]{8,18}[0-9]$/;

/** Something@something.something, without spaces. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Checks the guest details of a booking (step 6).
 * @param {{ name?: string, email?: string, phone?: string }} guest  values as typed (trimmed here)
 * @returns {Record<string, string>} a Dutch message per wrong field; empty object when everything is fine
 */
export function validateGuestDetails(guest) {
  const name = (guest.name ?? '').trim();
  const email = (guest.email ?? '').trim();
  const phone = (guest.phone ?? '').trim();
  const fields = {};

  if (!name) fields.name = 'Vul je naam in.';
  else if (name.length > 120) fields.name = 'Je naam mag maximaal 120 tekens lang zijn.';

  if (!email) fields.email = 'Vul je e-mailadres in. Daar sturen we de bevestiging naartoe.';
  else if (email.length > 190) fields.email = 'Dit e-mailadres is te lang.';
  else if (!EMAIL_PATTERN.test(email)) fields.email = 'Dit e-mailadres klopt niet. Bijvoorbeeld: naam@voorbeeld.nl';

  if (!phone) fields.phone = 'Vul je telefoonnummer in, zodat we je kunnen bellen als dat nodig is.';
  else if (!PHONE_PATTERN.test(phone)) fields.phone = 'Dit telefoonnummer klopt niet. Bijvoorbeeld: 06 12345678';

  return fields;
}
