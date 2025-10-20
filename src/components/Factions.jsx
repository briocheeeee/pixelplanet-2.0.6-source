import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { t } from 'ttag';
import { shallowEqual, useSelector } from 'react-redux';
import {
  requestFactionLeaderboard,
  requestFactionMine,
  requestFactionCreate,
  requestFactionJoin,
  requestFactionLeave,
  requestFactionApprove,
  requestFactionDeny,
  requestFactionKick,
  requestFactionBan,
  requestFactionUnban,
  requestFactionExclude,
  requestFactionInclude,
  requestFactionUpdate,
  requestFactionTransfer,
  requestFactionProfile,
  requestFactionInvites,
  requestFactionAcceptInvite,
  requestFactionAvatar,
  requestFactionByTag,
  requestFactionDelete,
} from '../store/actions/fetch.js';
import WindowContext from './context/window.js';
import { useDispatch } from 'react-redux';
import { openWindow } from '../store/actions/windows.js';

function Row({ children }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
  );
}

const __domColorCache = new Map();
function useDominantColor(src) {
  const [color, setColor] = useState('');
  useEffect(() => {
    if (!src) { setColor(''); return; }
    const cached = __domColorCache.get(src);
    if (cached) { setColor(cached); return; }
    let active = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = 48; const h = 48;
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);
        const counts = new Map();
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 32) continue;
          const r = data[i] >> 4;
          const g = data[i + 1] >> 4;
          const b = data[i + 2] >> 4;
          const key = (r << 8) | (g << 4) | b;
          counts.set(key, (counts.get(key) || 0) + 1);
        }
        let best = 0; let keyBest = 0;
        counts.forEach((v, k) => { if (v > best) { best = v; keyBest = k; } });
        const r = ((keyBest >> 8) & 0xF) * 17;
        const g = ((keyBest >> 4) & 0xF) * 17;
        const b = (keyBest & 0xF) * 17;
        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        __domColorCache.set(src, hex);
        if (active) setColor(hex);
      } catch {
        if (active) setColor('');
      }
    };
    img.onerror = () => { if (active) setColor(''); };
    img.src = src;
    return () => { active = false; };
  }, [src]);
  return color;
}

function FactionTag({ tag, avatar, onClick }) {
  const c = useDominantColor(avatar);
  return (
    <span className="modallink" role="button" tabIndex={-1} onClick={onClick} style={{ color: c || undefined }}>
      [{tag}]
    </span>
  );
}


function Button({ onClick, children, disabled, style }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={style}>{children}</button>
  );
}

function SectionTabs({ active, onChange, showMine, showCreate }) {
  const items = [
    { k: 'leaderboard', n: t`Leaderboard` },
    ...(showMine ? [{ k: 'mine', n: t`My Faction` }] : []),
    ...(showCreate ? [{ k: 'create', n: t`Create Faction` }] : []),
  ];
  return (
    <div className="content" style={{ marginBottom: 8 }}>
      {items.map((it, i) => (
        <span
          key={it.k}
          role="button"
          tabIndex={-1}
          className={(active === it.k) ? 'modallink selected' : 'modallink'}
          onClick={() => onChange(it.k)}
        > {it.n}</span>
      )).reduce((acc, el, i) => (i ? acc.concat([<span key={`d${i}`} className="hdivider" />, el]) : [el]), [])}
    </div>
  );
}

function useWebp256() {
  const toWebp256 = useCallback((file) => new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const ir = img.width / img.height;
        const tr = 1;
        let sx = 0; let sy = 0; let sw = img.width; let sh = img.height;
        if (ir > tr) {
          sw = img.height * tr;
          sx = (img.width - sw) / 2;
        } else if (ir < tr) {
          sh = img.width / tr;
          sy = (img.height - sh) / 2;
        }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          if (blob) resolve(new File([blob], `${Date.now()}.webp`, { type: 'image/webp' }));
          else resolve(file);
        }, 'image/webp', 0.85);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    } catch {
      resolve(file);
    }
  }), []);
  return toWebp256;
}

