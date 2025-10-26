import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { USERLVL } from '../../../data/sql/index.js';
import { QueryTypes } from 'sequelize';
import sequelize from '../../../data/sql/sequelize.js';
import {
  Faction,
  FactionMember,
  FactionBan,
  FactionCountryExclude,
  FactionInvite,
  FactionJoinRequest,
} from '../../../data/sql/Faction.js';
import {
  getFactionRanks,
  getUserFactionId,
  setUserFaction,
  clearUserFaction,
  hasLeaveCooldown,
  setLeaveCooldown,
  getTagsForUsers,
  removeFactionFromRanks,
  getFactionRankFor,
} from '../../../data/redis/factions.js';
import { addFactionToRanks } from '../../../data/redis/factions.js';
import { getNamesToIds, findUserById } from '../../../data/sql/User.js';
import { compareToHash } from '../../../utils/hash.js';
import { IMGBB_API_KEY } from '../../../core/config.js';

const router = express.Router();

function ensureOwner(req, res, next) {
  const { user } = req;
  if (!user) {
    res.status(401).json({ errors: ['not authorized'] });
    return;
  }
  next();
}

router.use(express.json());

const __cache = new Map();
function cacheGet(k) {
  const e = __cache.get(k);
  if (!e) return null;
  if (e.x < Date.now()) { __cache.delete(k); return null; }
  return e.v;
}
function cacheSet(k, v, ttl = 15000) {
  __cache.set(k, { v, x: Date.now() + ttl });
}
function clearCache() { __cache.clear(); }

router.use((req, res, next) => {
  if (req.method !== 'POST') { next(); return; }
  const orig = res.json.bind(res);
  res.json = (body) => { const r = orig(body); try { clearCache(); } catch {} return r; };
  next();
});

router.get('/leaderboard', async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const size = Math.min(50, Math.max(5, Number(req.query.size || 20)));
  const ck = `leaderboard:${page}:${size}`;
  const c = cacheGet(ck);
  if (c) { res.set('Cache-Control', 'private, max-age=15'); res.json(c); return; }
  const ranks = await getFactionRanks(page, size);
  const fids = ranks.map((r) => r.id);
  if (!fids.length) {
    const payload = { page, size, total: 0, data: [] };
    res.set('Cache-Control', 'private, max-age=15');
    res.json(payload);
    cacheSet(ck, payload);
    return;
  }
  const rows = await Faction.findAll({
    where: { id: fids },
    attributes: ['id', 'name', 'tag', 'avatar', 'memberCount', 'joinPolicy', 'createdAt'],
    raw: true,
  });
  const map = new Map(rows.map((r) => [r.id, r]));
  let data = ranks.map((r) => ({
    id: r.id,
    rank: r.r,
    total: r.t,
    daily: r.dt,
    ...(map.get(r.id) || {}),
  }));
  data = data.filter((row) => row && row.joinPolicy !== 2);
  data = data.sort((a, b) => (
    (b.total - a.total)
    || (b.daily - a.daily)
    || (b.memberCount - a.memberCount)
    || (new Date(a.createdAt) - new Date(b.createdAt))
  ));
  const payload = { page, size, total: data.length, data };
  res.set('Cache-Control', 'private, max-age=15');
  res.json(payload);
  cacheSet(ck, payload);
});

router.get('/profile', async (req, res) => {
  const fid = Number(req.query.fid || 0);
  if (!fid) {
    res.status(400).json({ errors: ['invalid'] });
    return;
  }
  const ck = `profile:${fid}`;
  const c = cacheGet(ck);
  if (c) { res.set('Cache-Control', 'private, max-age=15'); res.json(c); return; }
  const f = await Faction.findByPk(fid, { raw: true });
  if (!f) {
    res.status(404).json({ errors: ['not found'] });
    return;
  }
  const rank = await getFactionRankFor(fid);
  const joinable = f.joinPolicy !== 2;
  const payload = {
    faction: f,
    stats: { totalPixels: rank.t, dailyPixels: rank.dt, rank: rank.r },
    joinable,
    inviteRequired: f.joinPolicy === 2,
  };
  res.set('Cache-Control', 'private, max-age=15');
  res.json(payload);
  cacheSet(ck, payload);
});

