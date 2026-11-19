// Dummy data for development: the same layout as the real campsite (Data/Seed.cs in the C# project).
//   - 60 spots: T01–T40 tent/caravan (T37–T40 are held reserve tents), C01–C12 camper, S1–S8 safari tent
//   - placeholder photo rows (no file: guests see "Foto volgt")
//   - test reservations in the 2027 season, so the calendar shows "full" and "almost full"
//   - three deal days, the settings, one (unused) discount code
// It only adds data to empty tables, so running it twice changes nothing.
// It creates NO staff accounts: those are made with "npm run create-staff" (phase 3).
// No real personal data: every name and e-mail address below is made up.

const SETTINGS = [
  ['almost_full_threshold', '3'],
  ['season_start', '04-01'],
  ['season_end', '10-31'],
];

const DEAL_DAYS = [
  { date: '2027-04-13', spotType: null, percentage: 20 },
  { date: '2027-04-14', spotType: null, percentage: 20 },
  { date: '2027-10-12', spotType: 'TentCaravan', percentage: 15 },
];

/**
 * Fills empty tables with dummy data.
 * @returns {{ seeded: boolean }} seeded = false when there were already spots
 */
export function seedDatabase(db) {
  return db.transaction(() => {
    const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)');
    for (const [key, value] of SETTINGS) insertSetting.run(key, value);

    if (db.prepare('SELECT COUNT(*) FROM spots').pluck().get() > 0) {
      return { seeded: false };
    }

    const insertSpot = db.prepare(`
      INSERT INTO spots (name, type, field_name, description, capacity, price_per_night_cents,
                         distance_toilet_m, distance_pool_m, amenities, is_held)
      VALUES (@name, @type, @fieldName, @description, @capacity, @pricePerNightCents,
              @distanceToiletM, @distancePoolM, @amenities, @isHeld)`);
    const spotIds = new Map();
    for (const spot of createSpots()) {
      const { lastInsertRowid } = insertSpot.run({ ...spot, amenities: JSON.stringify(spot.amenities), isHeld: spot.isHeld ? 1 : 0 });
      spotIds.set(spot.name, Number(lastInsertRowid));
    }

    const insertPhoto = db.prepare('INSERT INTO spot_photos (spot_id, filename, alt_text, sort_order) VALUES (?, ?, ?, ?)');
    for (const photo of createPlaceholderPhotos()) {
      insertPhoto.run(spotIds.get(photo.spot), photo.filename, photo.altText, photo.sortOrder);
    }

    const insertReservation = db.prepare(`
      INSERT INTO reservations (spot_id, start_date, end_date, guest_name, guest_email, guest_phone,
                               created_by, is_friend_of_bert, total_price_cents, payment_status, notes)
      VALUES (@spotId, @start, @end, @guestName, @guestEmail, @guestPhone,
              @createdBy, @isFriendOfBert, @totalPriceCents, @paymentStatus, @notes)`);
    for (const reservation of createReservations()) {
      insertReservation.run({ ...reservation, spotId: spotIds.get(reservation.spot) });
    }

    const insertDeal = db.prepare('INSERT INTO deal_days (deal_date, spot_type, discount_percentage) VALUES (?, ?, ?)');
    for (const deal of DEAL_DAYS) insertDeal.run(deal.date, deal.spotType, deal.percentage);

    db.prepare(`INSERT INTO discount_codes (code, discount_type, discount_value, target_type)
                VALUES ('VRIENDVANBERT', 'Percentage', 15, 'All')`).run();

    return { seeded: true };
  })();
}

