// Sending e-mail to guests. Never to Bert or staff (business rule 7).
//
// Every e-mail sender has the same shape:  await sender.send({ to, subject, text })
// - createLogEmailSender: development. Writes the mail to data/mail/mail.log instead of sending it.
// - createMemoryEmailSender: tests. Keeps the mails in an array.
// A real sender (SMTP, e.g. with nodemailer) can be added later with the same shape,
// with its password in .env, never in the code.
import fs from 'node:fs/promises';
import path from 'node:path';

export function createLogEmailSender({ folder, logger = console }) {
  const file = path.join(folder, 'mail.log');
  let queue = Promise.resolve(); // one write at a time, so two mails never mix in the file

  return {
    send({ to, subject, text }) {
      const entry = [`===== ${new Date().toISOString()} =====`, `Aan: ${to}`, `Onderwerp: ${subject}`, '', text, '', ''].join('\n');
      queue = queue.then(async () => {
        await fs.mkdir(folder, { recursive: true });
        await fs.appendFile(file, entry, 'utf8');
        logger.info(`E-mail "${subject}" written to ${file}`);
      });
      return queue;
    },
  };
}

export function createMemoryEmailSender() {
  const sent = [];
  return {
    sent,
    async send(mail) {
      sent.push(mail);
    },
  };
}
