import fs from 'fs';
import readline from 'readline';

import { PIXELLOGGER_PREFIX } from './logger.js';
import { getNamesToIds } from '../data/sql/User.js';
import {
  getIIDsOfIPs,
  getIPInfos,
  getIPofIID,
} from '../data/sql/IP.js';

function parseFile(cb) {
  const date = new Date();
  const year = date.getUTCFullYear();
  let month = date.getUTCMonth() + 1;
  let day = date.getUTCDate();
  if (day < 10) day = `0${day}`;
  if (month < 10) month = `0${month}`;
  const filename = `${PIXELLOGGER_PREFIX}${year}-${month}-${day}.log`;

  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(filename);

    const rl = readline.createInterface({
      input: fileStream,
    });

    rl.on('line', (line) => cb(line.split(' ')));

    rl.on('error', (err) => {
      reject(err);
    });

    rl.on('close', () => {
      resolve();
    });
  });
}

/*
 * Get summary of pixels per canvas placed by iid
 * @param iid Limit on one user (optional)
 * @param time timestamp of when to start
 * @return array of parsed pixel log lines
 *         string if error
 */
export async function getIIDSummary(
  iid,
  time,
) {
  const filterIP = await getIPofIID(iid);
  if (!filterIP) {
    return 'Could not resolve IID to IP';
  }
  const cids = {};

  try {
    await parseFile((parts) => {
      const [tsStr, ipString,, cid, x, y,, clrStr] = parts;
      const ts = parseInt(tsStr, 10);
      if (ts >= time) {
        if (ipString === filterIP) {
          const clr = parseInt(clrStr, 10);
          let curVals = cids[cid];
          if (!curVals) {
            curVals = [0, 0, 0, 0, 0];
            cids[cid] = curVals;
          }
          curVals[0] += 1;
          curVals[1] = x;
          curVals[2] = y;
          curVals[3] = clr;
          curVals[4] = ts;
        }
      }
    });
  } catch (err) {
    return `Could not parse logfile: ${err.message}`;
  }

  const columns = ['rid', '#', 'canvas', 'last', 'clr', 'time'];
  const types = ['number', 'number', 'cid', 'coord', 'clr', 'ts'];
  const rows = [];
  const cidKeys = Object.keys(cids);
  for (let i = 0; i < cidKeys.length; i += 1) {
    const cid = cidKeys[i];
    const [pxls, x, y, clr, ts] = cids[cid];
    rows.push([
      i,
      pxls,
      cid,
      `${x},${y}`,
      clr,
      ts,
    ]);
  }

  return {
    columns,
    types,
    rows,
  };
}

/*
 * Get pixels by iid
 * @param iid Limit on one user (optional)
 * @param time timestamp of when to start
 * @return array of parsed pixel log lines
 *         string if error
 */
export async function getIIDPixels(
  iid,
  time,
  maxRows,
) {
  const filterIP = await getIPofIID(iid);
  if (!filterIP) {
    return 'Could not resolve IID to IP';
  }
  const pixels = [];

  try {
    await parseFile((parts) => {
      const [tsStr, ipString,, cid, x, y,, clrStr] = parts;
      const ts = parseInt(tsStr, 10);
      if (ts >= time) {
        if (ipString === filterIP) {
          const clr = parseInt(clrStr, 10);
          pixels.push([
            cid,
            x,
            y,
            clr,
            ts,
          ]);
        }
      }
    });
  } catch (err) {
    return `Could not parse logfile: ${err.message}`;
  }

  const pixelF = (maxRows && pixels.length > maxRows)
    ? pixels.slice(maxRows * -1)
    : pixels;

  const columns = ['rid', 'canvas', 'coord', 'clr', 'time'];
  const types = ['number', 'cid', 'coord', 'clr', 'ts'];
  const rows = [];
  for (let i = 0; i < pixelF.length; i += 1) {
    const [cid, x, y, clr, ts] = pixelF[i];
    rows.push([
      i,
      cid,
      `${x},${y}`,
      clr,
      ts,
    ]);
  }

  return {
    columns,
    types,
    rows,
  };
}

/*
 * Get summary of users placing in area of current day
 * @param canvasId id of canvas
 * @param xUL, yUL, xBR, yBR area of canvas
 * @param time timestamp of when to start
 * @param iid Limit on one user (optional)
 * @return array of parsed pixel log lines
 *         string if error
 */
