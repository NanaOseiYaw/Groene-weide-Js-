// Unit tests for the small building blocks: dates, Dutch formatting, prices and the season.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addDays, addMonths, daysBetween, eachNight, firstOfMonth, isIsoDate, todayIn, weekdayFromMonday } from '@groene-weide/shared/dates';
import { validateGuestDetails } from '@groene-weide/shared/validation';
import { euro, formatDate, formatLongDate, formatNights, formatShortDate, reservationNumber } from '@groene-weide/shared/format';
import { dealFor, discountedCents } from '../src/modules/pricing/price-rules.js';
import { createSettings } from '../src/modules/settings/settings.service.js';

describe('dates', () => {
  it('recognises real calendar dates only', () => {
    assert.equal(isIsoDate('2028-02-29'), true); // leap year
    assert.equal(isIsoDate('2027-02-29'), false);
    assert.equal(isIsoDate('2027-13-01'), false);
    assert.equal(isIsoDate('14-07-2027'), false);
    assert.equal(isIsoDate(20270714), false);
  });

  it('adds days across months, years and daylight saving time', () => {
    assert.equal(addDays('2027-03-27', 2), '2027-03-29'); // clocks go forward on 28 March
    assert.equal(addDays('2027-10-30', 2), '2027-11-01');
    assert.equal(addDays('2027-12-31', 1), '2028-01-01');
    assert.equal(addDays('2027-07-14', -14), '2027-06-30');
  });

  it('moves by months like C# AddMonths and knows the weekday', () => {
    assert.equal(addMonths('2027-01-31', 1), '2027-02-28');
    assert.equal(addMonths('2028-01-31', 1), '2028-02-29');
    assert.equal(addMonths('2027-07-14', -7), '2026-12-14');
    assert.equal(addMonths('2027-12-05', 1), '2028-01-05');
    assert.equal(firstOfMonth('2027-07-14'), '2027-07-01');
    assert.equal(weekdayFromMonday('2027-07-12'), 0); // a Monday
    assert.equal(weekdayFromMonday('2027-07-18'), 6); // a Sunday
  });

  it('counts nights from arrival to departure', () => {
    assert.equal(daysBetween('2027-07-14', '2027-07-17'), 3);
    assert.deepEqual([...eachNight('2027-07-30', '2027-08-02')], ['2027-07-30', '2027-07-31', '2027-08-01']);
  });

  it('knows "today" in the campsite time zone, not in UTC', () => {
    // 23:30 UTC on 29 March 2026 is already 30 March in Amsterdam (summer time, UTC+2).
    assert.equal(todayIn('Europe/Amsterdam', new Date('2026-03-29T23:30:00Z')), '2026-03-30');
    assert.equal(todayIn('UTC', new Date('2026-03-29T23:30:00Z')), '2026-03-29');
  });
});

describe('Dutch formatting (same output as Format.cs)', () => {
  it('formats euros without cents when they are zero', () => {
    assert.equal(euro(2500), '€ 25');
    assert.equal(euro(2125), '€ 21,25');
    assert.equal(euro(125000), '€ 1.250');
    assert.equal(euro(0), '€ 0');
  });

  it('formats dates, nights and reservation numbers', () => {
    assert.equal(formatDate('2027-07-12'), '12 juli 2027');
    assert.equal(formatLongDate('2027-07-12'), 'maandag 12 juli 2027');
    assert.equal(formatShortDate('2027-07-12'), '12 jul');
    assert.equal(formatNights(1), '1 nacht');
    assert.equal(formatNights(3), '3 nachten');
    assert.equal(reservationNumber(42), 'GW-00042');
  });
});

describe('price rules', () => {
  it('applies a percentage and rounds to whole cents', () => {
    assert.equal(discountedCents(2500, 20), 2000);
    assert.equal(discountedCents(2500, 15), 2125);
    assert.equal(discountedCents(2999, 33), 2009); // 2009.33 → 2009
    assert.equal(discountedCents(2500, null), 2500);
  });

  it('takes the highest deal that applies to the day and type', () => {
    const deals = [
      { date: '2027-04-13', spotType: null, percentage: 20 },
      { date: '2027-04-13', spotType: 'Safari', percentage: 30 },
      { date: '2027-10-12', spotType: 'TentCaravan', percentage: 15 },
    ];
    assert.equal(dealFor(deals, '2027-04-13', 'Safari'), 30);
    assert.equal(dealFor(deals, '2027-04-13', 'Camper'), 20);
    assert.equal(dealFor(deals, '2027-10-12', 'Camper'), null);
    assert.equal(dealFor(deals, '2027-04-14', 'Camper'), null);
  });
});

describe('season', () => {
  const settings = createSettings({ almostFullThreshold: 3, seasonStart: '04-01', seasonEnd: '10-31' });

  it('is open from 1 April up to and including 31 October', () => {
    assert.equal(settings.isInSeason('2027-03-31'), false);
    assert.equal(settings.isInSeason('2027-04-01'), true);
    assert.equal(settings.isInSeason('2027-10-31'), true);
    assert.equal(settings.isInSeason('2027-11-01'), false);
    assert.equal(settings.seasonText, '1 april t/m 31 oktober');
  });

  it('does not allow a stay that runs through the winter', () => {
    assert.equal(settings.isStayInSeason('2027-10-28', '2027-10-31'), true);
    assert.equal(settings.isStayInSeason('2027-10-30', '2028-04-02'), false);
  });

  it('finds the next opening day', () => {
    assert.equal(settings.nextOpenDay('2027-01-15'), '2027-04-01');
    assert.equal(settings.nextOpenDay('2027-07-15'), '2027-07-15');
    assert.equal(settings.nextOpenDay('2027-11-20'), '2028-04-01');
  });
});

describe('guest details (shared by browser and server)', () => {
  it('accepts correct details and explains every mistake in Dutch', () => {
    assert.deepEqual(validateGuestDetails({ name: 'Familie Jansen', email: 'jansen@example.com', phone: '06 12345678' }), {});
    assert.deepEqual(validateGuestDetails({}), {
      name: 'Vul je naam in.',
      email: 'Vul je e-mailadres in. Daar sturen we de bevestiging naartoe.',
      phone: 'Vul je telefoonnummer in, zodat we je kunnen bellen als dat nodig is.',
    });
    assert.deepEqual(Object.keys(validateGuestDetails({ name: 'x'.repeat(121), email: 'a@b', phone: '12' })), ['name', 'email', 'phone']);
  });
});
