// Creates a staff account (there is no registration page and no default account).
//
//   npm run create-staff -- "Anita" "anita@voorbeeld.nl" Staff
//   npm run create-staff -- "Bert" "bert@voorbeeld.nl" Admin
//
// The password is asked for twice in the terminal and is not shown while typing.
// It never ends up in the code, in git, in the shell history or in a log; the database only gets a hash.
import { loadConfig, loadEnvFile } from '../src/config.js';
import { openDatabase } from '../src/db/connection.js';
import { migrate } from '../src/db/migrate.js';
import { createStaffUser, findStaffByEmail, ROLES } from '../src/modules/auth/staff-users.service.js';
import { MIN_PASSWORD_LENGTH } from '../src/lib/passwords.js';

const [name, email, role] = process.argv.slice(2);
if (!name || !email || !ROLES.includes(role)) {
  console.log('Gebruik: npm run create-staff -- "Naam" "mail@voorbeeld.nl" Staff|Admin');
  process.exit(1);
}

loadEnvFile();
const config = loadConfig();
const db = openDatabase(config.databasePath);
try {
  migrate(db); // works on a fresh database too, also in production
  if (findStaffByEmail(db, email)) {
    console.log(`Er bestaat al een account met ${email.trim()}.`);
    process.exitCode = 1;
  } else {
    const input = createLineReader();
    const password = await input.readHidden(`Wachtwoord (minimaal ${MIN_PASSWORD_LENGTH} tekens): `);
    const repeated = await input.readHidden('Herhaal het wachtwoord: ');
    input.close();
    if (password !== repeated) {
      console.log('De wachtwoorden zijn niet hetzelfde. Er is geen account gemaakt.');
      process.exitCode = 1;
    } else {
      const user = await createStaffUser(db, { name, email, password, role });
      console.log(`Account gemaakt voor ${user.name} (${user.email}) met de rol ${user.role}.`);
    }
  }
} catch (error) {
  console.log(`Het account kon niet gemaakt worden: ${error.message}`);
  process.exitCode = 1;
} finally {
  db.close();
}

/**
 * Reads answers from the terminal. In a real terminal typing is hidden (no characters shown).
 * When the input is piped in (e.g. from a script), every line is one answer.
 */
function createLineReader() {
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    const lines = [];
    const waiting = [];
    let buffer = '';
    stdin.setEncoding('utf8');
    stdin.on('data', (chunk) => {
      buffer += chunk;
      let index;
      while ((index = buffer.indexOf('\n')) >= 0) {
        lines.push(buffer.slice(0, index).replace(/\r$/, ''));
        buffer = buffer.slice(index + 1);
      }
      while (waiting.length && lines.length) waiting.shift()(lines.shift());
    });
    stdin.on('end', () => {
      if (buffer) lines.push(buffer);
      while (waiting.length) waiting.shift()(lines.shift() ?? '');
    });
    return {
      readHidden(prompt) {
        process.stdout.write(`${prompt}\n`);
        return lines.length ? Promise.resolve(lines.shift()) : new Promise((resolve) => waiting.push(resolve));
      },
      close: () => stdin.pause(),
    };
  }

  return {
    readHidden(prompt) {
      process.stdout.write(prompt);
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf8');
      return new Promise((resolve) => {
        let value = '';
        const onData = (chunk) => {
          for (const char of chunk) {
            if (char === '\r' || char === '\n') {
              stdin.removeListener('data', onData);
              stdin.setRawMode(false);
              stdin.pause();
              process.stdout.write('\n');
              resolve(value);
              return;
            }
            if (char === '\u0003') { // Ctrl+C
              process.stdout.write('\nGestopt. Er is geen account gemaakt.\n');
              process.exit(130);
            }
            if (char === '\u0008' || char === '\u007f') value = value.slice(0, -1); // Backspace
            else if (char >= ' ') value += char;
          }
        };
        stdin.on('data', onData);
      });
    },
    close() {},
  };
}
