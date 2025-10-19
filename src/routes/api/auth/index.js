import express from 'express';

import logger from '../../../core/logger.js';
import passport from '../../../core/passport.js';
import { ensureLoggedIn, openSession } from '../../../middleware/session.js';

import register from './register.js';
import verify from './verify.js';
import local from './local.js';
import logout from './logout.js';
// eslint-disable-next-line camelcase
import get_tpids from './get_tpids.js';
// eslint-disable-next-line camelcase
import remove_tpid from './remove_tpid.js';
// eslint-disable-next-line camelcase
import resend_verify from './resend_verify.js';
// eslint-disable-next-line camelcase
import change_passwd from './change_passwd.js';
// eslint-disable-next-line camelcase
import delete_account from './delete_account.js';
// eslint-disable-next-line camelcase
import change_name from './change_name.js';
// eslint-disable-next-line camelcase
import change_username from './change_username.js';
// eslint-disable-next-line camelcase
import change_mail from './change_mail.js';
// eslint-disable-next-line camelcase
import restore_password from './restore_password.js';

import getHtml from '../../../ssr/RedirectionPage.jsx';

const router = express.Router();

/*
 * third party logon
 */

router.use(passport.initialize());

const openSessionOnReturn = async (req, res) => {
  /* this is NOT a full user instance, only { id, name, password, userlvl } */
  const { user } = req;
  /* openSession() turns req.user into a full user object */
  await openSession(req, res, user.id, 168);
  res.redirect('/');
};

router.get('/facebook', passport.authenticate('facebook',
  { scope: ['email'] }));
router.get('/facebook/return', passport.authenticate('facebook', {
  session: false,
}), openSessionOnReturn);

router.get('/discord', passport.authenticate('discord',
  { scope: ['identify', 'email'] }));
router.get('/discord/return', passport.authenticate('discord', {
  session: false,
}), openSessionOnReturn);

router.get('/google', passport.authenticate('google',
  { scope: ['email', 'profile'] }));
router.get('/google/return', passport.authenticate('google', {
  session: false,
}), openSessionOnReturn);

router.get('/vk', passport.authenticate('vkontakte',
  { scope: ['email'] }));
router.get('/vk/return', passport.authenticate('vkontakte', {
  session: false,
}), openSessionOnReturn);

router.get('/reddit', passport.authenticate('reddit',
  { duration: 'temporary', state: 'foo' }));
router.get('/reddit/return', passport.authenticate('reddit', {
  session: false,
}), openSessionOnReturn);

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  const host = req.ip.getHost();
  logger.info(`Authentication error: ${err.message}`);
  const index = getHtml(
    'OAuth Authentication',
    err.message, host, req.lang,
  );
  res.status(400).send(index);
});

router.get('/verify', verify);

/*
 * JSON APIs
 */

router.post('/restore_password', restore_password);

router.post('/register', register);

router.post('/local', local);

router.use(ensureLoggedIn);

/*
 * require registered user after this point
 */

router.get('/logout', logout);

router.get('/get_tpids', get_tpids);

router.get('/resend_verify', resend_verify);

router.post('/remove_tpid', remove_tpid);

router.post('/change_passwd', change_passwd);

router.post('/change_name', change_name);

router.post('/change_username', change_username);

router.post('/change_mail', change_mail);

router.post('/delete_account', delete_account);



export default router;
