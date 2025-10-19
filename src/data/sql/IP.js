import Sequelize, { DataTypes, QueryTypes } from 'sequelize';
import crypto from 'crypto';

import sequelize, { nestQuery } from './sequelize.js';
import ProxyData from './Proxy.js';
import WhoisReferral from './WhoisReferral.js';
import { USE_PROXYCHECK } from '../../core/config.js';

const IP = sequelize.define('IP', {
  /*
   * Store both 32bit IPv4 and first half of 128bit IPv6
   * (only the first 64bit of a v6 is usually assigned
   * to customers by ISPs, the second half is assigned by devices)
   * NOTE:
   * IPv6 addresses in the ::/32 subnet would map to IPv4, which
   * should be no issues, because ::/8 is reserved by IETF
   */
  ip: {
    type: 'VARBINARY(8)',
    primaryKey: true,
  },

  uuid: {
    type: 'BINARY(16)',
    allowNull: false,
    unique: 'uuid',
    defaultValue: () => crypto.randomBytes(16),
  },

  lastSeen: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

/**
 * Get basic values to check if an ip is allows, may throw Error
 * @param ipString ip as string
 * @return {
 *   lastSeen,
 *   isWhitelisted,
 *   isProxy,
 *   bans: [ { expires, flags } ],
 *   country: two letter country code,
 *   whoisExpiresTs: timestamp for when whois expires,
 *   proxyCheckExpiresTs: timestamp for when proxycheck expires,
 * }
 */
export async function getIPAllowance(ipString) {
  let ipAllowance;
  try {
    ipAllowance = await sequelize.query(
      /* eslint-disable max-len */
      `SELECT COALESCE(i.lastSeen, NOW() - INTERVAL 5 MINUTE) as lastSeen,
COALESCE(p.isProxy, 0) AS isProxy, w.ip IS NOT NULL AS isWhitelisted,
COALESCE(r.country, 'xx') AS country,
COALESCE(r.expires, NOW() - INTERVAL 5 MINUTE) AS whoisExpires,
COALESCE(p.expires, NOW() - INTERVAL 5 MINUTE) AS proxyCheckExpires,
b.expires AS 'bans.expires', b.flags AS 'bans.flags' FROM IPs i
  LEFT JOIN ProxyWhitelists w ON w.ip = i.ip
  LEFT JOIN Proxies p ON p.ip = i.ip AND p.expires > NOW()
  LEFT JOIN Ranges r ON r.id = i.rid AND r.expires > NOW()
  LEFT JOIN IPBans ib ON ib.ip = i.ip
  LEFT JOIN Bans b ON b.id = ib.bid AND (b.expires > NOW() OR b.expires IS NULL)
WHERE i.ip = IP_TO_BIN(:ipString)`, {
      /* eslint-enable max-len */
        replacements: { ipString },
        raw: true,
        type: QueryTypes.SELECT,
      });
    ipAllowance = nestQuery(ipAllowance);

    if (ipAllowance) {
      ipAllowance.isProxy = ipAllowance.isProxy === 1;
      ipAllowance.isWhitelisted = ipAllowance.isWhitelisted === 1;
      ipAllowance.whoisExpiresTs = ipAllowance.whoisExpires.getTime();
      // eslint-disable-next-line max-len
      ipAllowance.proxyCheckExpiresTs = ipAllowance.proxyCheckExpires.getTime();
      delete ipAllowance.whoisExpires;
      delete ipAllowance.proxyCheckExpires;
    }
  } catch (error) {
    console.error(`SQL Error on getIPAllowance: ${error.message}`);
  }

  if (!ipAllowance) {
    const expiredTs = Date.now() - 10 * 3600 * 1000;

    ipAllowance = {
      isWhitelisted: false,
      bans: [],
      country: 'xx',
      isProxy: false,
      lastSeen: new Date(),
      whoisExpiresTs: expiredTs,
      proxyCheckExpiresTs: expiredTs,
    };
  }

  if (!USE_PROXYCHECK) {
    ipAllowance.proxyCheckExpiresTs = Infinity;
  }

  return ipAllowance;
}

/**
 * Save ip information. If woisData or pcData aren't available, don't save
 * the specific one. Data objects need to have an expiration date.
 * If whoisData has an rid, don't write new whois data, but use that rid
 * @param ipString ip as string
 * @param whoisData null | {
 *   [rid]: id of range,
 *   expiresTs: timestamp when data expires,
 *   range as [start: hex, end: hex, mask: number],
 *   org as string,
 *   descr as string,
 *   asn as unsigned 32bit integer,
 *   country as two letter lowercase code,
 *   referralHost as string,
 *   referralRange as [start: hex, end: hex, mask: number],
 * }
 * @param pcData null | {
 *   expiresTs: timestamp when data expires,
 *   isProxy: true or false,
 *   type: Residential, Wireless, VPN, SOCKS,...,
 *   operator: name of proxy operator if available,
 *   city: name of city,
 *   devices: amount of devices using this ip,
 *   subnetDevices: amount of devices in this subnet,
 * }
 * @return success boolean
 */
export async function saveIPIntel(ipString, whoisData, pcData) {
  try {
    const transaction = await sequelize.transaction();

    try {
      const promises = [];
      let rid;

      if (whoisData) {
        if (whoisData.rid) {
          rid = whoisData.rid;
        } else {
          const {
            range, country = 'xx', asn = null,
            referralHost, referralRange,
            expiresTs: whoisExpiresTs,
          } = whoisData;
          let { org = null, descr = null } = whoisData;

          if (org) {
            org = org.slice(0, 60);
          }
          if (descr) {
            descr = descr.slice(0, 60);
          }

          if (referralRange && referralHost) {
            promises.push(WhoisReferral.upsert({
              min: Sequelize.fn('UNHEX', referralRange[0]),
              max: Sequelize.fn('UNHEX', referralRange[1]),
              mask: referralRange[2],
              host: referralHost,
              expires: new Date(whoisExpiresTs),
            }, { returning: false, transaction }));
          }

          const expires = new Date(whoisExpiresTs);
          /*
           * if we would be always on MariaDB, we could use append RETURNING id and
           * get the id during the insert
           */
          promises.push(sequelize.query(
            /* eslint-disable max-len */
            `INSERT INTO Ranges (min, max, mask, country, org, descr, asn, expires) VALUES (UNHEX(?), UNHEX(?), ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE min = UNHEX(?), max = UNHEX(?), mask = ?, country = ?, org = ?, descr = ?, asn = ?, expires = ?`, {
              /* eslint-disable max-len */
              replacements: [
                range[0], range[1], range[2], country, org, descr, asn, expires,
                range[0], range[1], range[2], country, org, descr, asn, expires,
              ],
              raw: true,
              type: QueryTypes.INSERT,
            }));

          await Promise.all(promises);
          const whoisResult = await sequelize.query(
            'SELECT id FROM Ranges WHERE min = UNHEX(?) AND max = UNHEX(?)', {
              replacements: [range[0], range[1]],
              raw: true,
              type: QueryTypes.SELECT,
            });

          rid = whoisResult[0]?.id;
        }
      }

      const ipValues = { ip: Sequelize.fn('IP_TO_BIN', ipString) };
      if (rid) {
        ipValues.rid = rid;
      }
      await IP.upsert(ipValues, { returning: false, transaction });

      if (pcData) {
        const query = {
          ...pcData,
          ip: Sequelize.fn('IP_TO_BIN', ipString),
        };
        query.expires = new Date(query.expiresTs);
        delete query.expiresTs;

        await ProxyData.upsert(query, { returning: false, transaction });
      }

      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error(`SQL Error on saveIPIntel: ${error.message}`);
  }
  return false;
}

/**
 * get basic informations of ip
 * @param ipStrings Array of multiple or single ipStrings
 * @param ipUuids Array of multiple or single ip uuids (IID)
 * @return [{
 *   iid,
 *   ipString,
 *   country,
 *   cidr,
 *   org,
 *   descr,
 *   asn,
 *   type,
 *   isProxy,
 *   isWhitelisted,
 * }, ...]
 */
export async function getIPInfos(ipStrings, ipUuids) {
  try {
    const where = [];
    let replacements = [];
    let requestAmount = 0;

    if (ipStrings) {
      if (Array.isArray(ipStrings)) {
        if (ipStrings.length) {
          where.push(`ip.ip IN (${
            ipStrings.map(() => 'SELECT IP_TO_BIN(?)').join(' UNION ALL ')
          })`);
          replacements = replacements.concat(ipStrings);
          requestAmount += ipStrings.length;
        }
      } else {
        where.push('ip.ip = IP_TO_BIN(?)');
        replacements.push(ipStrings);
        requestAmount += 1;
      }
    }

    if (ipUuids) {
      if (Array.isArray(ipUuids)) {
        if (ipUuids.length) {
          where.push(`ip.uuid IN (${
            ipUuids.map(() => 'SELECT UUID_TO_BIN(?)').join(' UNION ALL ')
          })`);
          replacements = replacements.concat(ipUuids);
          requestAmount += ipUuids.length;
        }
      } else {
        where.push('ip.uuid = UUID_TO_BIN(?)');
        replacements.push(ipUuids);
        requestAmount += 1;
      }
    }

    if (requestAmount === 0 || requestAmount > 300) {
      return [];
    }

    const ipInfos = await sequelize.query(
      /* eslint-disable max-len */
      `SELECT BIN_TO_UUID(ip.uuid) AS 'iid', BIN_TO_IP(ip.ip) AS 'ipString',
COALESCE(r.country, 'xx') AS 'country', r.org, r.descr, r.asn, CONCAT(BIN_TO_IP(r.min), '/', r.mask) AS 'cidr',
p.type, COALESCE(p.isProxy, 0) AS isProxy, w.ip IS NOT NULL AS isWhitelisted
FROM IPs ip
  LEFT JOIN Ranges r ON r.id = ip.rid
  LEFT JOIN Proxies p ON p.ip = ip.ip
  LEFT JOIN ProxyWhitelists w ON w.ip = ip.ip
WHERE ${(where.length === 1) ? where[0] : `(${where.join(' OR ')})`}`, {
        /* eslint-enable max-len */
        replacements,
        raw: true,
        type: QueryTypes.SELECT,
      });

    return ipInfos;
  } catch (error) {
    console.error(`SQL Error on getInfoToIp: ${error.message}`);
  }
  return [];
}

/**
 * update lastSeen timestamps of IP
 * @param ipString ip as string
 * @return sucess boolean
 */
export async function touchIP(ipString) {
  try {
    await sequelize.query(
      'UPDATE IPs SET lastSeen = NOW() WHERE ip = IP_TO_BIN(?)', {
        replacements: [ipString],
        raw: true,
        type: QueryTypes.UPDATE,
      },
    );
    return true;
  } catch (error) {
    console.error(`SQL Error on touchIP: ${error.message}`);
  }
  return false;
}

/**
 * get IP of IID (which is just the uuid in this table)
 * @param uuid IID as String
 * @return null | uuid as String
 */
export async function getIPofIID(uuid) {
  if (!uuid) {
    return null;
  }
  try {
    const result = await sequelize.query(
      // eslint-disable-next-line max-len
      'SELECT BIN_TO_IP(i.ip) AS \'ip\' FROM IPs i WHERE i.uuid = UUID_TO_BIN(?)', {
        replacements: [uuid],
        raw: true,
        type: QueryTypes.SELECT,
      },
    );
    return result[0]?.ip;
  } catch (err) {
    console.error(`SQL Error on getIPofIID: ${err.message}`);
  }
  return null;
}

/**
 * get IID of IP (which is just the uuid in this table)
 * @param ipString ip as String
 * @return null | uuid as String
 */
export async function getIIDofIP(ipString) {
  try {
    const result = await sequelize.query(
      // eslint-disable-next-line max-len
      'SELECT BIN_TO_UUID(i.uuid) AS \'iid\' FROM IPs i WHERE i.ip = IP_TO_BIN(?)', {
        replacements: [ipString],
        raw: true,
        type: QueryTypes.SELECT,
      },
    );
    return result[0]?.iid;
  } catch (err) {
    console.error(`SQL Error on getIIDofIP: ${err.message}`);
  }
  return null;
}

/**
 * get IPs of IIDs (which is just the uuid in this table)
 * @param uuid Array of IID strings
 * @return Map<{ uuid: ipString }>
 */
export async function getIPsOfIIDs(uuids) {
  const idToIPMap = new Map();

  let where = '';
  let replacements;
  if (uuids) {
    if (Array.isArray(uuids)) {
      if (uuids.length && uuids.length <= 300) {
        const placeholder = uuids
          .map(() => 'SELECT UUID_TO_BIN(?)').join(' UNION ALL ');
        where += `i.uuid IN (${placeholder})`;
        replacements = uuids;
      }
    } else {
      where += 'i.uuid = UUID_TO_BIN(?)';
      replacements = [uuids];
    }
  }

  if (!replacements) {
    return idToIPMap;
  }

  try {
    const result = await sequelize.query(
      `SELECT BIN_TO_IP(i.ip) AS 'ip', BIN_TO_UUID(i.uuid) AS 'iid' FROM IPs i
WHERE ${where}`, {
        replacements,
        raw: true,
        type: QueryTypes.SELECT,
      },
    );
    result.forEach((obj) => {
      idToIPMap.set(obj.iid, obj.ip);
    });
  } catch (err) {
    console.error(`SQL Error on getIPsOfIIDs: ${err.message}`);
  }
  return idToIPMap;
}

/**
 * get IIDs of IPs (which is just the uuid in this table)
 * @param ipStrings Array of or a single ip string
 * @return Map<{ ipString: uuid, ... }>
 */
export async function getIIDsOfIPs(ipStrings) {
  const ipToIdMap = new Map();

  let where = '';
  let replacements;
  if (ipStrings) {
    if (Array.isArray(ipStrings)) {
      if (ipStrings.length && ipStrings.length <= 300) {
        const placeholder = ipStrings
          .map(() => 'SELECT IP_TO_BIN(?)').join(' UNION ALL ');
        where += `i.ip IN (${placeholder})`;
        replacements = ipStrings;
      }
    } else {
      where += 'i.ip = IP_TO_BIN(?)';
      replacements = [ipStrings];
    }
  }

  if (!replacements) {
    return ipToIdMap;
  }

  try {
    const result = await sequelize.query(
      `SELECT BIN_TO_IP(i.ip) AS 'ip', BIN_TO_UUID(i.uuid) AS 'iid' FROM IPs i
      WHERE ${where}`, {
        replacements,
        raw: true,
        type: QueryTypes.SELECT,
      },
    );
    result.forEach((obj) => {
      ipToIdMap.set(obj.ip, obj.iid);
    });
  } catch (error) {
    console.error(`SQL Error on getIIDsOfIPs: ${error.message}`);
  }
  return ipToIdMap;
}

export default IP;
