// Runs in a worker thread with its OWN database connection, like a second server process.
// Waits for the start signal, then tries to book. Used by double-booking.test.js.
import { parentPort, workerData } from 'node:worker_threads';
import { openDatabase } from '../../src/db/connection.js';
import { insertReservationIfFree } from '../../src/modules/reservations/reservations.service.js';

const { file, startSignal, booking, forStaff, guestName } = workerData;
const db = openDatabase(file);

parentPort.postMessage({ ready: true });
Atomics.wait(new Int32Array(startSignal), 0, 0); // all workers start at exactly the same moment

try {
  const id = insertReservationIfFree(db, {
    ...booking,
    forStaff,
    values: { guestName, guestEmail: null, guestPhone: null, createdBy: forStaff ? 'Staff' : 'Guest', isFriendOfBert: 0, notes: null },
  });
  parentPort.postMessage({ ok: true, id });
} catch (error) {
  parentPort.postMessage({ ok: false, code: error.code });
} finally {
  db.close();
}
