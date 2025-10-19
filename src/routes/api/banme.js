/*
 * report that user should be banned
 */

import logger from '../../core/logger.js';
import { ban } from '../../core/ban.js';

async function banme(req, res) {
  req.tickRateLimiter(3000);

  const { body: { code }, ip: { ipString } } = req;

  // eslint-disable-next-line max-len
  logger.info(`AUTOBAN ${code} - ${ipString} of user ${req.user?.id} with ua "${req.headers['user-agent']}"`);

  let reason = 'AUTOBAN';
  let duration = 0;
  if (code === 1) {
    reason = 'Userscript Bot';
    duration = 3600 * 24 * 14;
  /*
   * ignore it for now to collect data manually
   *
  } else if (code === 2) {
    const ua = req.headers['user-agent'];
    if (ua && (ua.includes('Android') || ua.includes('iPhone'))) {
      res.json({
        status: 'nope',
      });
      return;
    }
    reason = 'Captcha Solving Script';
    expires = Date.now() + 1000 * 3600 * 24 * 3;
  */
  } else if (code === 3) {
    reason = 'Proxy Malware detected';
    duration = 3600 * 24 * 14;
  } else {
    res.json({
      status: 'nope',
    });
    return;
  }
  await ban(ipString, req.user?.id, null, false, true, reason, duration);
  res.json({
    status: 'ok',
  });
}

export default banme;
