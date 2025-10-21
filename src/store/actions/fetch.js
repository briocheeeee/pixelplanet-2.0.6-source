/*
 * Collect api fetch commands for actions here
 * (chunk and tiles requests in ui/ChunkLoader*.js)
 *
 */

import { t } from 'ttag';

import { dateToString, stringToTime } from '../../core/utils.js';
import { api } from '../../utils/utag.js';

const __reqCache = new Map();
const __pending = new Map();

function __ttlFor(url) {
  if (url.includes('/api/factions/leaderboard')) return 15000;
  if (url.includes('/api/factions/bytag')) return 15000;
  if (url.includes('/api/factions/profile')) return 15000;
  if (url.includes('/api/factions/mine')) return 3000;
  return 0;
}

function __cdKey(url) {
  try {
    const u = new URL(url, window.location.origin);
    return `fc:cd:${u.pathname}`;
  } catch {
    return `fc:cd:${url}`;
  }
}
function __cooldownActive(url) {
  try {
    const k = __cdKey(url);
    const v = Number(sessionStorage.getItem(k) || 0);
    return v && v > Date.now();
  } catch { return false; }
}
function __setCooldown(url, ms) {
  try {
    const k = __cdKey(url);
    sessionStorage.setItem(k, String(Date.now() + Math.max(1000, Number(ms) || 60000)));
  } catch {}
}

function __cacheGet(url) {
  const e = __reqCache.get(url);
  if (!e) {
    try {
      const raw = sessionStorage.getItem(`fc:${url}`);
      if (raw) {
        const o = JSON.parse(raw);
        if (o && o.t && o.d && (Date.now() - o.t) < (__ttlFor(url) || 0)) return o.d;
      }
    } catch {}
    return null;
  }
  if (e.x < Date.now()) { __reqCache.delete(url); return null; }
  return e.v;
}

function __cacheSet(url, data) {
  const ttl = __ttlFor(url);
  if (ttl <= 0) return;
  __reqCache.set(url, { v: data, x: Date.now() + ttl });
  try { sessionStorage.setItem(`fc:${url}`, JSON.stringify({ t: Date.now(), d: data })); } catch {}
}

function __invalidateFactionCaches() {
  const keys = Array.from(__reqCache.keys());
  const parts = ['/api/factions/leaderboard', '/api/factions/profile', '/api/factions/bytag', '/api/factions/mine'];
  keys.forEach((k) => { if (parts.some((p) => k.includes(p))) __reqCache.delete(k); });
  try {
    Object.keys(sessionStorage).forEach((k) => {
      if (k.startsWith('fc:')) {
        const u = k.slice(3);
        if (parts.some((p) => u.includes(p))) sessionStorage.removeItem(k);
      }
    });
  } catch {}
}

/*
 * Adds customizable timeout to fetch
 * defaults to 8s
 */
async function fetchWithTimeout(url, options = {}) {
  const { timeout = 30000 } = options;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  const response = await fetch(url, {
    ...options,
    signal: controller.signal,
  });
  clearTimeout(id);

  return response;
}

export async function requestFactionAdminList(q = '', page = 1, size = 20) {
  const qs = new URLSearchParams();
  if (q) qs.set('q', q);
  qs.set('page', String(page));
  qs.set('size', String(size));
  return makeAPIGETRequest(`/api/factions/admin/list?${qs.toString()}`);
}

export async function requestFactionAdminDelete(fid) {
  return makeAPIPOSTRequest('/api/factions/admin/delete', { fid });
}

export async function requestFactionLeaderboard(page = 1, size = 20) {
  return makeAPIGETRequest(`/api/factions/leaderboard?page=${page}&size=${size}`);
}

export async function requestFactionMine() {
  return makeAPIGETRequest('/api/factions/mine');
}

export async function requestFactionCreate(name, tag, joinPolicy) {
  return makeAPIPOSTRequest('/api/factions/create', { name, tag, joinPolicy });
}

export async function requestFactionJoin(fid) {
  return makeAPIPOSTRequest('/api/factions/join', { fid });
}

export async function requestFactionLeave() {
  return makeAPIPOSTRequest('/api/factions/leave', {});
}

export async function requestFactionApprove(uid) {
  return makeAPIPOSTRequest('/api/factions/approve', { uid });
}

export async function requestFactionDeny(uid) {
  return makeAPIPOSTRequest('/api/factions/deny', { uid });
}

export async function requestFactionKick(uid) {
  return makeAPIPOSTRequest('/api/factions/kick', { uid });
}

export async function requestFactionBan(uid) {
  return makeAPIPOSTRequest('/api/factions/ban', { uid });
}

export async function requestFactionUnban(uid) {
  return makeAPIPOSTRequest('/api/factions/unban', { uid });
}

export async function requestFactionExclude(country) {
  return makeAPIPOSTRequest('/api/factions/exclude', { country });
}

export async function requestFactionInclude(country) {
  return makeAPIPOSTRequest('/api/factions/include', { country });
}

export async function requestFactionUpdate(payload) {
  return makeAPIPOSTRequest('/api/factions/update', payload);
}

