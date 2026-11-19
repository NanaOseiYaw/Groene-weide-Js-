// Dutch texts and icons for the status of a spot on the staff "Plekken" page (port of the helpers in SpotManagement.razor).
// Every status has a colour (CSS class), an icon and a text: never colour alone.

/** Reasons to take a spot out of use: [API value, Dutch text], in the order of the C# enum. */
export const REASONS = Object.freeze([
  ['WetSeason', 'natseizoen'],
  ['Accident', 'ongeluk'],
  ['Maintenance', 'onderhoud'],
]);

const REASON_TEXT = Object.fromEntries(REASONS);

export const reasonText = (reason) => REASON_TEXT[reason] ?? 'onderhoud';

/** spot: { status, reservedBy, unavailableReason } from GET /api/admin/spots */
export function statusText(spot) {
  switch (spot.status) {
    case 'Unavailable': return `niet beschikbaar: ${spot.unavailableReason ? reasonText(spot.unavailableReason) : 'geen reden'}`;
    case 'Reserved': return `gereserveerd: ${spot.reservedBy}`;
    case 'Held': return 'vastgehouden';
    default: return 'vrij';
  }
}

export const statusIcon = (status) => ({ Unavailable: 'ban', Reserved: 'occupied', Held: 'flag' })[status] ?? 'check';

/** CSS modifier: "Free" → "free", "Unavailable" → "unavailable". */
export const statusClass = (status) => status.toLowerCase();
