/**
 * send initial data to player
 */

import getMe from '../../core/me.js';

export default async (req, res, next) => {
  req.tickRateLimiter(3000);

  const { ip, user, lang } = req;
  /* trigger timestamp updates */
  if (user) {
    user.touch(ip.ipString);
  }
  ip.touch();

  try {
    const userdata = await getMe(user, ip, lang);
    res.json(userdata);
  } catch (error) {
    next(error);
  }
};
