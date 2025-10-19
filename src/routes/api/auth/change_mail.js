/*
 * request mail change
 */

import mailProvider from '../../../core/MailProvider.js';

import logger from '../../../core/logger.js';
import { validateEMail } from '../../../utils/validation.js';
import { compareToHash } from '../../../utils/hash.js';
import { checkMailOverShards } from '../../../utils/intel/index.js';
import { setEmail, getTPIDsOfUser } from '../../../data/sql/ThreePID.js';
import { setUserLvl } from '../../../data/sql/User.js';
import { USERLVL } from '../../../core/constants.js';
import socketEvents from '../../../socket/socketEvents.js';

async function validate(email, t, gettext) {
  const errors = [];

  const mailerror = gettext(validateEMail(email));
  if (mailerror) {
    errors.push(mailerror);
  } else if (await checkMailOverShards(email)) {
    errors.push(t`This email provider is not allowed`);
  }

  return errors;
}

export default async (req, res) => {
  const { email, password } = req.body;
  const { t, gettext } = req.ttag;
  const errors = await validate(email, t, gettext);
  if (errors.length > 0) {
    res.status(400);
    res.json({
      errors,
    });
    return;
  }

  const { user, lang } = req;
  /* remember that we do allow users to not have a password set */
  const currentPassword = user.data.password;
  if (currentPassword && !compareToHash(password, currentPassword)) {
    res.status(400);
    res.json({
      errors: [t`Incorrect password!`],
    });
    return;
  }

  const ret = await setEmail(user.id, email, false);
  if (!ret) {
    res.status(400);
    res.json({
      errors: [t`Mail is already in use!`],
    });
    return;
  }

  const tpids = await getTPIDsOfUser(req.user.id);
  const { userlvl } = user;
  const hasVerified = tpids.some(({ verified }) => verified);
  /* make sure userlvl matches tpids */
  if (!hasVerified && userlvl <= USERLVL.VERIFIED
    && userlvl > USERLVL.REGISTERED
  ) {
    await setUserLvl(user.id, USERLVL.REGISTERED);
    socketEvents.reloadUser(user.id);
  } else if (hasVerified && userlvl === USERLVL.REGISTERED) {
    await setUserLvl(user.id, USERLVL.VERIFIED);
    socketEvents.reloadUser(user.id);
  }

  // eslint-disable-next-line max-len
  logger.info(`AUTH: Changed mail for user ${user.name}(${user.id}) to ${email} by ${req.ip.ipString}`);

  const host = req.ip.getHost();
  mailProvider.sendVerifyMail(email, user.name, host, lang);

  res.json({
    success: true,
  });
};