router.get('/mine', ensureOwner, async (req, res) => {
  const { user } = req;
  const fid = await getUserFactionId(user.id);
  if (!fid) {
    res.json({ faction: null });
    return;
  }
  const f = await Faction.findByPk(fid, { raw: true });
  if (!f) {
    await clearUserFaction(user.id);
    res.json({ faction: null });
    return;
  }
  const isOwner = (f.ownerId === user.id) || (user.userlvl >= USERLVL.ADMIN);
  const members = await FactionMember.findAll({ where: { fid }, raw: true });
  let requests = [];
  let bans = [];
  let excludes = [];
  if (isOwner) {
    [requests, bans, excludes] = await Promise.all([
      FactionJoinRequest.findAll({ where: { fid }, raw: true }),
      FactionBan.findAll({ where: { fid }, raw: true }),
      FactionCountryExclude.findAll({ where: { fid }, raw: true }),
    ]);
  }
  const uids = Array.from(new Set([
    ...members.map((m) => m.uid),
    ...requests.map((r) => r.uid),
    ...bans.map((b) => b.uid),
  ]));
  const tags = await getTagsForUsers(uids);
  const namesMap = await getNamesToIds(uids);
  const memW = members.map((m) => ({ ...m, name: namesMap.get(m.uid) || String(m.uid) }));
  const reqW = requests.map((r) => ({ ...r, name: namesMap.get(r.uid) || String(r.uid) }));
  const banW = bans.map((b) => ({ ...b, name: namesMap.get(b.uid) || String(b.uid) }));
  let inviteCode = null;
  if (f.joinPolicy === 2) {
    const inv = await FactionInvite.findOne({ where: { fid }, raw: true });
    inviteCode = inv?.code || null;
  }
  res.json({ faction: f, members: memW, requests: reqW, bans: banW, excludes, invite: inviteCode, tags: Object.fromEntries(tags) });
});

router.post('/create', ensureOwner, async (req, res) => {
  const { user } = req;
  const { name, tag, joinPolicy } = req.body || {};
  const upperTag = String(tag || '').trim().toUpperCase();
  const fName = String(name || '').trim();
  if (!fName || fName.length > 24) {
    res.status(400).json({ errors: ['invalid name'] });
    return;
  }
  if (!upperTag || upperTag.length < 2 || upperTag.length > 4) {
    res.status(400).json({ errors: ['invalid tag'] });
    return;
  }
  if (await hasLeaveCooldown(user.id)) {
    res.status(429).json({ errors: ['cooldown'] });
    return;
  }
  const tr = await sequelize.transaction();
  try {
    const exists = await Faction.findOne({ where: { name: fName }, raw: true, transaction: tr });
    const existsTag = await Faction.findOne({ where: { tag: upperTag }, raw: true, transaction: tr });
    if (exists || existsTag) {
      await tr.rollback();
      res.status(400).json({ errors: ['name or tag exists'] });
      return;
    }
    const row = await Faction.create({ name: fName, tag: upperTag, joinPolicy: Number(joinPolicy) || 0, ownerId: user.id, memberCount: 1 }, { transaction: tr });
    await FactionMember.create({ uid: user.id, fid: row.id, role: 1 }, { transaction: tr });
    await tr.commit();
    await setUserFaction(user.id, row.id, upperTag);
    await addFactionToRanks(row.id);
    if ((Number(joinPolicy) || 0) === 2) {
      const base = 'abcdefghijklmnopqrstuvwxyz0123456789';
      const raw = Array.from({ length: 12 }, () => base[Math.floor(Math.random() * base.length)]).join('');
      const pretty = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
      await FactionInvite.create({ fid: row.id, code: pretty, invitedUid: 0, createdBy: user.id });
    }
    res.json({ status: 'ok', id: row.id });
  } catch (e) {
    try { await tr.rollback(); } catch {}
    res.status(500).json({ errors: ['internal'] });
  }
});