/** 60 spots with the distances from schema.sql. */
function createSpots() {
  const spots = [];

  const tentToilet = [22, 29, 36, 43, 50, 57, 64, 71, 78, 85, 92, 99, 16, 23, 30, 37, 44, 51, 58, 65,
    72, 79, 86, 93, 100, 17, 24, 31, 38, 45, 52, 59, 66, 73, 80, 87, 94, 101, 18, 25];
  for (let i = 1; i <= 40; i++) {
    spots.push({
      name: `T${String(i).padStart(2, '0')}`,
      type: 'TentCaravan',
      fieldName: 'Kampeerveld',
      description: 'Ruime grasplek voor een tent of caravan.',
      capacity: 6,
      pricePerNightCents: 2500,
      distanceToiletM: tentToilet[i - 1],
      distancePoolM: 80 + (i % 20) * 11,
      amenities: tentAmenities(i), // shown to guests, so the words are Dutch
      isHeld: i >= 37, // T37–T40 are reserve tents for staff
    });
  }

  const camperToilet = [29, 38, 47, 56, 65, 74, 83, 22, 31, 40, 49, 58];
  const camperPool = [73, 86, 99, 112, 125, 138, 151, 164, 177, 190, 203, 66];
  for (let i = 1; i <= 12; i++) {
    spots.push({
      name: `C${String(i).padStart(2, '0')}`,
      type: 'Camper',
      fieldName: 'Camperveld',
      description: 'Camperplek met stroom en water.',
      capacity: 4,
      pricePerNightCents: 3000,
      distanceToiletM: camperToilet[i - 1],
      distancePoolM: camperPool[i - 1],
      amenities: ['stroom', 'water'],
      isHeld: false,
    });
  }

  const safariToilet = [33, 41, 49, 57, 65, 73, 31, 39];
  const safariPool = [50, 60, 70, 80, 90, 100, 110, 40];
  for (let i = 1; i <= 8; i++) {
    spots.push({
      name: `S${i}`,
      type: 'Safari',
      fieldName: 'Safariveld',
      description: 'Ingerichte safaritent met bedden en een eigen terras.',
      capacity: 4,
      pricePerNightCents: 7500,
      distanceToiletM: safariToilet[i - 1],
      distancePoolM: safariPool[i - 1],
      amenities: ['stroom', 'bedden', 'terras'],
      isHeld: false,
    });
  }
  return spots;
}

/** Same pattern as schema.sql: always water, with power and shade alternating. */
function tentAmenities(i) {
  switch (i % 6) {
    case 2:
    case 4:
      return ['water', 'stroom'];
    case 3:
      return ['water', 'schaduw'];
    case 0:
      return ['water', 'stroom', 'schaduw'];
    default:
      return ['water'];
  }
}

function createPlaceholderPhotos() {
  return [
    ...['T01', 'C01', 'S1'].map((spot) => ({
      spot, filename: `placeholder_${spot}_1.jpg`, altText: `Overzicht van plek ${spot}`, sortOrder: 1,
    })),
    ...['T01', 'S1'].map((spot) => ({
      spot, filename: `placeholder_${spot}_2.jpg`, altText: `Uitzicht vanaf plek ${spot}`, sortOrder: 2,
    })),
  ];
}

/** Reservations from schema.sql plus extra test guests in 2027. */
function createReservations() {
  // A paid guest booking. The e-mail address is the last word of the name, like the C# seed.
  const guest = (spot, start, end, guestName, totalPriceCents) => ({
    spot, start, end, guestName,
    guestEmail: `${guestName.split(' ').at(-1).toLowerCase()}@example.com`,
    guestPhone: null,
    createdBy: 'Guest',
    isFriendOfBert: 0,
    totalPriceCents,
    paymentStatus: 'Paid',
    notes: null,
  });

  return [
    // From schema.sql
    guest('T01', '2027-07-12', '2027-07-19', 'Familie De Vries', 17500),
    guest('C01', '2027-07-14', '2027-07-17', 'Jansen', 9000),
    {
      spot: 'T37', start: '2027-08-02', end: '2027-08-09', guestName: 'Henk (vriend van Bert)',
      guestEmail: null, guestPhone: '0612345678', createdBy: 'Staff', isFriendOfBert: 1,
      totalPriceCents: 0, paymentStatus: 'Open', notes: 'Telefonisch gereserveerd',
    },
    guest('S1', '2027-08-03', '2027-08-06', 'Bakker', 22500),

    // All 8 safari tents occupied 20–22 July 2027 ("vol")
    ...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => guest(`S${i}`, '2027-07-20', '2027-07-23', `Testgast Safari${i}`, 22500)),

    // 6 of the 8 safari tents occupied 23–25 July 2027 ("nog 2 plekken")
    ...[1, 2, 3, 4, 5, 6].map((i) => guest(`S${i}`, '2027-07-23', '2027-07-26', `Testgast Zomer${i}`, 22500)),

    // A few guests in April 2027 for the daily overview
    guest('T05', '2027-04-10', '2027-04-13', 'Testgast Pasen', 7500),
    guest('C03', '2027-04-13', '2027-04-15', 'Testgast Lente', 6000),
  ];
}
