import Sequelize, { QueryTypes, DataTypes } from 'sequelize';

import sequelize, { nestQuery } from './sequelize.js';
import { generateToken, generateTokenHash } from '../../utils/hash.js';
import { HOUR, CHANNEL_TYPES, USERLVL } from '../../core/constants.js';
import { ADMIN_IDS } from '../../core/config.js';

const Session = sequelize.define('Session', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  uid: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  token: {
    type: DataTypes.CHAR(38),
    allowNull: false,
    unique: 'token',
  },

  expires: {
    type: DataTypes.DATE,
  },
});

/**
 * create session for a user
 * @param uid id of user
 * @param durationHours how long session is valid in hours or null for permanent
 * @param ip ip to store in the session
 * @return null | token session token
 */
export async function createSession(uid, durationHours, ip = null) {
  if (durationHours !== null && !durationHours) {
    /*
     * if we have a duration of 0, which would be a cookie that deletes on
     * browser close, we still store it for 30 days, cause we don't know when
     * a browser closes
     */
    durationHours = 720;
  }

  try {
    /* limit the amount of open sessions a user can have */
    const openSessions = await Session.count({ where: { uid } });
    if (openSessions > 100) {
      await sequelize.query(
        `DELETE t FROM Sessions t JOIN (
  SELECT id FROM Sessions WHERE uid = :uid ORDER BY id ASC LIMIT 10
) AS oldest ON t.id = oldest.id`, {
          replacements: { uid },
          raw: true,
          type: QueryTypes.DELETE,
        });
    }

    const token = generateToken();
    const createOptions = {
      uid,
      token: generateTokenHash(token),
      expires: durationHours && new Date(Date.now() + durationHours * HOUR),
    };
    if (ip) {
      /*
       * we have to make user that IP is loaded into SQL, before we tell
       * createSession to use it
       */
      await ip.getAllowance();
      createOptions.ip = Sequelize.fn('IP_TO_BIN', ip.ipString);
    }
    const session = await Session.create(createOptions, { raw: true });
    if (session) {
      return token;
    }
  } catch (error) {
    console.error(`SQL Error on createSession: ${error.message}`);
  }
  return null;
}

/**
 * remove session
 * @param token
 * @return boolean success
 */
export async function removeSession(token) {
  if (!token) {
    return false;
  }
  try {
    const count = await Session.destroy({
      where: { token: generateTokenHash(token) },
    });
    return count !== 0;
  } catch (error) {
    console.error(`SQL Error on removeSession: ${error.message}`);
  }
  return false;
}

/**
 * resolve a session for a given token
 * @param token
 * @return null | {
 *   id,
 *   name,
 *   password,
 *   userlvl,
 *   flags,
 *   lastSeen,
 *   createdAt,
 *   blocked: [ { id, name }, ...],
 *   bans: [ { expires, flags }, ... ],
 *   channels: {
 *     cid: [ name, type, lastTs, [dmuid] ],
 *     ...
 *   },
 * }
 */
