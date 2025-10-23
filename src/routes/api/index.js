import express from 'express';

import { verifySession, ensureLoggedIn } from '../../middleware/session.js';
import originGuard from '../../middleware/originGuard.js';

import me from './me.js';
import auth from './auth/index.js';
import chatHistory from './chathistory.js';
import startDm from './startdm.js';
import leaveChan from './leavechan.js';
import block from './block.js';
import blockdm from './blockdm.js';
import privatize from './privatize.js';
import modtools from './modtools.js';
import baninfo from './baninfo.js';
import getiid from './getiid.js';
import shards from './shards.js';
import profile from './profile.js';
import userprofile from './userprofile.js';
import banme from './banme.js';
import avatar from './avatar.js';
import announce from './announce.js';
import factions from './factions/index.js';

const router = express.Router();

// set cache-control
router.use((req, res, next) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Expires: '0',
  });
  next();
});

router.use(express.json());

// routes that don't need a user
router.get('/shards', shards);

router.get('/getiid', getiid);

/*
 * get user session if available
 */
router.use(verifySession);

router.use(originGuard);

router.get('/chathistory', chatHistory);

router.get('/baninfo', baninfo);

router.post('/banme', banme);

router.use((req, res, next) => {
  if (req.path.startsWith('/modtools')) {
    next();
    return;
  }
  req.tickRateLimiter(3000);
  next();
});

router.get('/me', me);

router.use('/auth', auth);

router.use('/factions', factions);
router.get('/user/profile', userprofile);

/*
 * only with session
 */
router.use(ensureLoggedIn);

router.use('/modtools', modtools);
router.use('/announce', announce);

router.get('/profile', profile);

router.post('/startdm', startDm);

router.post('/leavechan', leaveChan);

router.post('/block', block);

router.post('/blockdm', blockdm);

router.post('/privatize', privatize);

router.use('/avatar', avatar);

/*
 * error handling
 */
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  res.status(err.status || 400).json({
    errors: [err.message],
  });
});

export default router;