function Leaderboard({ onJoined, hasFaction }) {
  const [page, setPage] = useState(1);
  const size = 100;
  const [data, setData] = useState([]);
  const [busy, setBusy] = useState(false);
  const dispatch = useDispatch();
  const [requested, setRequested] = useState(() => new Set());

  const load = useCallback(async (pg = page, sz = size) => {
    setBusy(true);
    const res = await requestFactionLeaderboard(pg, sz);
    setBusy(false);
    if (!res.errors) {
      setData(res.data || []);
    }
  }, [page, size]);

  useEffect(() => { load(1, size); }, []);
  useEffect(() => {
    const id = setInterval(() => { load(page, size); }, 300000);
    return () => clearInterval(id);
  }, [page, size, load]);

  return (
    <div>
      <Row>
        <span className="modallink" role="button" tabIndex={-1} onClick={() => { if (page > 1) { setPage(page - 1); load(page - 1, size); } }}>{t`Prev`}</span>
        <span className="modallink" role="button" tabIndex={-1} onClick={() => { setPage(page + 1); load(page + 1, size); }}>{t`Next`}</span>
        <span className="hdivider" />
        <span style={{ opacity: 0.7 }}>{t`Page`} {page} · {size}</span>
      </Row>
      <div style={{ overflowX: 'auto', width: '100%' }}>
      <table style={{ display: 'inline', minWidth: 720 }}>
        <thead>
          <tr>
            <th>#</th>
            <th>{t`Avatar`}</th>
            <th>{t`Tag`}</th>
            <th>{t`Name`}</th>
            <th>{t`Members`}</th>
            <th>{t`Pixels`}</th>
            <th>{t`Pixels Today`}</th>
            <th>{t`Action`}</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ textAlign: 'center', opacity: 0.75 }}>{t`No factions`}</td>
            </tr>
          ) : data.map((f) => (
            <tr key={f.id}>
              <td className="c-num">{f.rank}</td>
              <td>{f.avatar ? (<img alt="" src={f.avatar} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />) : null}</td>
              <td>
                <FactionTag tag={f.tag} avatar={f.avatar} onClick={() => dispatch(openWindow('FACTION_PROFILE', false, '', { tag: f.tag }))} />
              </td>
              <td>{f.name}</td>
              <td className="c-num">{f.memberCount}</td>
              <td className="c-num">{f.total}</td>
              <td className="c-num">{f.daily}</td>
              <td>
                {(!hasFaction && f.joinPolicy === 0) && (
                  <span className="modallink" role="button" tabIndex={-1} onClick={async () => { const r = await requestFactionJoin(f.id); if (!r.errors) onJoined && onJoined(); }}>{t`Join`}</span>
                )}
                {(!hasFaction && f.joinPolicy === 1) && (
                  requested.has(f.id) ? (
                    <span style={{ opacity: 0.75 }}>{t`Requested`}</span>
                  ) : (
                    <span className="modallink" role="button" tabIndex={-1} onClick={async () => { const r = await requestFactionJoin(f.id); if (!r.errors) { try { if (r.status === 'pending') { setRequested((s) => new Set(s).add(f.id)); } } catch {} } }}>{t`Request`}</span>
                  )
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {busy && <div style={{ textAlign: 'center', fontSize: 12, opacity: 0.7 }}>{t`Loading...`}</div>}
      <div style={{ fontSize: 14, opacity: 1.0, margin: '6px 0' }}>{t`Faction ranking updates every 5 min.`}</div>
    </div>
  );
}

function MyFaction({ onFactionChanged }) {
  const uid = useSelector((s) => s.user.id);
  const userlvl = useSelector((s) => s.user.userlvl);
  const dispatch = useDispatch();
  const [mine, setMine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [invite, setInvite] = useState('');
  const [editing, setEditing] = useState(false);
  const [p, setP] = useState({ name: '', tag: '', joinPolicy: 0 });
  const [profile, setProfile] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await requestFactionMine();
    setLoading(false);
    if (!res.errors) {
      setMine(res);
      if (res.faction) {
        setP({ name: res.faction.name, tag: res.faction.tag, joinPolicy: res.faction.joinPolicy });
        if (res.faction.joinPolicy === 2) {
          const code = res.invite || null;
          if (code) setInvite(`${window.location.origin}/invite/${code}`);
          else {
            const inv = await requestFactionInvites();
            if (!inv.errors && inv.code) setInvite(`${window.location.origin}/invite/${inv.code}`);
          }
        } else setInvite('');
      } else {
        onFactionChanged && onFactionChanged(false);
      }
    }
  }, []);

  useEffect(() => { load(); }, []);

  const isOwner = mine && mine.faction && mine.faction.ownerId === uid;

  

  const copyInvite = useCallback(async () => {
    const res = await requestFactionInvites();
    if (!res.errors && res.code) {
      const link = `${window.location.origin}/invite/${res.code}`;
      setInvite(link);
      try { await navigator.clipboard.writeText(link); } catch {}
      setStatus(t`Invitation link copied`);
    }
  }, []);

  const onSave = useCallback(async () => {
    setStatus('');
    const res = await requestFactionUpdate({ name: p.name, tag: p.tag, joinPolicy: Number(p.joinPolicy) });
    if (res.errors) setStatus(res.errors[0] || t`Error`);
    else { setEditing(false); load(); }
  }, [p, load]);

  const onLeave = useCallback(async () => {
    setStatus('');
    const res = await requestFactionLeave();
    if (res.errors) setStatus(res.errors[0] || t`Error`);
    else { onFactionChanged && onFactionChanged(false); load(); }
  }, [load, onFactionChanged]);

  const onApprove = useCallback(async (rid) => {
    setStatus('');
    const res = await requestFactionApprove(rid);
    if (res.errors) { setStatus(res.errors[0] || t`Error`); return; }
    setMine((m) => (m ? { ...m, requests: (m.requests || []).filter((r) => r.uid !== rid) } : m));
  }, []);

  const onDeny = useCallback(async (rid) => {
    setStatus('');
    const res = await requestFactionDeny(rid);
    if (res.errors) { setStatus(res.errors[0] || t`Error`); return; }
    setMine((m) => (m ? { ...m, requests: (m.requests || []).filter((r) => r.uid !== rid) } : m));
  }, []);

  if (loading) return <div style={{ textAlign: 'center' }}>{t`Loading...`}</div>;
  if (!mine || !mine.faction) return <div style={{ textAlign: 'center' }}>{t`No faction`}</div>;

  const { faction, members, requests, bans, excludes } = mine;

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {faction.avatar && (
          <img alt="" src={faction.avatar} style={{ width: 96, height: 96, maxWidth: '24vw', maxHeight: '24vw', borderRadius: '50%', objectFit: 'cover' }} />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <FactionTag tag={faction.tag} avatar={faction.avatar} onClick={() => { dispatch(openWindow('FACTION_PROFILE', false, '', { tag: faction.tag })); }} />
            <span style={{ fontSize: 18 }}>{faction.name}</span>
          </div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>{t`Members`}: {faction.memberCount}</div>
        </div>
      </div>
      {isOwner && (
        <div style={{ display: 'grid', gap: 8 }}>
          {!editing && (
            <div style={{ display: 'grid', gap: 6 }}>
              <Row>
                <Button onClick={() => setEditing(true)}>{t`Edit Settings`}</Button>
              </Row>
              {(faction.joinPolicy === 2) && (
                <Row>
                  <input readOnly value={invite} placeholder={t`Invite link`} style={{ width: 'min(520px, 100%)' }} />
                  <Button onClick={copyInvite}>{t`Copy`}</Button>
                </Row>
              )}
            </div>
          )}
          {editing && (
            <div style={{ display: 'grid', gap: 6 }}>
              <Row>
                <input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder={t`Name`} maxLength={24} />
                <input value={p.tag} onChange={(e) => setP({ ...p, tag: e.target.value.toUpperCase() })} placeholder={t`Tag`} maxLength={4} style={{ width: 70 }} />
                <select value={p.joinPolicy} onChange={(e) => setP({ ...p, joinPolicy: Number(e.target.value) })}>
                  <option value={0}>{t`open`}</option>
                  <option value={1}>{t`request`}</option>
                  <option value={2}>{t`invite_only`}</option>
                </select>
                <Button onClick={onSave}>{t`Save`}</Button>
                <Button onClick={() => setEditing(false)}>{t`Cancel`}</Button>
              </Row>
            </div>
          )}
          <OwnerTools faction={faction} onChanged={load} />
        </div>
      )}
      {!isOwner && (
        <Row>
          <Button onClick={onLeave}>{t`Leave Faction`}</Button>
        </Row>
      )}
      <MembersList members={members} ownerId={faction.ownerId} isOwner={isOwner} onChanged={load} />
      {isOwner && bans && bans.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{t`Banned Users`}</div>
          <div style={{ overflowX: 'auto', width: '100%' }}>
          <table style={{ display: 'inline', minWidth: 420 }}>
            <thead>
              <tr>
                <th>{t`User`}</th>
                <th>{t`ID`}</th>
                <th>{t`Actions`}</th>
              </tr>
            </thead>
            <tbody>
              {bans.map((b) => (
                <tr key={b.uid}>
                  <td>{b.name}</td>
                  <td className="c-num">{b.uid}</td>
                  <td>
                    <span className="modallink" role="button" tabIndex={-1} onClick={async () => { const r = await requestFactionUnban(b.uid); if (!r.errors) load(); }}>{t`Unban`}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
      {isOwner && excludes && excludes.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{t`Excluded Countries`}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {excludes.map((e) => (
              <div key={e.country} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span className="statvalue">{e.country}</span>
                <span className="modallink" role="button" tabIndex={-1} onClick={async () => { const r = await requestFactionInclude(e.country); if (!r.errors) load(); }}>{t`Remove`}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {isOwner && faction.joinPolicy === 1 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{t`Join Requests`}</div>
          {(requests && requests.length > 0) ? (
            <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ display: 'inline', minWidth: 420 }}>
              <thead>
                <tr>
                  <th>{t`User`}</th>
                  <th>{t`ID`}</th>
                  <th>{t`Actions`}</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.uid}>
                    <td>{r.name}</td>
                    <td className="c-num">{r.uid}</td>
                    <td>
                      <span className="modallink" role="button" tabIndex={-1} onClick={() => onApprove(r.uid)}>{t`Approve`}</span>
                      <span className="hdivider" />
                      <span className="modallink" role="button" tabIndex={-1} onClick={() => onDeny(r.uid)}>{t`Deny`}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          ) : <div style={{ opacity: 0.75 }}>{t`No requests`}</div>}
        </div>
      )}
      {status && <div style={{ textAlign: 'center', fontSize: 12 }}>{status}</div>}
    </div>
  );
}

function OwnerTools({ faction, onChanged }) {
  const [status, setStatus] = useState('');
  const [country, setCountry] = useState('');
  const [password, setPassword] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [delPassword, setDelPassword] = useState('');

  const onExclude = useCallback(async () => {
    const res = await requestFactionExclude(country);
    if (res.errors) setStatus(res.errors[0] || t`Error`); else { setCountry(''); onChanged(); }
  }, [country, onChanged]);

  const onInclude = useCallback(async () => {
    const res = await requestFactionInclude(country);
    if (res.errors) setStatus(res.errors[0] || t`Error`); else { setCountry(''); onChanged(); }
  }, [country, onChanged]);

  const onTransfer = useCallback(async () => {
    const uid = Number(transferTo || 0);
    if (!uid) return;
    const res = await requestFactionTransfer(uid, password);
    if (res.errors) setStatus(res.errors[0] || t`Error`); else { setStatus(t`Transferred`); setPassword(''); setTransferTo(''); onChanged(); }
  }, [transferTo, password, onChanged]);

  const onDelete = useCallback(async () => {
    setStatus('');
    const res = await requestFactionDelete(delPassword);
    if (res.errors) setStatus(res.errors[0] || t`Error`); else { setStatus(t`Deleted`); setDelPassword(''); onChanged(); }
  }, [delPassword, onChanged]);

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <Row>
        <input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} placeholder={t`Country ISO-2`} maxLength={2} style={{ width: 90 }} />
        <Button onClick={onExclude}>{t`Exclude`}</Button>
      </Row>
      <Row>
        <input value={transferTo} onChange={(e) => setTransferTo(e.target.value)} placeholder={t`New Owner Id`} style={{ width: 140 }} />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t`Password`} style={{ width: 140 }} />
        <Button onClick={onTransfer}>{t`Transfer Ownership`}</Button>
      </Row>
      <Row>
        <input type="password" value={delPassword} onChange={(e) => setDelPassword(e.target.value)} placeholder={t`Password`} style={{ width: 140 }} />
        <Button onClick={onDelete}>{t`Delete Faction`}</Button>
      </Row>
      {status && <div style={{ textAlign: 'center', fontSize: 12 }}>{status}</div>}
    </div>
  );
}

function MembersList({ members, ownerId, isOwner, onChanged }) {
  const [status, setStatus] = useState('');
  const currentId = useSelector((s) => s.user.id);
  const sorted = React.useMemo(() => {
    const arr = Array.isArray(members) ? members.slice(0) : [];
    arr.sort((a, b) => {
      const ar = a.uid === ownerId ? 1 : 0;
      const br = b.uid === ownerId ? 1 : 0;
      if (br - ar) return br - ar;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    return arr;
  }, [members, ownerId]);

  const onKick = useCallback(async (uid) => {
    const res = await requestFactionKick(uid);
    if (res.errors) setStatus(res.errors[0] || t`Error`); else onChanged();
  }, [onChanged]);

  const onBan = useCallback(async (uid) => {
    const res = await requestFactionBan(uid);
    if (res.errors) setStatus(res.errors[0] || t`Error`); else onChanged();
  }, [onChanged]);

  return (
    <div>
      <div style={{ overflowX: 'auto', width: '100%' }}>
      <table style={{ display: 'inline', minWidth: 520 }}>
        <thead>
          <tr>
            <th>{t`User`}</th>
            <th>{t`ID`}</th>
            <th>{t`Role`}</th>
            <th>{t`Joined`}</th>
            {isOwner && <th>{t`Actions`}</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((m) => (
            <tr key={m.uid}>
              <td>{m.name}</td>
              <td className="c-num">{m.uid}</td>
              <td>{(m.uid === ownerId || m.role === 1) ? t`Owner` : t`Member`}</td>
              <td>{new Date(m.joinedAt).toLocaleString()}</td>
              {isOwner && m.uid !== currentId && m.uid !== ownerId && (
                <td>
                  <span className="modallink" role="button" tabIndex={-1} onClick={() => onKick(m.uid)}>{t`Kick`}</span>
                  <span className="hdivider" />
                  <span className="modallink" role="button" tabIndex={-1} onClick={() => onBan(m.uid)}>{t`Ban`}</span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {status && <div style={{ textAlign: 'center', fontSize: 12 }}>{status}</div>}
    </div>
  );
}

function CreateFaction({ onCreated, setTab }) {
  const toWebp256 = useWebp256();
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [policy, setPolicy] = useState(0);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (file) {
      try {
        setPreviewUrl(URL.createObjectURL(file));
        return () => { try { URL.revokeObjectURL(previewUrl); } catch {} };
      } catch {}
    } else {
      setPreviewUrl('');
    }
    return undefined;
  }, [file]);

  const onCreate = useCallback(async () => {
    setStatus('');
    if (!name || tag.length < 2 || tag.length > 4) { setStatus(t`Invalid name or tag`); return; }
    setBusy(true);
    const res = await requestFactionCreate(name, tag.toUpperCase(), Number(policy));
    setBusy(false);
    if (res.errors) { setStatus(res.errors[0] || t`Error`); return; }
    if (file) {
      const optimized = await toWebp256(file);
      await requestFactionAvatar(optimized);
    }
    setStatus(t`Faction created`);
    onCreated && onCreated(true);
    setTab && setTab('mine');
  }, [name, tag, policy, file, toWebp256, onCreated, setTab]);

  return (
    <div style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
      <Row>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t`Name`} maxLength={24} />
        <input value={tag} onChange={(e) => setTag(e.target.value.toUpperCase())} placeholder={t`Tag`} maxLength={4} style={{ width: 80 }} />
        <select value={policy} onChange={(e) => setPolicy(Number(e.target.value))}>
          <option value={0}>{t`open`}</option>
          <option value={1}>{t`request`}</option>
          <option value={2}>{t`invite_only`}</option>
        </select>
      </Row>
      <Row>
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files && e.target.files[0])} />
      </Row>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        {previewUrl && (
          <img alt="" src={previewUrl} style={{ width: 96, height: 96, maxWidth: '24vw', maxHeight: '24vw', borderRadius: '50%', objectFit: 'cover' }} />
        )}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18 }}>{tag ? `[${tag.toUpperCase()}] ` : ''}{name}</div>
        </div>
      </div>
      <Button onClick={onCreate} disabled={busy}>{busy ? t`Creating...` : t`Create`}</Button>
      {status && <div style={{ textAlign: 'center', fontSize: 12 }}>{status}</div>}
    </div>
  );
}

const Factions = () => {
  const id = useSelector((s) => s.user.id);
  const [tab, setTab] = useState('leaderboard');
  const [hasFaction, setHasFaction] = useState(false);
  const { args } = React.useContext(WindowContext);

  useEffect(() => {
    if (!id) { setHasFaction(false); return; }
    requestFactionMine().then((res) => {
      setHasFaction(!!res?.faction);
    });
  }, [id]);

  useEffect(() => {
    if (!id && tab !== 'leaderboard') setTab('leaderboard');
  }, [id, tab]);

  useEffect(() => {
    if (!hasFaction && tab === 'mine') setTab('leaderboard');
  }, [hasFaction, tab]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('invite');
    if (code) {
      requestFactionAcceptInvite(code).then((res) => {
        if (!res?.errors) {
          setHasFaction(true);
          setTab('mine');
          const p = new URLSearchParams(window.location.search);
          p.delete('invite');
          const base = window.location.pathname + (p.toString() ? `?${p}` : '') + window.location.hash;
          window.history.replaceState({}, '', base);
        }
      });
    }
  }, []);

  useEffect(() => {}, [args]);

  return (
    <div>
      <SectionTabs active={tab} onChange={setTab} showMine={id && hasFaction} showCreate={id && !hasFaction} />
      
      {tab === 'leaderboard' && <Leaderboard onJoined={() => { setHasFaction(true); setTab('mine'); }} hasFaction={hasFaction} />}
      {tab === 'mine' && id && hasFaction ? <MyFaction onFactionChanged={(v) => setHasFaction(!!v)} /> : null}
      {tab === 'create' && id && !hasFaction ? <CreateFaction onCreated={(v) => setHasFaction(!!v)} setTab={setTab} /> : null}
      {(!id && tab !== 'leaderboard') && (
        <div style={{ textAlign: 'center' }}>{t`Log in to manage factions`}</div>
      )}
    </div>
  );
};

export default React.memo(Factions);