export async function requestFactionTransfer(newOwnerId, password) {
  return makeAPIPOSTRequest('/api/factions/transfer', { newOwnerId, password });
}

export async function requestFactionDelete(password) {
  return makeAPIPOSTRequest('/api/factions/delete', { password });
}

export async function requestFactionProfile(fid) {
  return makeAPIGETRequest(`/api/factions/profile?fid=${fid}`);
}

export async function requestFactionByTag(tag) {
  return makeAPIGETRequest(`/api/factions/bytag?tag=${encodeURIComponent(tag)}`);
}

export async function requestFactionInvites() {
  return makeAPIGETRequest('/api/factions/invites');
}

export async function requestFactionAcceptInvite(code) {
  return makeAPIPOSTRequest('/api/factions/accept_invite', { code });
}

export async function requestFactionAvatar(file) {
  const url = api`/api/factions/avatar`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: file,
    });
    return parseAPIresponse(response);
  } catch (e) {
    return { errors: [t`Could not connect to server, please try again later :(`] };
  }
}

/*
 * Parse response from API
 * @param response
 * @return Object of response
 */
async function parseAPIresponse(response) {
  const { status: code } = response;

  if (code === 429) {
    let error = t`You made too many requests`;
    const retryAfter = response.headers.get('Retry-After');
    if (!Number.isNaN(Number(retryAfter))) {
      const ti = Math.floor(retryAfter / 60);
      error += `, ${t`try again after ${ti}min`}`;
    }
    return {
      errors: [error],
    };
  }

  try {
    return await response.json();
  } catch (e) {
    return {
      errors: [t`Connection error ${code} :(`],
    };
  }
}

/*
 * Make API POST Request
 * @param url URL of post api endpoint
 * @param body Body of request
 * @return Object with response or error Array
 */
async function makeAPIPOSTRequest(
  url,
  body,
  credentials = true,
  addShard = true,
) {
  if (addShard) {
    url = api`${url}`;
  }
  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      credentials: (credentials) ? 'include' : 'omit',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (response.status === 429) {
      const ra = Number(response.headers.get('Retry-After') || 0) * 1000;
      __setCooldown(url, ra || 60000);
    }
    const out = await parseAPIresponse(response);
    if (!out?.errors && String(url).includes('/api/factions/')) {
      __invalidateFactionCaches();
    }
    return out;
  } catch (e) {
    return {
      errors: [t`Could not connect to server, please try again later :(`],
    };
  }
}

/*
 * Make API GET Request
 * @param url URL of get api endpoint
 * @return Object with response or error Array
 */
async function makeAPIGETRequest(
  url,
  credentials = true,
  addShard = true,
) {
  if (addShard) {
    url = api`${url}`;
  }
  try {
    if (__cooldownActive(url)) {
      const cached = __cacheGet(url);
      if (cached) return cached;
      return { errors: [t`You made too many requests`] };
    }
    const cached = __cacheGet(url);
    if (cached) return cached;
    const pend = __pending.get(url);
    if (pend) return pend;
    const p = (async () => {
      const response = await fetchWithTimeout(url, {
        credentials: (credentials) ? 'include' : 'omit',
      });
      if (response.status === 429) {
        const ra = Number(response.headers.get('Retry-After') || 0) * 1000;
        __setCooldown(url, ra || 60000);
      }
      const out = await parseAPIresponse(response);
      if (!out?.errors) __cacheSet(url, out);
      return out;
    })();
    __pending.set(url, p);
    try { return await p; } finally { __pending.delete(url); }
  } catch (e) {
    const cached = __cacheGet(url);
    if (cached) return cached;
    return { errors: [t`Could not connect to server, please try again later :(`] };
  }
}

/*
 * block / unblock user
 * @param userId id of user to block
 * @param block true if block, false if unblock
 * @return error string or null if successful
 */
export async function requestBlock(userId, block) {
  const res = await makeAPIPOSTRequest(
    '/api/block',
    { userId, block },
  );
  if (res.errors) {
    return res.errors[0];
  }
  if (res.status === 'ok') {
    return null;
  }
  return t`Unknown Error`;
}

/*
 * set / unset profile as private
 * @param priv
 * @return error string or null if successful
 */
export async function requestPrivatize(priv) {
  const res = await makeAPIPOSTRequest(
    '/api/privatize',
    { priv },
  );
  if (res.errors) {
    return res.errors[0];
  }
  if (res.status === 'ok') {
    return null;
  }
  return t`Unknown Error`;
}

/*
 * start new DM channel with user
 * @param query Object with either userId or userName: string
 * @return channel Array on success, error string if not
 */
export async function requestStartDm(query) {
  const res = await makeAPIPOSTRequest(
    '/api/startdm',
    query,
  );
  if (res.errors) {
    return res.errors[0];
  }
  if (res.channel) {
    return res.channel;
  }
  return t`Unknown Error`;
}

/*
 * set receiving of all DMs on/off
 * @param block true if blocking all dms, false if unblocking
 * @return error string or null if successful
 */