router.post('/join', ensureOwner, async (req, res) => {
  const { user } = req;
  const { fid } = req.body || {};
  if (await hasLeaveCooldown(user.id)) {
    res.status(429).json({ errors: ['cooldown'] });
    return;
  }
  const f = await Faction.findByPk(Number(fid), { raw: true });
  if (!f) {
    res.status(404).json({ errors: ['not found'] });
    return;
  }
  const banned = await FactionBan.findOne({ where: { fid: f.id, uid: user.id }, raw: true });
  if (banned) {
    res.status(403).json({ errors: ['banned'] });
    return;
  }
  const excluded = await FactionCountryExclude.findOne({ where: { fid: f.id, country: String(req.ip?.country || '').toUpperCase() }, raw: true });
  if (excluded) {
    res.status(403).json({ errors: ['country excluded'] });
    return;
  }
  if (await getUserFactionId(user.id)) {
    res.status(400).json({ errors: ['already in faction'] });
    return;
  }
  if (f.joinPolicy === 0) {
    await FactionMember.create({ uid: user.id, fid: f.id, role: 0 });
    await Faction.update({ memberCount: sequelize.literal('memberCount + 1') }, { where: { id: f.id } });
    await setUserFaction(user.id, f.id, f.tag);
    res.json({ status: 'ok' });
    return;
  }
  if (f.joinPolicy === 1) {
    await FactionJoinRequest.upsert({ uid: user.id, fid: f.id });
    res.json({ status: 'pending' });
    return;
  }
  res.status(403).json({ errors: ['invite required'] });
});

router.post('/leave', ensureOwner, async (req, res) => {
  const { user } = req;
  const fid = await getUserFactionId(user.id);
  if (!fid) {
    res.json({ status: 'ok' });
    return;
  }
  const f = await Faction.findByPk(fid, { raw: true });
  if (f && f.ownerId === user.id) {
    res.status(400).json({ errors: ['owner must transfer or delete'] });
    return;
  }
  await FactionMember.destroy({ where: { uid: user.id, fid } });
  await Faction.update({ memberCount: sequelize.literal('memberCount - 1') }, { where: { id: fid } });
  await clearUserFaction(user.id);
  await setLeaveCooldown(user.id);
  res.json({ status: 'ok' });
});

router.post('/approve', ensureOwner, async (req, res) => {
  const { user } = req;
  const { uid } = req.body || {};
  const fid = await getUserFactionId(user.id);
  if (!fid) { res.status(403).json({ errors: ['not in faction'] }); return; }
  const f = await Faction.findByPk(fid, { raw: true });
  if (f.ownerId !== user.id) { res.status(403).json({ errors: ['forbidden'] }); return; }
  const reqj = await FactionJoinRequest.findOne({ where: { uid, fid }, raw: true });
  if (!reqj) { res.status(404).json({ errors: ['no request'] }); return; }
  await FactionJoinRequest.destroy({ where: { uid, fid } });
  await FactionMember.create({ uid, fid, role: 0 });
  await Faction.update({ memberCount: sequelize.literal('memberCount + 1') }, { where: { id: fid } });
  await setUserFaction(uid, fid, f.tag);
  res.json({ status: 'ok' });
});

router.post('/deny', ensureOwner, async (req, res) => {
  const { user } = req;
  const { uid } = req.body || {};
  const fid = await getUserFactionId(user.id);
  if (!fid) { res.status(403).json({ errors: ['not in faction'] }); return; }
  const f = await Faction.findByPk(fid, { raw: true });
  if (f.ownerId !== user.id) { res.status(403).json({ errors: ['forbidden'] }); return; }
  await FactionJoinRequest.destroy({ where: { uid, fid } });
  res.json({ status: 'ok' });
});

router.post('/kick', ensureOwner, async (req, res) => {
  const { user } = req;
  const { uid } = req.body || {};
  const fid = await getUserFactionId(user.id);
  if (!fid) { res.status(403).json({ errors: ['not in faction'] }); return; }
  const f = await Faction.findByPk(fid, { raw: true });
  if (f.ownerId !== user.id) { res.status(403).json({ errors: ['forbidden'] }); return; }
  if (uid === user.id) { res.status(400).json({ errors: ['cannot kick self'] }); return; }
  await FactionMember.destroy({ where: { uid, fid } });
  await Faction.update({ memberCount: sequelize.literal('memberCount - 1') }, { where: { id: fid } });
  await clearUserFaction(uid);
  await setLeaveCooldown(uid);
  res.json({ status: 'ok' });
});

