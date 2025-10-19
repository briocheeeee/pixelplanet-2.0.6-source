/**
 * basic mod api
 * is used by ../components/Modtools
 *
 */

import express from 'express';
import fileUpload from 'express-fileupload';

import CanvasCleaner from '../../core/CanvasCleaner.js';
import chatProvider from '../../core/ChatProvider.js';
import { escapeMd } from '../../core/utils.js';
import logger, { modtoolsLogger } from '../../core/logger.js';
import {
  executeIPAction,
  executeIIDAction,
  executeImageAction,
  executeProtAction,
  executeRollback,
  executeCleanerAction,
  executeWatchAction,
  getModList,
  removeMod,
  makeMod,
  executeQuickAction,
} from '../../core/adminfunctions.js';
import { getState } from '../../core/SharedState.js';
import { USERLVL } from '../../data/sql/index.js';


const router = express.Router();

router.use(express.urlencoded({ extended: true }));
/*
 * parse multipart/form-data
 * ordinary fields will be under req.body[name]
 * files will be under req.files[name]
 */
router.use(fileUpload({
  limits: {
    fileSize: 5 * 1024 * 1024,
    fields: 50,
    files: 1,
  },
}));


/*
 * make sure User is logged in and at least Mod
 */
router.use(async (req, res, next) => {
  if (!req.user) {
    logger.warn(
      `MODTOOLS> ${req.ip.ipString} tried to access modtools without login`,
    );
    const { t } = req.ttag;
    next(new Error(t`You are not logged in`));
    return;
  }
  if (req.user.userlvl < USERLVL.MOD) {
    logger.warn(
      `MODTOOLS: ${req.ip.ipString} / ${req.user.id} tried to access modtools`,
    );
    const { t } = req.ttag;
    next(new Error(t`You are not allowed to access this page`));
    return;
  }

  if (!req.body?.cleanerstat) {
    logger.info(
      `MODTOOLS> access ${req.user.name}[${req.user.id}] -  ${req.ip.ipString}`,
    );
  }
  next();
});


/*
 * Post for mod + admin
 */
router.post('/', async (req, res, next) => {
  const aLogger = (text) => {
    const timeString = new Date().toLocaleTimeString();
    // eslint-disable-next-line max-len
    const logText = `@[${escapeMd(req.user.name)}](${req.user.id}) ${text}`;
    modtoolsLogger.info(
      `${timeString} | MODTOOLS> ${logText}`,
    );
    chatProvider.broadcastChatMessage(
      'info',
      logText,
      chatProvider.enChannelId,
      chatProvider.infoUserId,
    );
  };

  const bLogger = (text) => {
    logger.info(
      `MODTOOLS>IID>${req.user.name}[${req.user.id}]> ${text}`,
    );
  };

  try {
    if (req.body.cleanerstat) {
      const ret = CanvasCleaner.reportStatus();
      res.status(200);
      res.json(ret);
      return;
    }
    if (req.body.cleanercancel) {
      const ret = CanvasCleaner.stop();
      res.status(200).send(ret);
      return;
    }
    if (req.body.watchaction) {
      const {
        watchaction, ulcoor, brcoor, time, iid, canvasid, maxrows,
      } = req.body;
      // eslint-disable-next-line max-len
      logger.info(`MODTOOLS>WATCH>${req.user.name}[${req.user.id}]> ${watchaction} ${ulcoor} ${brcoor} ${time} ${iid}`);
      const ret = await executeWatchAction(
        watchaction,
        ulcoor,
        brcoor,
        /* time is interval in ms */
        time,
        iid,
        canvasid,
        maxrows,
      );
      res.status(200).json(ret);
      return;
    }
    if (req.body.iidaction) {
      const {
        iidaction, iid, bid, iidoruser,
        identifiers, reason, time, username,
      } = req.body;
      const ret = await executeIIDAction(
        iidaction,
        iid,
        bid,
        iidoruser,
        identifiers,
        reason,
        time,
        username,
        req.user.id,
        bLogger,
      );
      res.status(200).send(ret);
      return;
    }
    if (req.body.cleaneraction) {
      const {
        cleaneraction, ulcoor, brcoor, canvasid,
      } = req.body;
      const [ret, msg] = await executeCleanerAction(
        cleaneraction,
        ulcoor,
        brcoor,
        canvasid,
        aLogger,
      );
      res.status(ret).send(msg);
      return;
    }
    if (req.body.imageaction) {
      const { imageaction, coords, canvasid } = req.body;
      const [ret, msg] = await executeImageAction(
        imageaction,
        req.files?.image?.data,
        coords,
        canvasid,
        aLogger,
      );
      res.status(ret).send(msg);
      return;
    }
    if (req.body.protaction) {
      const {
        protaction, ulcoor, brcoor, canvasid,
      } = req.body;
      const [ret, msg] = await executeProtAction(
        protaction,
        ulcoor,
        brcoor,
        canvasid,
        aLogger,
      );
      res.status(ret).send(msg);
      return;
    }
    if (req.body.rollbackdate) {
      // rollbackdate is date as YYYYMMdd
      // rollbacktime is time as hhmm
      const {
        rollbackdate, rollbacktime, ulcoor, brcoor, canvasid,
      } = req.body;
      const [ret, msg] = await executeRollback(
        rollbackdate,
        rollbacktime,
        ulcoor,
        brcoor,
        canvasid,
        aLogger,
        (req.user.userlvl >= USERLVL.ADMIN),
      );
      res.status(ret).send(msg);
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
});


/*
 * just admins past here, no Mods
 */
router.use(async (req, res, next) => {
  if (req.user.userlvl < USERLVL.ADMIN) {
    const { t } = req.ttag;
    res.status(403).send(t`Just admins can do that`);
    return;
  }
  next();
});

/*
 * Post just for admin
 */
router.post('/', async (req, res, next) => {
  const aLogger = (text) => {
    logger.info(`ADMIN> ${req.user.name}[${req.user.id}]> ${text}`);
  };

  try {
    if (req.body.ipaction) {
      /*
       * it can also be used for resetting users that got hacked, the naming
       * is old
       */
      const ret = await executeIPAction(
        req.body.ipaction,
        req.body.ip,
        aLogger,
      );
      res.status(200).send(ret);
      return;
    }
    if (req.body.modlist) {
      const ret = await getModList();
      res.status(200);
      res.json(ret);
      return;
    }
    if (req.body.gamestate) {
      const ret = getState();
      res.status(200);
      res.json(ret);
      return;
    }
    if (req.body.remmod) {
      const ret = await removeMod(req.body.remmod);
      res.status(200).send(ret);
      return;
    }
    if (req.body.makemod) {
      const ret = await makeMod(req.body.makemod);
      res.status(200);
      res.json(ret);
      return;
    }
    if (req.body.quickaction) {
      const ret = await executeQuickAction(req.body.quickaction, aLogger);
      res.status(200).send(ret);
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
});

router.use(async (req, res, next) => {
  next(new Error('Invalid request'));
});

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  res.status(400).send(err.message);
  logger.error(
    // eslint-disable-next-line max-len
    `MODTOOLS> ${req.ip.ipString} / ${req.user.id} encountered error on using modtools: ${err.message}`,
  );
});

export default router;
