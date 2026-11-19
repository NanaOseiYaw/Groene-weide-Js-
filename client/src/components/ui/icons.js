// SVG paths of every icon, in one style (2px stroke, round joins, 24×24). Port of Icon.razor.
// No emoji and no icon font. These strings are fixed in the code (never user input),
// which is why AppIcon may insert them with v-html.
export const ICON_PATHS = Object.freeze({
  // Status and alerts
  check: "<path d='M20 6 9 17l-5-5'/>",
  x: "<path d='M18 6 6 18M6 6l12 12'/>",
  alert: "<path d='M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01'/>",
  info: "<circle cx='12' cy='12' r='10'/><path d='M12 16v-4M12 8h.01'/>",
  minus: "<path d='M5 12h14'/>",
  percent: "<path d='M19 5 5 19'/><circle cx='6.5' cy='6.5' r='2.5'/><circle cx='17.5' cy='17.5' r='2.5'/>",
  occupied: "<circle cx='12' cy='12' r='7'/><circle cx='12' cy='12' r='3' fill='currentColor'/>",
  flag: "<path d='M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7'/>",
  ban: "<circle cx='12' cy='12' r='10'/><path d='m4.9 4.9 14.2 14.2'/>",
  'check-circle': "<circle cx='12' cy='12' r='10'/><path d='m9 12 2 2 4-4'/>",
  loader: "<path d='M21 12a9 9 0 1 1-6.2-8.6'/>",

  // Direction and navigation
  'chevron-left': "<path d='m15 18-6-6 6-6'/>",
  'chevron-right': "<path d='m9 18 6-6-6-6'/>",
  'chevron-up': "<path d='m18 15-6-6-6 6'/>",
  'chevron-down': "<path d='m6 9 6 6 6-6'/>",
  sort: "<path d='m7 15 5 5 5-5M7 9l5-5 5 5'/>",
  'arrow-up': "<path d='M12 19V5M5 12l7-7 7 7'/>",
  'arrow-down': "<path d='M12 5v14M19 12l-7 7-7-7'/>",
  arrival: "<path d='M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3'/>",
  departure: "<path d='M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9'/>",

  // Spot type
  tent: "<path d='M3.5 21 14 3M20.5 21 10 3M15.5 21 12 15l-3.5 6M2 21h20'/>",
  camper: "<path d='M3 17V7a2 2 0 0 1 2-2h10l5 5v7H3zM3 11h17M7 5v6'/><circle cx='7.5' cy='17.5' r='2'/><circle cx='16.5' cy='17.5' r='2'/>",
  safari: "<path d='M2 21h20M4 21l8-15 8 15M12 6v15M9 21l3-5 3 5'/>",

  // Amenities and facts
  people: "<path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'/><circle cx='9' cy='7' r='4'/><path d='M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8'/>",
  water: "<path d='M12 2.7 6.3 8.4a8 8 0 1 0 11.4 0z'/>",
  power: "<path d='M13 2 3 14h9l-1 8 10-12h-9l1-8z'/>",
  shade: "<path d='M12 22v-6M5 16h14L12 3z'/>",
  beds: "<path d='M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9'/>",
  terrace: "<circle cx='12' cy='12' r='4'/><path d='M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4'/>",
  pool: "<path d='M2 6c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2c1.3 0 1.9.5 2.5 1M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2c1.3 0 1.9.5 2.5 1M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2c1.3 0 1.9.5 2.5 1'/>",
  toilet: "<path d='M13 4h3a2 2 0 0 1 2 2v14M2 20h3M13 20h9M10 12v.01M13 4.6v16.4l-7-2V3.6z'/>",
  field: "<path d='M2 20h20M5 20v-6M19 20v-6M3 14h18M8 14V9M16 14V9M12 14V6'/>",
  calendar: "<rect x='3' y='4' width='18' height='18' rx='2'/><path d='M16 2v4M8 2v4M3 10h18'/>",
  clock: "<circle cx='12' cy='12' r='10'/><path d='M12 6v6l4 2'/>",
  location: "<path d='M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z'/><circle cx='12' cy='10' r='3'/>",
  euro: "<path d='M4 10h12M4 14h9M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2'/>",

  // Contact and actions
  phone: "<path d='M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z'/>",
  mail: "<rect x='2' y='4' width='20' height='16' rx='2'/><path d='m22 7-10 6L2 7'/>",
  printer: "<path d='M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z'/>",
  upload: "<path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12'/>",
  trash: "<path d='M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'/>",
  photo: "<rect x='3' y='3' width='18' height='18' rx='2'/><circle cx='9' cy='9' r='2'/><path d='m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21'/>",
  refresh: "<path d='M3 12a9 9 0 0 1 9-9 9.8 9.8 0 0 1 6.7 2.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.8 9.8 0 0 1-6.7-2.7L3 16M8 16H3v5'/>",
  search: "<circle cx='11' cy='11' r='8'/><path d='m21 21-4.3-4.3'/>",
  lock: "<rect x='3' y='11' width='18' height='11' rx='2'/><path d='M7 11V7a5 5 0 0 1 10 0v4'/>",
  'sign-out': "<path d='M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9'/>",
  plus: "<path d='M12 5v14M5 12h14'/>",
  list: "<path d='M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01'/>",
  day: "<rect x='3' y='4' width='18' height='18' rx='2'/><path d='M16 2v4M8 2v4M3 10h18M8 15h3v3H8z'/>",
});

/** Icon for an amenity from the database (stored in Dutch: "water", "stroom", …); unknown = check mark. */
export function iconForAmenity(amenity) {
  const icons = { water: 'water', stroom: 'power', schaduw: 'shade', bedden: 'beds', terras: 'terrace' };
  return icons[amenity.toLowerCase()] ?? 'check';
}