router.post('/ban', ensureOwner, async (req, res) => {
  const { user } = req;
  const { uid } = req.body || {};
  const fid = await getUserFactionId(user.id);
  if (!fid) { res.status(403).json({ errors: ['not in faction'] }); return; }
  const f = await Faction.findByPk(fid, { raw: true });
  if (f.ownerId !== user.id) { res.status(403).json({ errors: ['forbidden'] }); return; }
  if (Number(uid) === user.id) { res.status(400).json({ errors: ['cannot ban self'] }); return; }
  await FactionMember.destroy({ where: { uid, fid } });
  await FactionBan.upsert({ uid, fid });
  await clearUserFaction(uid);
  await setLeaveCooldown(uid);
  res.json({ status: 'ok' });
});

router.post('/unban', ensureOwner, async (req, res) => {
  const { user } = req;
  const { uid } = req.body || {};
  const fid = await getUserFactionId(user.id);
  if (!fid) { res.status(403).json({ errors: ['not in faction'] }); return; }
  const f = await Faction.findByPk(fid, { raw: true });
  if (f.ownerId !== user.id) { res.status(403).json({ errors: ['forbidden'] }); return; }
  await FactionBan.destroy({ where: { uid, fid } });
  res.json({ status: 'ok' });
});

router.post('/exclude', ensureOwner, async (req, res) => {
  const { user } = req;
  const { country } = req.body || {};
  const fid = await getUserFactionId(user.id);
  if (!fid) { res.status(403).json({ errors: ['not in faction'] }); return; }
  const f = await Faction.findByPk(fid, { raw: true });
  if (f.ownerId !== user.id) { res.status(403).json({ errors: ['forbidden'] }); return; }
  const c = String(country || '').toUpperCase();
  if (!c || c.length !== 2) { res.status(400).json({ errors: ['invalid'] }); return; }
  await FactionCountryExclude.upsert({ fid, country: c });
  res.json({ status: 'ok' });
});

router.post('/include', ensureOwner, async (req, res) => {
  const { user } = req;
  const { country } = req.body || {};
  const fid = await getUserFactionId(user.id);
  if (!fid) { res.status(403).json({ errors: ['not in faction'] }); return; }
  const f = await Faction.findByPk(fid, { raw: true });
  if (f.ownerId !== user.id) { res.status(403).json({ errors: ['forbidden'] }); return; }
  const c = String(country || '').toUpperCase();
  await FactionCountryExclude.destroy({ where: { fid, country: c } });
  res.json({ status: 'ok' });
});

router.post('/update', ensureOwner, async (req, res) => {
  const { user } = req;
  const fid = await getUserFactionId(user.id);
  if (!fid) { res.status(403).json({ errors: ['not in faction'] }); return; }
  const f = await Faction.findByPk(fid, { raw: true });
  if (!f || f.ownerId !== user.id) { res.status(403).json({ errors: ['forbidden'] }); return; }
  const p = {};
  if (typeof req.body.joinPolicy === 'number') p.joinPolicy = req.body.joinPolicy;
  if (req.body.name) p.name = String(req.body.name).trim();
  if (req.body.tag) p.tag = String(req.body.tag).trim().toUpperCase();
  if (Object.keys(p).length === 0) { res.json({ status: 'ok' }); return; }
  await Faction.update(p, { where: { id: fid } });
  if (typeof req.body.joinPolicy === 'number' && req.body.joinPolicy === 2) {
    const inv = await FactionInvite.findOne({ where: { fid }, raw: true });
    if (!inv) {
      const base = 'abcdefghijklmnopqrstuvwxyz0123456789';
      const raw = Array.from({ length: 12 }, () => base[Math.floor(Math.random() * base.length)]).join('');
      const pretty = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
      await FactionInvite.create({ fid, code: pretty, invitedUid: 0, createdBy: user.id });
    }
  }
  if (p.tag) {
    const members = await FactionMember.findAll({ where: { fid }, attributes: ['uid'], raw: true });
    const ops = members.map((m) => setUserFaction(m.uid, fid, p.tag));
    await Promise.all(ops);
  }
  res.json({ status: 'ok' });
});

