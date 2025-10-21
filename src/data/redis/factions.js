import client from './client.js';
import { getDateKeyOfTs } from '../../core/utils.js';
import { DailyCron } from '../../utils/cron.js';

const F_TOTAL_KEY = 'frank';
const F_DAILY_KEY = 'frankd';
const F_DAILY_STATS_PREFIX = 'fcds';

const UFID_PREFIX = 'ufid:';
const UTAG_PREFIX = 'utag:';
const UCD_PREFIX = 'fcd:';

async function topWithScores(key, start, end) {
  try {
    return await client.zRangeWithScores(key, start, end, { REV: true });
  } catch (e) {
    try {
      const arr = await client.sendCommand(['ZREVRANGE', key, String(start), String(end), 'WITHSCORES']);
      const ret = [];
      for (let i = 0; i < arr.length; i += 2) {
        ret.push({ value: arr[i], score: Number(arr[i + 1]) });
      }
      return ret;
    } catch {
      const vals = await client.zRevRange(key, start, end);
      const scores = vals.length ? await client.zmScore(key, vals) : [];
      const ret = [];
      for (let i = 0; i < vals.length; i += 1) {
        ret.push({ value: vals[i], score: Number(scores[i] || 0) });
      }
      return ret;
    }
  }
}

export async function getUserFactionId(uid) {
  const v = await client.get(`${UFID_PREFIX}${uid}`);
  return v ? Number(v) : 0;
}

export async function getUserFactionTag(uid) {
  return client.get(`${UTAG_PREFIX}${uid}`);
}

export async function setUserFaction(uid, fid, tag) {
  const ops = [];
  if (fid) ops.push(client.set(`${UFID_PREFIX}${uid}`, String(fid)));
  if (tag) ops.push(client.set(`${UTAG_PREFIX}${uid}`, String(tag)));
  if (ops.length) await Promise.all(ops);
}

export async function clearUserFaction(uid) {
  await Promise.all([
    client.del(`${UFID_PREFIX}${uid}`),
    client.del(`${UTAG_PREFIX}${uid}`),
  ]);
}

export async function incFactionPixels(fid, cnt) {
  if (!fid || !cnt) return;
  await Promise.all([
    client.zIncrBy(F_TOTAL_KEY, cnt, String(fid)),
    client.zIncrBy(F_DAILY_KEY, cnt, String(fid)),
  ]);
}

export async function getFactionRanks(start, amount) {
  const s = Math.max(0, Number(start || 1) - 1);
  const a = Math.max(1, Number(amount || 50));
  const ranks = await topWithScores(F_TOTAL_KEY, s, s + a - 1);
  const fids = ranks.map((r) => r.value);
  if (!fids.length) return [];
  const daily = await client.zmScore(F_DAILY_KEY, fids);
  const ret = [];
  for (let i = 0; i < ranks.length; i += 1) {
    ret.push({ id: Number(fids[i]), t: Number(ranks[i].score), dt: Number(daily[i] || 0), r: s + i + 1 });
  }
  return ret;
}

export async function getFactionRankFor(fid) {
  const id = String(fid);
  const [t, dt, r] = await Promise.all([
    client.zScore(F_TOTAL_KEY, id),
    client.zScore(F_DAILY_KEY, id),
    client.zRevRank(F_TOTAL_KEY, id),
  ]);
  return {
    id: Number(fid),
    t: Number(t || 0),
    dt: Number(dt || 0),
    r: (typeof r === 'number') ? (Number(r) + 1) : 0,
  };
}

export async function resetDailyFactionRanks() {
  const dateKey = getDateKeyOfTs(Date.now() - 86400000);
  const dst = `${F_DAILY_STATS_PREFIX}:${dateKey}`;
  try {
    await client.rename(F_DAILY_KEY, dst);
  } catch {}
}

DailyCron.hook(resetDailyFactionRanks);

export async function setLeaveCooldown(uid) {
  await client.setEx(`${UCD_PREFIX}${uid}`, 300, '1');
}

export async function hasLeaveCooldown(uid) {
  const v = await client.exists(`${UCD_PREFIX}${uid}`);
  return v === 1;
}

export async function getTagsForUsers(uids) {
  if (!uids.length) return new Map();
  const keys = uids.map((u) => `${UTAG_PREFIX}${u}`);
  const res = await client.mGet(keys);
  const m = new Map();
  for (let i = 0; i < uids.length; i += 1) {
    if (res[i]) m.set(Number(uids[i]), res[i]);
  }
  return m;
}

export async function removeFactionFromRanks(fid) {
  await Promise.all([
    client.zRem(F_TOTAL_KEY, String(fid)),
    client.zRem(F_DAILY_KEY, String(fid)),
  ]);
}

export async function addFactionToRanks(fid) {
  try {
    await client.zAdd(F_TOTAL_KEY, [{ score: 0, value: String(fid) }]);
  } catch {}
  try {
    await client.zAdd(F_DAILY_KEY, [{ score: 0, value: String(fid) }]);
  } catch {}
}
