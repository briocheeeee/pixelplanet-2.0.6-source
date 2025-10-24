import React, { useEffect, useState, useContext, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';

import WindowContext from '../context/window.js';
import { requestUserPublicProfile } from '../../store/actions/fetch.js';
import { FISH_TYPES } from '../../core/constants.js';
import { setBrightness, colorFromText, numberToString, numberToStringFull, escapeMd } from '../../core/utils.js';
import { cdn } from '../../utils/utag.js';
import { openChatWindow, openWindow } from '../../store/actions/windows.js';
import { startDm } from '../../store/actions/thunks.js';
import { sendChatTyping } from '../../store/actions/index.js';
import { setUserBlock } from '../../store/actions/thunks.js';
import { selectChatWindowStatus } from '../../store/selectors/windows.js';

const UserProfile = () => {
  const { args: { uid, name }, setTitle } = useContext(WindowContext);
  const dispatch = useDispatch();
  const chatOpen = useSelector(selectChatWindowStatus);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [avatarVersion, setAvatarVersion] = useState(0);

  useEffect(() => {
    setTitle(name || t`User Profile`);
  }, [setTitle, name]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    requestUserPublicProfile(uid).then((res) => {
      if (!active) return;
      if (res?.errors) {
        setError(res.errors[0] || t`Unknown error`);
        setLoading(false);
        return;
      }
      if (res?.private) {
        setError(t`This user has the private mode activated`);
        setLoading(false);
        return;
      }
      setData(res);
      if (res?.user?.name) {
        setTitle(res.user.name);
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [uid]);

  const rawFishes = data?.fishes;
  const fishes = useMemo(() => (Array.isArray(rawFishes) ? rawFishes : []), [rawFishes]);
  const user = useMemo(() => ({
    name: String(data?.user?.name || ''),
    username: String(data?.user?.username || ''),
    avatar: data?.user?.avatar || null,
  }), [data?.user?.name, data?.user?.username, data?.user?.avatar]);
  const stats = useMemo(() => ({
    totalPixels: Number(data?.stats?.totalPixels || 0),
    dailyTotalPixels: Number(data?.stats?.dailyTotalPixels || 0),
    ranking: Number(data?.stats?.ranking || 0),
    dailyRanking: Number(data?.stats?.dailyRanking || 0),
  }), [data?.stats?.totalPixels, data?.stats?.dailyTotalPixels, data?.stats?.ranking, data?.stats?.dailyRanking]);

  useEffect(() => {
    if (user?.avatar) setAvatarVersion(Date.now());
  }, [user?.avatar]);

  const uniqueFishCount = useMemo(() => {
    try {
      return new Set(fishes.filter((f) => f && Number.isInteger(f.type)).map((f) => f.type)).size;
    } catch {
      return 0;
    }
  }, [fishes]);

  const handleStartDm = useCallback(() => {
    dispatch(startDm({ userId: uid }, (cid) => {
      dispatch(openWindow(
        'CHAT',
        true,
        '',
        { chatChannel: Number(cid) },
        false,
        true,
      ));
      setTimeout(() => {
        const el = document.querySelector('.chtipt');
        if (el) {
          el.focus();
          const len = el.value?.length || 0;
          try { el.setSelectionRange(len, len); } catch {}
        }
      }, 0);
    }));
  }, [dispatch, uid]);

  const handlePing = useCallback(() => {
    if (!chatOpen) dispatch(openChatWindow());
    setTimeout(() => {
      const el = document.querySelector('.chtipt');
      if (el) {
        const mention = `@[${escapeMd(user.name || user.username)}](${uid}) `;
        const v = String(el.value || '');
        if (!v.startsWith(mention)) {
          el.value = mention + v;
        }
        el.focus();
        const len = el.value.length;
        try { el.setSelectionRange(len, len); } catch {}
      }
    }, 0);
  }, [chatOpen, dispatch, uid, user.name, user.username]);

  const handleBlock = useCallback(() => {
    dispatch(setUserBlock(uid, user.name || user.username, true));
  }, [dispatch, uid, user.name, user.username]);

  const fishItems = useMemo(() => {
    try {
      return fishes.map((f, idx) => {
        const type = (f && Number.isInteger(f.type)) ? f.type : -1;
        const size = (f && Number.isFinite(f.size)) ? f.size : 0;
        const ts = (f && (f.ts || f.ts === 0)) ? f.ts : idx;
        const ft = (type >= 0 && FISH_TYPES[type]) ? FISH_TYPES[type] : null;
        const fishName = String(ft?.name || 'fish');
        const shortname = fishName.toLowerCase().split(' ').join('').replace(/[^a-z0-9]/g, '') || 'fish';
        const key = `${type}-${ts}`;
        const backgroundColor = setBrightness(colorFromText(String(shortname)), false);
        return (
          <span
            key={key}
            className="profilefish"
            style={{ backgroundColor }}
            title={fishName}
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              if (type >= 0) {
                dispatch(openWindow('FISH_DISPLAY', true, `Fish Display - ${fishName}`, { type, size, ts }, false, true, null, null, 320, 380));
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (type >= 0) {
                  dispatch(openWindow('FISH_DISPLAY', true, `Fish Display - ${fishName}`, { type, size, ts }, false, true, null, null, 320, 380));
                }
              }
            }}
          >
            <img
              className={`profilefish-img ${shortname}`}
              src={cdn`/phishes/thumb/${shortname}.webp`}
              alt={fishName}
            />
            <span style={{ color: `hsl(${Math.floor(size / 25 * 120)}, 70%, 75%)` }}>
              <span className="profilefish-size">{size}</span>&nbsp;kg
            </span>
          </span>
        );
      });
    } catch {
      return null;
    }
  }, [fishes]);

  return (
    <div className="content">
      {loading && <div style={{ textAlign: 'center' }}>{t`Loading...`}</div>}
      {!loading && error && (
        <div style={{ textAlign: 'center' }}>{error}</div>
      )}
      {!loading && !error && user && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 8, paddingBottom: 8 }}>
            <img
              src={(user.avatar ? `${String(user.avatar)}?v=${avatarVersion}` : cdn`/avatars/default.webp`)}
              alt={user.name}
              style={{ width: 112, height: 112, maxWidth: '28vw', maxHeight: '28vw', borderRadius: '50%', objectFit: 'cover' }}
            />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18 }}>{user.name}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>@{user.username}</div>
            </div>
          </div>
          <div style={{ height: 1, background: 'currentColor', opacity: 0.15, margin: '4px 0 8px 0' }} />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 6 }}>
            <div
              className="modallink"
              role="button"
              tabIndex={0}
              onClick={handleStartDm}
            >
              {t`Start DM`}
            </div>
            <div
              className="modallink"
              role="button"
              tabIndex={0}
              onClick={handlePing}
            >
              {t`Ping`}
            </div>
            <div
              className="modallink"
              role="button"
              tabIndex={0}
              onClick={handleBlock}
            >
              {t`Block`}
            </div>
          </div>

          <div style={{ padding: '2px 0 8px 0' }}>
            <p className="fishlist" style={{ marginBottom: 6 }}><span className="stattext">{t`Overview`}:</span></p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 6, justifyItems: 'center' }}>
              <p style={{ margin: 0, textAlign: 'center' }}><span className="stattext">{t`Placed Pixels`}: </span>&nbsp;<span className="statvalue">{numberToStringFull(stats.totalPixels)}</span></p>
              <p style={{ margin: 0, textAlign: 'center' }}><span className="stattext">{t`Today Placed Pixels`}: </span>&nbsp;<span className="statvalue">{numberToStringFull(stats.dailyTotalPixels)}</span></p>
              <p style={{ margin: 0, textAlign: 'center' }}><span className="stattext">{t`Total Rank`}: #</span>&nbsp;<span className="statvalue">{numberToString(stats.ranking, 'N/A')}</span></p>
              <p style={{ margin: 0, textAlign: 'center' }}><span className="stattext">{t`Daily Rank`}: #</span>&nbsp;<span className="statvalue">{numberToString(stats.dailyRanking, 'N/A')}</span></p>
            </div>
          </div>

          <div style={{ paddingTop: 12 }}>
            <p className="fishlist" style={{ marginBottom: 6 }}>
              <span className="stattext">{t`Phishes`}:</span>
              <span className="hdivider" />
              <span className="stattext">{t`Total`}:</span>&nbsp;<span className="statvalue">{numberToString(fishes.length)}</span>
              <span className="hdivider" />
              <span className="stattext">{t`Unique`}:</span>&nbsp;
              <span className="statvalue">{numberToString(uniqueFishCount)}</span>
            </p>
            {(fishes.length === 0) && (
              <div style={{ textAlign: 'center', opacity: 0.8 }}>{t`No phishes yet`}</div>
            )}
            {(fishes.length > 0 && fishItems) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {fishItems}
              </div>
            )}
            {(fishes.length > 0 && !fishItems) && (
              <div style={{ textAlign: 'center', opacity: 0.8 }}>{t`Phishes unavailable`}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default React.memo(UserProfile);