router.post('/transfer', ensureOwner, async (req, res) => {
  const { user } = req;
  const { newOwnerId, password } = req.body || {};
  const fid = await getUserFactionId(user.id);
  if (!fid) { res.status(403).json({ errors: ['not in faction'] }); return; }
  const f = await Faction.findByPk(fid, { raw: true });
  if (f.ownerId !== user.id) { res.status(403).json({ errors: ['forbidden'] }); return; }
  const u = await findUserById(user.id);
  if (!u || !u.password || !compareToHash(password || '', u.password)) { res.status(400).json({ errors: ['wrong password'] }); return; }
  const member = await FactionMember.findOne({ where: { uid: newOwnerId, fid }, raw: true });
  if (!member) { res.status(404).json({ errors: ['not a member'] }); return; }
  await Faction.update({ ownerId: newOwnerId }, { where: { id: fid } });
  res.json({ status: 'ok' });
});

router.post('/delete', ensureOwner, async (req, res) => {
  const { user } = req;
  const { password } = req.body || {};
  const fid = await getUserFactionId(user.id);
  if (!fid) { res.status(403).json({ errors: ['not in faction'] }); return; }
  const f = await Faction.findByPk(fid, { raw: true });
  if (!f || f.ownerId !== user.id) { res.status(403).json({ errors: ['forbidden'] }); return; }
  const u = await findUserById(user.id);
  if (!u || !u.password || !compareToHash(password || '', u.password)) { res.status(400).json({ errors: ['wrong password'] }); return; }
  const members = await FactionMember.findAll({ where: { fid }, attributes: ['uid'], raw: true });
  const uidList = members.map((m) => m.uid);
  await FactionMember.destroy({ where: { fid } });
  await FactionJoinRequest.destroy({ where: { fid } });
  await FactionBan.destroy({ where: { fid } });
  await FactionCountryExclude.destroy({ where: { fid } });
  await FactionInvite.destroy({ where: { fid } });
  await Faction.destroy({ where: { id: fid } });
  await removeFactionFromRanks(fid);
  await Promise.all(uidList.map((uid) => clearUserFaction(uid)));
  try {
    const destDir = path.join(process.cwd(), 'public', 'favatars');
    const file = path.join(destDir, `${fid}.webp`);
    if (fs.existsSync(file)) {
      try { fs.unlinkSync(file); } catch {}
    }
  } catch {}
  res.json({ status: 'ok' });
});

router.post('/avatar', ensureOwner, async (req, res) => {
  const { user } = req;
  const fid = await getUserFactionId(user.id);
  if (!fid) { res.status(403).json({ errors: ['not in faction'] }); return; }
  const f = await Faction.findByPk(fid, { raw: true });
  if (!f || f.ownerId !== user.id) { res.status(403).json({ errors: ['forbidden'] }); return; }
  if (!IMGBB_API_KEY) { res.status(503).json({ errors: ['image hosting unavailable'] }); return; }
  const sharp = (await import('sharp')).default;
  let buffer = Buffer.from([]);
  req.on('data', (chunk) => { buffer = Buffer.concat([buffer, chunk]); });
  req.on('end', async () => {
    try {
      const out = await sharp(buffer).rotate().resize({ width: 256, height: 256, fit: 'cover' }).webp({ quality: 82 }).toBuffer();
      const params = new URLSearchParams();
      params.set('key', IMGBB_API_KEY);
      params.set('image', out.toString('base64'));
      params.set('name', `faction_${fid}`);
      const upres = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: params });
      let url = null;
      try {
        const j = await upres.json();
        if (j && j.success && j.data) {
          url = j.data.display_url || j.data.url || null;
        }
      } catch {}
      if (!upres.ok || !url) { res.status(500).json({ errors: ['upload failed'] }); return; }
      await Faction.update({ avatar: url }, { where: { id: fid } });
      res.json({ status: 'ok', avatar: url, version: Date.now() });
    } catch {
      res.status(500).json({ errors: ['upload failed'] });
    }
  });
});