export async function requestBlockDm(block) {
  const res = await makeAPIPOSTRequest(
    '/api/blockdm',
    { block },
  );
  if (res.errors) {
    return res.errors[0];
  }
  if (res.status === 'ok') {
    return null;
  }
  return t`Unknown Error`;
}

/*
 * leaving Chat Channel (i.e. DM channel)
 * @param channelId integer id of channel
 * @return error string or null if successful
 */
export async function requestLeaveChan(channelId) {
  const res = await makeAPIPOSTRequest(
    '/api/leavechan',
    { channelId },
  );
  if (res.errors) {
    return res.errors[0];
  }
  if (res.status === 'ok') {
    return null;
  }
  return t`Unknown Error`;
}

export async function requestSolveCaptcha(text, captchaid) {
  const res = await makeAPIPOSTRequest(
    '/api/captcha',
    { text, id: captchaid },
  );
  if (!res.errors && !res.success) {
    return {
      errors: [t`Server answered with gibberish :(`],
    };
  }
  return res;
}

export async function requestHistoricalTimes(day, canvasId) {
  try {
    const date = dateToString(day);
    // Not going over shard url
    const url = api`/history?day=${date}&id=${canvasId}`;
    const response = await fetchWithTimeout(url, {
      credentials: 'omit',
      timeout: 45000,
    });
    if (response.status !== 200) {
      return [];
    }
    const times = await response.json();
    return times.map(stringToTime);
  } catch {
    return [];
  }
}

export async function requestChatMessages(cid) {
  const response = await fetch(
    api`/api/chathistory?cid=${cid}&limit=50`,
    { credentials: 'include' },
  );
  // timeout in order to not spam api requests and get rate limited
  if (response.ok) {
    const { history } = await response.json();
    return history;
  }
  return null;
}

export function requestPasswordChange(newPassword, password) {
  return makeAPIPOSTRequest(
    '/api/auth/change_passwd',
    { password, newPassword },
  );
}

export async function requestResendVerify() {
  return makeAPIGETRequest(
    '/api/auth/resend_verify',
  );
}

export async function requestLogOut() {
  const ret = makeAPIGETRequest(
    '/api/auth/logout',
  );
  return !ret.errors;
}

export function requestNameChange(name) {
  return makeAPIPOSTRequest(
    '/api/auth/change_name',
    { name },
  );
}

export function requestUsernameChange(username) {
  return makeAPIPOSTRequest(
    '/api/auth/change_username',
    { username },
  );
}

export function requestMailChange(email, password) {
  return makeAPIPOSTRequest(
    '/api/auth/change_mail',
    { email, password },
  );
}

export function requestLogin(nameoremail, password, durationsel) {
  return makeAPIPOSTRequest(
    '/api/auth/local',
    { nameoremail, password, durationsel },
  );
}

export function requestRegistration(
  name, username, email, password, durationsel,
  captcha, captchaid, challengeSolution,
) {
  const body = {
    name, username, email, password, durationsel,
    captcha, captchaid,
  };
  if (challengeSolution) {
    body.cs = challengeSolution;
  }
  return makeAPIPOSTRequest('/api/auth/register', body);
}

export function requestNewPassword(email) {
  return makeAPIPOSTRequest(
    '/api/auth/restore_password',
    { email },
  );
}

export function requestDeleteAccount(password) {
  return makeAPIPOSTRequest(
    '/api/auth/delete_account',
    { password },
  );
}

export function requestRemoveTpid(id, password) {
  return makeAPIPOSTRequest(
    '/api/auth/remove_tpid',
    { id, password },
  );
}

export function requestRankings() {
  const ts = Date.now();
  return makeAPIGETRequest(
    `/ranking?ts=${ts}`,
    false,
    false,
  );
}

export function requestProfile() {
  return makeAPIGETRequest(
    '/api/profile',
  );
}

export function requestUserPublicProfile(uid) {
  return makeAPIGETRequest(
    `/api/user/profile?uid=${uid}`,
  );
}

export function requestUserPrivacy(uid) {
  return makeAPIGETRequest(
    `/api/user/profile?uid=${uid}`,
  );
}

export function requestTpids() {
  return makeAPIGETRequest(
    '/api/auth/get_tpids',
  );
}

export function requestBanInfo() {
  return makeAPIGETRequest(
    '/api/baninfo',
  );
}

export async function requestMe() {
  if (window.me) {
    // api/me gets pre-fetched by embedded script in html
    const response = await window.me;
    delete window.me;
    return parseAPIresponse(response);
  }
  return makeAPIGETRequest(
    '/api/me',
  );
}

export function requestIID() {
  return makeAPIGETRequest(
    '/api/getiid',
  );
}

export function requestBanMe(code) {
  return makeAPIPOSTRequest(
    '/api/banme',
    { code },
  );
}

export async function requestUploadAvatar(file) {
  const url = api`/api/avatar`;
  const form = new FormData();
  form.append('avatar', file);
  try {
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    return parseAPIresponse(response);
  } catch (e) {
    return {
      errors: [t`Could not connect to server, please try again later :(`],
    };
  }
}
