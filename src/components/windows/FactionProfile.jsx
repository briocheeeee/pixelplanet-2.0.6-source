import React, { useEffect, useState, useContext, useMemo, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { t } from 'ttag';

import WindowContext from '../context/window.js';
import { requestFactionByTag, requestFactionProfile, requestFactionJoin } from '../../store/actions/fetch.js';
import { numberToString } from '../../core/utils.js';

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

const FactionProfile = () => {
  const { args: { tag, fid }, setTitle } = useContext(WindowContext);
  const dispatch = useDispatch();
  const hasFaction = useSelector((s) => Boolean(s.user?.factionTag));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [joining, setJoining] = useState(false);
  const [requested, setRequested] = useState(false);

  const faction = data?.faction || null;
  const tagColor = useDominantColor(faction?.avatar);
  const stats = useMemo(() => ({
    totalPixels: Number(data?.stats?.totalPixels || 0),
    dailyPixels: Number(data?.stats?.dailyPixels || 0),
    rank: Number(data?.stats?.rank || 0),
  }), [data?.stats?.totalPixels, data?.stats?.dailyPixels, data?.stats?.rank]);

  useEffect(() => {
    if (faction?.name) setTitle(faction.name);
  }, [setTitle, faction?.name]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const run = async () => {
      let res;
      if (tag) {
        res = await requestFactionByTag(tag);
      } else if (fid) {
        res = await requestFactionProfile(fid);
      }
      if (!active) return;
      if (res?.errors) {
        setError(res.errors[0] || t`Unknown error`);
        setLoading(false);
        return;
      }
      setData(res);
      if (res?.faction?.name) setTitle(res.faction.name);
      setLoading(false);
    };
    run();
    return () => { active = false; };
  }, [tag, fid]);

  const onJoin = useCallback(async () => {
    if (!faction || joining) return;
    setJoining(true);
    const res = await requestFactionJoin(faction.id);
    setJoining(false);
    if (res?.errors) {
      setError(res.errors[0] || t`Error`);
      return;
    }
    setError('');
    if (res?.status === 'pending') {
      setRequested(true);
    } else {
      setData((d) => (d ? { ...d, joined: true } : d));
    }
  }, [faction, joining]);

  return (
    <div className="content">
      {loading && <div style={{ textAlign: 'center' }}>{t`Loading...`}</div>}
      {!loading && error && (
        <div style={{ textAlign: 'center' }}>{error}</div>
      )}
      {!loading && !error && faction && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 8, paddingBottom: 8 }}>
            {faction.avatar && (
              <img
                src={`${String(faction.avatar)}`}
                alt={faction.name}
                style={{ width: 112, height: 112, maxWidth: '28vw', maxHeight: '28vw', borderRadius: '50%', objectFit: 'cover' }}
              />
            )}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18 }}><span style={{ color: tagColor }}>[{faction.tag}]</span> {faction.name}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>{t`Members`}: {numberToString(faction.memberCount || 0)}</div>
            </div>
          </div>
          <div style={{ height: 1, background: 'currentColor', opacity: 0.15, margin: '4px 0 8px 0' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 6, justifyItems: 'center' }}>
            <p style={{ margin: 0, textAlign: 'center' }}><span className="stattext">{t`Total Pixels`}: </span>&nbsp;<span className="statvalue">{numberToString(stats.totalPixels)}</span></p>
            <p style={{ margin: 0, textAlign: 'center' }}><span className="stattext">{t`Pixels Today`}: </span>&nbsp;<span className="statvalue">{numberToString(stats.dailyPixels)}</span></p>
            <p style={{ margin: 0, textAlign: 'center' }}><span className="stattext">{t`Rank`}: #</span>&nbsp;<span className="statvalue">{numberToString(stats.rank, 'N/A')}</span></p>
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 8 }}>
            {(!hasFaction && faction?.joinPolicy === 0) && (
              <div className="modallink" role="button" tabIndex={0} onClick={onJoin}>{joining ? t`Joining...` : t`Join`}</div>
            )}
            {(!hasFaction && faction?.joinPolicy === 1) && (
              requested ? (
                <div style={{ opacity: 0.75 }}>{t`Request Pending`}</div>
              ) : (
                <div className="modallink" role="button" tabIndex={0} onClick={onJoin}>{t`Request`}</div>
              )
            )}
            {(!hasFaction && faction?.joinPolicy === 2) && (
              <div style={{ opacity: 0.75 }}>{t`Invite Only`}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default React.memo(FactionProfile);