router.get('/invites', ensureOwner, async (req, res) => {
  const { user } = req;
  const fid = await getUserFactionId(user.id);
  if (!fid) { res.status(403).json({ errors: ['not in faction'] }); return; }
  const f = await Faction.findByPk(fid, { raw: true });
  if (f.ownerId !== user.id) { res.status(403).json({ errors: ['forbidden'] }); return; }
  let inv = await FactionInvite.findOne({ where: { fid }, raw: true });
  if (!inv) {
    const code = Array.from({ length: 12 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
    const pretty = `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
    inv = await FactionInvite.create({ fid, code: pretty, invitedUid: 0, createdBy: user.id });
  }
  res.json({ code: inv.code });
});

router.get('/bytag', async (req, res) => {
  const tag = String(req.query.tag || '').trim().toUpperCase();
  if (!tag) { res.status(400).json({ errors: ['invalid'] }); return; }
  const ck = `bytag:${tag}`;
  const c = cacheGet(ck);
  if (c) { res.set('Cache-Control', 'private, max-age=15'); res.json(c); return; }
  const f = await Faction.findOne({ where: { tag }, raw: true });
  if (!f) { res.status(404).json({ errors: ['not found'] }); return; }
  const rank = await getFactionRankFor(f.id);
  const payload = {
    faction: f,
    stats: { totalPixels: rank.t, dailyPixels: rank.dt, rank: rank.r },
    joinable: f.joinPolicy !== 2,
    inviteRequired: f.joinPolicy === 2,
  };
  res.set('Cache-Control', 'private, max-age=15');
  res.json(payload);
  cacheSet(ck, payload);
});

router.post('/accept_invite', ensureOwner, async (req, res) => {
  const { user } = req;
  const { code } = req.body || {};
  if (await hasLeaveCooldown(user.id)) { res.status(429).json({ errors: ['cooldown'] }); return; }
  const inv = await FactionInvite.findOne({ where: { code }, raw: true });
  if (!inv) { res.status(404).json({ errors: ['invalid invite'] }); return; }
  const f = await Faction.findByPk(inv.fid, { raw: true });
  if (!f || f.joinPolicy !== 2) { res.status(400).json({ errors: ['invalid invite'] }); return; }
  if (await getUserFactionId(user.id)) { res.status(400).json({ errors: ['already in faction'] }); return; }
  const excluded = await FactionCountryExclude.findOne({ where: { fid: f.id, country: String(user.country || '').toUpperCase() }, raw: true });
  if (excluded) { res.status(403).json({ errors: ['country excluded'] }); return; }
  await FactionMember.create({ uid: user.id, fid: f.id, role: 0 });
  await Faction.update({ memberCount: sequelize.literal('memberCount + 1') }, { where: { id: f.id } });
  await setUserFaction(user.id, f.id, f.tag);
  res.json({ status: 'ok' });
});

router.get('/admin/list', ensureOwner, async (req, res) => {
  const { user } = req;
  if (user.userlvl < USERLVL.ADMIN) { res.status(403).json({ errors: ['forbidden'] }); return; }
  const q = String(req.query.q || '').trim();
  const page = Math.max(1, Number(req.query.page || 1));
  const size = Math.min(50, Math.max(5, Number(req.query.size || 20)));
  const where = q ? { name: sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), 'LIKE', `%${q.toLowerCase()}%`) } : {};
  const rows = await Faction.findAll({ where, limit: size, offset: (page - 1) * size, raw: true, order: [['id', 'ASC']] });
  res.json({ page, size, data: rows });
});

router.post('/admin/delete', ensureOwner, async (req, res) => {
  const { user } = req;
  if (user.userlvl < USERLVL.ADMIN) { res.status(403).json({ errors: ['forbidden'] }); return; }
  const { fid } = req.body || {};
  const members = await FactionMember.findAll({ where: { fid }, attributes: ['uid'], raw: true });
  const uidList = members.map((m) => m.uid);
  await FactionMember.destroy({ where: { fid } });
  await FactionJoinRequest.destroy({ where: { fid } });
  await FactionBan.destroy({ where: { fid } });
  await FactionCountryExclude.destroy({ where: { fid } });
  await FactionInvite.destroy({ where: { fid } });
  await Faction.destroy({ where: { id: fid } });
  await removeFactionFromRanks(fid);
  await Promise.all(uidList.map((uid) => clearUserFaction(uid)));
  try {
    const destDir = path.join(process.cwd(), 'public', 'favatars');
    const file = path.join(destDir, `${fid}.webp`);
    if (fs.existsSync(file)) {
      try { fs.unlinkSync(file); } catch {}
    }
  } catch {}
  res.json({ status: 'ok' });
});

export default router;
