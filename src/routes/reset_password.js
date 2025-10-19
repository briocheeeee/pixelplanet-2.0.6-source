/**
 * basic admin api
 *
 */

import express from 'express';

import logger from '../core/logger.js';
import getPasswordResetHtml from '../ssr/PasswordReset.jsx';
import { validateEMail } from '../utils/validation.js';
import { checkCode } from '../data/redis/mailCodes.js';
import { getUserByEmail, setPassword } from '../data/sql/User.js';


const router = express.Router();

/*
 * decode form data to req.body
 */
router.use(express.urlencoded({ extended: true }));


/*
 * Check for POST parameters,
 * if invalid password is given, ignore it and go to next
 */
router.post('/', async (req, res) => {
  req.tickRateLimiter(10000);

  const {
    pass, passconf, code, name: email,
  } = req.body;
  const { lang } = req;
  const { t } = req.ttag;

  if (!pass || !passconf || !code) {
    const html = getPasswordResetHtml(
      null,
      null,
      lang,
      t`You sent an empty password or invalid data :(`,
    );
    res.status(400).send(html);
    return;
  }

  const ret = await checkCode(email, code);
  if (!ret) {
    const html = getPasswordResetHtml(
      null,
      null,
      lang,
      t`This password-reset link isn't valid anymore :(`,
    );
    res.status(401).send(html);
    return;
  }

  if (pass !== passconf) {
    const html = getPasswordResetHtml(
      null,
      null,
      lang,
      t`Your passwords do not match :(`,
    );
    res.status(400).send(html);
    return;
  }

  // set password
  const userdata = await getUserByEmail(email);
  if (!userdata) {
    // eslint-disable-next-line max-len
    logger.error(`${email} from PasswordReset page does not exist in database`);
    const html = getPasswordResetHtml(
      null,
      null,
      lang,
      t`User doesn't exist in our database :(`,
    );
    res.status(400).send(html);
    return;
  }
  await setPassword(userdata.id, pass);

  logger.info(`Changed password of ${email} via password reset form`);
  const html = getPasswordResetHtml(
    null,
    null,
    lang,
    t`Password successfully changed.`,
  );
  res.status(200).send(html);
});


/*
 * Check GET parameters for action to execute
 */
router.get('/', async (req, res) => {
  const { email, token } = req.query;
  const { lang } = req;
  const { t } = req.ttag;

  if (!token) {
    const html = getPasswordResetHtml(
      null,
      null,
      lang,
      t`Invalid url :( Please check your mail again.`,
    );
    res.status(400).send(html);
    return;
  }

  const error = validateEMail(email);
  if (error) {
    const html = getPasswordResetHtml(
      null,
      null,
      lang,
      error,
    );
    res.status(401).send(html);
    return;
  }

  const html = getPasswordResetHtml(email, token, lang);
  res.status(200).send(html);
});

export default router;
