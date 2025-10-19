/*
 * local login with mail / name and password
 */
import logger from '../../../core/logger.js';
import { getUsersByNameOrEmail } from '../../../data/sql/User.js';
import { compareToHash } from '../../../utils/hash.js';

import getMe from '../../../core/me.js';
import { openSession } from '../../../middleware/session.js';

export default async (req, res) => {
  const { nameoremail, password } = req.body;
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
