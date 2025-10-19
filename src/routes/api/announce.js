import express from 'express';

import { USERLVL } from '../../data/sql/index.js';
import { ANNOUNCE_COOLDOWN_WHITELIST } from '../../core/config.js';
import client from '../../data/redis/client.js';
import socketEvents from '../../socket/socketEvents.js';
import { announcementLogger } from '../../core/logger.js';

const router = express.Router();

router.use(express.json());

router.post('/', async (req, res) => {
  const { user } = req;
  const { t } = req.ttag;
  if (!user) {
    res.status(401).json({ errors: ['not authorized'] });
    return;
  }
  if (user.userlvl < USERLVL.ADMIN) {
    res.status(403).json({ errors: [t`Just admins can do that`] });
    return;
  }
  const textRaw = (req.body?.text || '').toString();
  const text = textRaw.trim().slice(0, 500);
  if (!text) {
    res.status(400).json({ errors: [t`Missing announcement text`] });
    return;
  }

  const uId = Number(user.id);
  const isWhitelisted = Number.isFinite(uId) && ANNOUNCE_COOLDOWN_WHITELIST.includes(uId);
  if (!isWhitelisted) {
    const key = `ann:admin:${uId}`;
    const px = 60 * 60 * 1000;
    const ok = await client.set(key, '1', { PX: px, NX: true });
    if (ok !== 'OK') {
      const ttl = await client.pTTL(key);
      const left = (ttl > 0) ? Math.ceil(ttl / 60000) : null;
      const msg = left ? `${t`Please wait`}: ${left} ${t`minutes`}` : t`Please wait`;
      res.status(429).json({ errors: [msg] });
      return;
    }
  }
  const now = Date.now();
  const payload = [text, now, user.name];
  try {
    announcementLogger.info(
      JSON.stringify({ ts: now, adminId: user.id, adminName: user.name, text }),
    );
  } catch (e) {
    // ignore logging errors
  }
  socketEvents.emit('announce', payload);
  res.json({ ok: true });
});

export default router;