export async function resolveSession(token) {
  if (!token) {
    return null;
  }
  try {
    /*
     * CURRENT STATUS:
     * Resolving a session takes two round-trip-times of:
     *  1 + 3 queries if User has any DM chat channels associated
     *  1 + 2 queries otherwise
     * Consider that in api/me we also get redis ranks after resolving session,
     * making a api/me call have three round-trips.
     * Resolving IP intel (whois, proxycheck) is in parallel to resolving the
     * session and takes longer than two sql round-trips if it has to be
     * fetched. Therefore session resolving isn't the largest issue in case of
     * a DDoS with unique IPs.
     */

    /* eslint-disable max-len */

    let user = await sequelize.query(
      `SELECT u.id, u.name, u.username, u.password, u.userlvl, u.flags, u.lastSeen, u.createdAt, u.avatar,
c.id AS 'channels.cid', c.name AS 'channels.name', c.\`type\` AS 'channels.type', c.lastMessage AS 'channels.lastDate', ucm.lastRead AS 'channels.lastReadDate' FROM Users u
  INNER JOIN Sessions s ON s.uid = u.id
  LEFT JOIN UserChannels ucm ON ucm.uid = u.id
  LEFT JOIN Channels c ON c.id = ucm.cid
WHERE s.token = :token AND (s.expires > NOW() OR s.expires IS NULL)`, {
        replacements: { token: generateTokenHash(token) },
        raw: true,
        type: QueryTypes.SELECT,
      });
    /*
     * {
     *   id, name, password, userlvl, flags, lastSeen, createdAt,
     *   channels: [{
     *     cid, name, type, lastDate,
     *   }, ...]
     * }
     */
    user = nestQuery(user);

    if (!user) {
      return null;
    }
    const promises = [];
    const userId = user.id;

    /* set ADMIN */
    if (ADMIN_IDS.includes(userId)) {
      user.userlvl = USERLVL.ADMIN;
    }

    /* get info to DM channels */
    const dmChannelIds = user.channels.filter(
      ({ type }) => type === CHANNEL_TYPES.DM,
    ).map(({ cid }) => cid);
    if (dmChannelIds.length) {
      promises.push(sequelize.query(
        `SELECT uc.cid, dmu.id AS 'dmuid', dmu.name AS 'dmname' FROM UserChannels uc
    INNER JOIN Users dmu ON dmu.id = uc.uid
  WHERE dmu.id != ? AND uc.cid IN (?)`, {
          replacements: [userId, dmChannelIds],
          raw: true,
          type: QueryTypes.SELECT,
        }));
    } else {
      promises.push([]);
    }

    /* get blocked users */
    promises.push(sequelize.query(
      `SELECT bu.id, bu.name FROM UserBlocks ub
  INNER JOIN Users bu ON bu.id = ub.buid
WHERE ub.uid = ?`, {
        replacements: [userId],
        raw: true,
        type: QueryTypes.SELECT,
      }));

    /* get bans applying on user id or tpid */
    promises.push(sequelize.query(
      `SELECT b.expires, b.flags FROM Bans b WHERE b.id IN (
  SELECT DISTINCT b.id FROM (
    SELECT ub.bid AS id FROM UserBans ub WHERE ub.uid = ?
    UNION ALL
    SELECT tb.bid AS id FROM ThreePIDBans tb INNER JOIN ThreePIDs t ON tb.tid = t.id WHERE t.uid = ?
  ) AS b
) AND (b.expires > NOW() OR b.expires IS NULL)`, {
        replacements: [userId, userId],
        raw: true,
        type: QueryTypes.SELECT,
      }));

    /* eslint-enable max-len */

    const [dmChannels, blocked, bans] = await Promise.all(promises);

    /*
     * dmChannels:
     *   [{ cid, dmuid, dmname }, ...]
     * user.channels:
     *   [{ cid, name, type, lastDate, lastReadDate }, ...]
     * target user.channels:
     *   { cid: [ name, type, lastTs, [dmuid]], ... }
     */
    if (user.channels.length) {
      const { channels } = user;
      user.channels = {};
      let i = channels.length;
      while (i > 0) {
        i -= 1;
        const { cid, name, type, lastDate } = channels[i];
        const channel = [name, type, lastDate.getTime()];
        if (type === CHANNEL_TYPES.DM) {
          const dmChannel = dmChannels.find(({ cid: dmcid }) => dmcid === cid);
          if (!dmChannel) {
            console.error(
              // eslint-disable-next-line max-len
              `Session Error: User ${userId} has DM channel ${cid} but no other use associated`,
            );
            continue;
          }
          const { dmuid, dmname } = dmChannel;
          channel.push(dmuid);
          channel[0] = dmname;
        }
        user.channels[cid] = channel;
      }
    }

    /*
     * [{ id, name }]
     */
    user.blocked = blocked;

    /*
     * [{ expires, flags }]
     */
    user.bans = bans;

    return user;
  } catch (error) {
    console.error(`SQL Error on resolveSession: ${error.message}`);
  }
  return null;
}

export default Session;
