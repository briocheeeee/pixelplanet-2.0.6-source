/*
 * local login with mail / name and password
 */
import logger from '../../../core/logger.js';
import { getUsersByNameOrEmail } from '../../../data/sql/User.js';
import { compareToHash } from '../../../utils/hash.js';

import getMe from '../../../core/me.js';
import { openSession } from '../../../middleware/session.js';

const ipLoginWindow = new Map();
const idLoginWindow = new Map();

export default async (req, res) => {
  const ipString = req.ip?.ipString || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = ipLoginWindow.get(ipString) || { count: 0, ts: now, blockUntil: 0 };
  if (entry.blockUntil && now < entry.blockUntil) {
    const { t } = req.ttag;
    res.status(429).json({ errors: [t`Too many login attempts, try again later`] });
    return;
  }
  const { nameoremail, password } = req.body;
  const ident = (nameoremail ?? '').toString().toLowerCase().trim().slice(0, 200);
  const idEntry = idLoginWindow.get(ident) || { count: 0, ts: now, blockUntil: 0 };
  if (idEntry.blockUntil && now < idEntry.blockUntil) {
    const { t } = req.ttag;
    res.status(429).json({ errors: [t`Too many login attempts for this account, try again later`] });
    return;
  }
  const { t } = req.ttag;

  const users = await getUsersByNameOrEmail(nameoremail, null);

  try {
    if (!users || !users.length) {
      throw new Error(t`Name or Email does not exist!`);
    }
    const user = users.find((u) => compareToHash(password, u.password));
    if (!user) {
      if (users.find((u) => u.password === 'hacked')) {
        throw new Error(
          // eslint-disable-next-line max-len
          t`This email / password combination got hacked and leaked. To protect this account, the password has been reset. Please use the "Forgot my password" function below to set a new password. In the future, consider not installing malware, Thank You.`,
        );
      }
      entry.count = (now - entry.ts > 10 * 60 * 1000) ? 1 : entry.count + 1;
      entry.ts = (now - entry.ts > 10 * 60 * 1000) ? now : entry.ts;
      if (entry.count >= 6) {
        entry.blockUntil = now + 15 * 60 * 1000;
        logger.warn(`login throttle ip block ${ipString}`);
      }
      ipLoginWindow.set(ipString, entry);

      idEntry.count = (now - idEntry.ts > 10 * 60 * 1000) ? 1 : idEntry.count + 1;
      idEntry.ts = (now - idEntry.ts > 10 * 60 * 1000) ? now : idEntry.ts;
      if (idEntry.count >= 6) {
        idEntry.blockUntil = now + 15 * 60 * 1000;
        logger.warn(`login throttle id block ${ident}`);
      }
      idLoginWindow.set(ident, idEntry);
      throw new Error('Incorrect password!');
    }

    /* session duration, null for permanent */
    let { durationsel: durationHours } = req.body;
    if (durationHours === 'forever') {
      durationHours = null;
    } else {
      durationHours = parseInt(durationHours, 10);
      if (Number.isNaN(durationHours)) {
        // default to 30 days if gibberish
        durationHours = 720;
      }
    }

    /* openSession() turns req.user into a full user object */
    await openSession(req, res, user.id, durationHours);
    if (ipLoginWindow.has(ipString)) ipLoginWindow.delete(ipString);
    if (idLoginWindow.has(ident)) idLoginWindow.delete(ident);
    logger.info(`User ${user.id} logged in with mail/password.`);
    const me = await getMe(req.user, req.ip, req.lang);

    res.json({
      success: true,
      me,
    });
  } catch (error) {
    res.status(401).json({
      errors: [error.message],
    });
  }
};