export async function getSummaryFromArea(
  canvasId,
  xUL,
  yUL,
  xBR,
  yBR,
  time,
  iid,
) {
  const ips = {};
  const uids = [];
  const ipKeys = [];
  let summaryLength = 0;

  let filterIP = null;
  if (iid) {
    filterIP = await getIPofIID(iid);
    if (!filterIP) {
      return 'Could not resolve IID to IP';
    }
  }

  let tsLog = Date.now();
  try {
    await parseFile((parts) => {
      /* only allow a limited amount of entries */
      if (summaryLength > 25) {
        return;
      }

      const [tsStr, ipString, uidStr, cid, x, y,, clrStr] = parts;
      const ts = parseInt(tsStr, 10);
      if (ts >= time
        // eslint-disable-next-line eqeqeq
        && canvasId == cid
        && x >= xUL
        && x <= xBR
        && y >= yUL
        && y <= yBR
      ) {
        if (filterIP && ipString !== filterIP) {
          return;
        }
        const clr = parseInt(clrStr, 10);
        const uid = parseInt(uidStr, 10);
        let curVals = ips[ipString];
        if (!curVals) {
          curVals = [0, uid, 0, 0, 0, 0];
          ips[ipString] = curVals;
          summaryLength += 1;
          if (!uids.includes(uid)) {
            uids.push(uid);
          }
          ipKeys.push(ipString);
        }
        curVals[0] += 1;
        curVals[2] = x;
        curVals[3] = y;
        curVals[4] = clr;
        curVals[5] = ts;
      }
    });
  } catch (err) {
    return `Could not parse logfile: ${err.message}`;
  }
  console.log(
    `PIXEL_LOG: parsing logfile took ${(Date.now() - tsLog) / 1000} s`,
    `We have ${summaryLength} entries.`,
  );
  tsLog = Date.now();

  const [uid2Name, ip2Info] = await Promise.all([
    getNamesToIds(uids),
    getIPInfos(ipKeys),
  ]);
  console.log(
    `PIXEL_LOG: resolving info took ${(Date.now() - tsLog) / 1000} s`,
  );

  let printIIDs = false;
  let printUsers = false;
  const columns = ['rid', '#'];
  const types = ['number', 'number'];
  if (ip2Info.length > 0) {
    printIIDs = true;
    columns.push('IID', 'ct', 'cidr', 'org', 'pc');
    types.push('uuid', 'flag', 'cidr', 'string', 'string');
  }
  if (uid2Name.size > 0) {
    printUsers = true;
    columns.push('User');
    types.push('user');
  }
  columns.push('last', 'clr', 'time');
  types.push('coord', 'clr', 'ts');

  const rows = [];
  for (let i = 0; i < ipKeys.length; i += 1) {
    const ip = ipKeys[i];
    const [pxls, uid, x, y, clr, ts] = ips[ip];
    const row = [i, pxls];
    if (printIIDs) {
      const ipInfo = ip2Info.find(({ ipString }) => ipString === ip);
      if (!ipInfo) {
        row.push('N/A', 'xx', 'N/A', 'N/A', 'N/A');
      } else {
        row.push(
          ipInfo.iid,
          ipInfo.country,
          ipInfo.cidr,
          ipInfo.org || 'N/A',
          ipInfo.type || 'N/A',
        );
      }
    }
    if (printUsers) {
      const userMd = (uid && uid2Name.has(uid))
        ? `${uid2Name.get(uid)},${uid}` : 'N/A';
      row.push(userMd);
    }
    row.push(`${x},${y}`, clr, ts);
    rows.push(row);
  }

  return {
    columns,
    types,
    rows,
  };
}


export async function getPixelsFromArea(
  canvasId,
  xUL,
  yUL,
  xBR,
  yBR,
  time,
  iid,
  maxRows,
) {
  const pixels = [];
  const uids = [];
  const ips = [];
  let summaryLength = 0;

  let filterIP = null;
  if (iid) {
    filterIP = await getIPofIID(iid);
    if (!filterIP) {
      return 'Could not resolve IID to IP';
    }
  }

  try {
    await parseFile((parts) => {
      /* only allow a limited amount of ipStrings */
      if (summaryLength > 25) {
        return;
      }

      const [tsStr, ipString, uidStr, cid, x, y,, clrStr] = parts;
      const ts = parseInt(tsStr, 10);
      if (ts >= time
        // eslint-disable-next-line eqeqeq
        && canvasId == cid
        && x >= xUL
        && x <= xBR
        && y >= yUL
        && y <= yBR
      ) {
        if (filterIP && ipString !== filterIP) {
          return;
        }
        const clr = parseInt(clrStr, 10);
        const uid = parseInt(uidStr, 10);
        pixels.push([ipString, uid, x, y, clr, ts]);
        if (!ips.includes(ipString)) {
          summaryLength += 1;
          ips.push(ipString);
        }
        if (!uids.includes(uid)) {
          uids.push(uid);
        }
      }
    });
  } catch (err) {
    return `Could not parse logfile: ${err.message}`;
  }

  const [uid2Name, ip2Id] = await Promise.all([
    getNamesToIds(uids),
    getIIDsOfIPs(ips),
  ]);

  const pixelF = (maxRows && pixels.length > maxRows)
    ? pixels.slice(maxRows * -1)
    : pixels;

  let printIIDs = false;
  let printUsers = false;
  const columns = ['rid'];
  const types = ['number'];
  if (!filterIP && ip2Id.size > 0) {
    printIIDs = true;
    columns.push('IID');
    types.push('uuid');
  }
  if (!filterIP && uid2Name.size > 0) {
    printUsers = true;
    columns.push('User');
    types.push('user');
  }
  columns.push('coord', 'clr', 'time');
  types.push('coord', 'clr', 'ts');

  const rows = [];
  for (let i = 0; i < pixelF.length; i += 1) {
    const [ip, uid, x, y, clr, ts] = pixelF[i];
    const row = [i];
    if (printIIDs) {
      row.push(ip2Id.get(ip) || 'N/A');
    }
    if (printUsers) {
      const userMd = (uid && uid2Name.has(uid))
        ? `${uid2Name.get(uid)},${uid}` : 'N/A';
      row.push(userMd);
    }
    row.push(`${x},${y}`, clr, ts);
    rows.push(row);
  }

  return {
    columns,
    types,
    rows,
  };
}
