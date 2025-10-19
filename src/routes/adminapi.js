import express from 'express';

import logger from '../core/logger.js';
import { USERLVL } from '../data/sql/index.js';
import { getUsersByNameOrEmail, findUserById } from '../data/sql/User.js';
import { getBanInfos, parseListOfBans } from '../data/sql/Ban.js';
import { compareToHash } from '../utils/hash.js';
import { APISOCKET_KEY } from '../core/config.js';

const router = express.Router();

/*
 * Need APISOCKETKEY to access
 */
router.use(async (req, res, next) => {
  const { headers } = req;
  if (!headers.authorization
    || !APISOCKET_KEY
    || headers.authorization !== `Bearer ${APISOCKET_KEY}`) {
    logger.warn(`API adminapi request from ${req.ip.ipString} rejected`);
    res.status(401);
    res.json({
      success: false,
      errors: ['No or invalid authorization header'],
    });
    return;
  }
  next();
});

router.use(express.json());

/*
 * check login credentials
 * useful for 3rd party login
 */
router.post('/checklogin', async (req, res) => {
  const errors = [];

  const { password } = req.body;
  if (!password) {
    errors.push('No password given');
  }

  let users;
  if (req.body.name || req.body.email) {
    users = await getUsersByNameOrEmail(req.body.name, req.body.email);
  } else if (req.body.id) {
    users = [await findUserById(req.body.id)];
  } else {
    errors.push('No name or email or idgiven');
  }

  if (errors.length) {
    res.status(400);
    res.json({
      success: false,
      errors,
    });
    return;
  }

  if (!users) {
    res.json({
      success: false,
      // eslint-disable-next-line max-len
      errors: [`User ${req.body.name}, ${req.body.email}, ${req.body.id} could not be fetched`],
    });
    return;
  }

  const user = users.find((u) => compareToHash(password, u.password));
  if (!user) {
    logger.info(
      `ADMINAPI: User ${user.name} / ${user.id} entered wrong password`,
    );
    res.json({
      success: false,
      errors: [`Password wrong for user ${user.name} / ${user.id}`],
    });
    return;
  }

  logger.info(`ADMINAPI: User ${user.name} / ${user.id} got logged in`);
  res.json({
    success: true,
    userdata: {
      id: user.id,
      name: user.name,
      verified: user.userlvl >= USERLVL.VERIFIED,
    },
  });
});

/*
 * get user data
 */
router.post('/userdata', async (req, res) => {
  const { id } = req.body;
  if (!id) {
    res.status(400);
    res.json({
      success: false,
      errors: ['No id given'],
    });
    return;
  }
  const user = await findUserById(id);
  if (!user) {
    res.json({
      success: false,
      errors: ['No such user'],
    });
    return;
  }

  const bans = await getBanInfos(null, user.id, null, null);
  const [isBanned, isMuted, banRecheckTs] = parseListOfBans(bans);

  res.json({
    success: true,
    userdata: {
      id: user.id,
      name: user.name,
      verified: user.userlvl >= USERLVL.VERIFIED,
      /*
       * NOTE:I f you use those values, you also have to adhere to
       * socketEvent.reloadUser(userId) and periodically recheck. Otherwise
       * you go outdated
       */
      isBanned,
      isMuted,
      banRecheckTs,
    },
  });
});

export default router;
