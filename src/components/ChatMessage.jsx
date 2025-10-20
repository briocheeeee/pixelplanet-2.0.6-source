import React, { useRef, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import { MarkdownParagraph } from './Markdown.jsx';
import {
  colorFromText,
  setBrightness,
  getDateTimeString,
} from '../core/utils.js';
import { selectIsDarkMode } from '../store/selectors/gui.js';
import { parseParagraph } from '../core/MarkdownParser.js';
import { cdn } from '../utils/utag.js';
import { openWindow } from '../store/actions/windows.js';
import { requestFactionByTag } from '../store/actions/fetch.js';


const __tagColorMem = new Map();
const __tagColorPend = new Map();
function useFactionTagColor(tag) {
  const [c, setC] = useState('');
  useEffect(() => {
    if (!tag) { setC(''); return; }
    const mem = __tagColorMem.get(tag);
    if (mem) { setC(mem); return; }
    try {
      const raw = sessionStorage.getItem(`ftagc:${tag}`);
      if (raw) {
        const o = JSON.parse(raw);
        if (o && o.c && o.t && (Date.now() - o.t) < 86400000) {
          __tagColorMem.set(tag, o.c);
          setC(o.c);
          return;
        }
      }
    } catch {}
    let active = true;
    const run = async () => {
      try {
        let p = __tagColorPend.get(tag);
        if (!p) {
          p = (async () => {
            const res = await requestFactionByTag(tag);
            const avatar = res?.faction?.avatar;
            if (!avatar) return '';
            const img = new Image();
            img.crossOrigin = 'anonymous';
            const result = await new Promise((resolve) => {
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
                  resolve(hex);
                } catch { resolve(''); }
              };
              img.onerror = () => resolve('');
              img.src = avatar;
            });
            return result;
          })();
          __tagColorPend.set(tag, p);
        }
        const color = await p;
        __tagColorPend.delete(tag);
        if (color) {
          __tagColorMem.set(tag, color);
          try { sessionStorage.setItem(`ftagc:${tag}`, JSON.stringify({ c: color, t: Date.now() })); } catch {}
          if (active) setC(color);
        }
      } catch {}
    };
    run();
    return () => { active = false; };
  }, [tag]);
  return c;
}

function ChatMessage({
  name,
  uid,
  avatar,
  msg,
  ts,
  openCm,
}) {
  const isDarkMode = useSelector(selectIsDarkMode);
  const refEmbed = useRef();
  const dispatch = useDispatch();

  const isInfo = (name === 'info');
  const isEvent = (name === 'event');
  let className = 'msg';
  if (isInfo) {
    className += ' info';
  } else if (isEvent) {
    className += ' event';
  } else if (msg.charAt(0) === '>') {
    className += ' greentext';
  } else if (msg.charAt(0) === '<') {
    className += ' redtext';
  }

  const pArray = parseParagraph(msg);

  const myId = useSelector((state) => state.user.id);
  const myAvatar = useSelector((state) => state.user.avatar);

  const pickAvatar = () => {
    let a = avatar;
    if ((!a || typeof a !== 'string') && uid && myId && uid === myId && typeof myAvatar === 'string') {
      a = myAvatar;
    }
    if (typeof a !== 'string') return null;
    if (a.startsWith('/public/avatars/')) a = a.replace('/public/avatars/', '/avatars/');
    if (a.startsWith('avatars/')) a = `/${a}`;
    if (!(a.startsWith('/avatars/') || a.startsWith('/public/') || a.startsWith('http'))) return null;
    return a;
  };

  const effAvatar = pickAvatar();
  const m = /^\[([A-Z0-9]{2,4})]\s+(.*)$/.exec(name || '');
  const tag = m ? m[1] : null;
  const dispName = m ? m[2] : name;
  const tagColor = useFactionTagColor(tag);

  return (
    <li className="chatmsg" ref={refEmbed}>
      <div className="msgcont">
        <span className={className}>
          {(!isInfo && !isEvent) && (
            <span
              key="name"
              role="button"
              tabIndex={-1}
              style={{
                cursor: 'pointer',
              }}
              onClick={(event) => {
                openCm(event.clientX, event.clientY, dispName, uid);
              }}
            >
              {(() => {
                const a = effAvatar;
                if (!a) return false;
                const src = (a.includes('?')) ? a : `${a}?v=${ts || ''}`;
                return (
                <img
                  className="chatflag"
                  alt=""
                  src={src}
                  loading="lazy"
                  decoding="async"
                  fetchpriority="low"
                  style={{
                    width: '1.4em',
                    height: '1.4em',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    verticalAlign: 'middle',
                    marginRight: 8,
                  }}
                />
                );
              })()}
              {tag && (
                <span
                  className="chatname"
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch(openWindow('FACTION_PROFILE', false, '', { tag }));
                  }}
                  style={{ color: tagColor || setBrightness(colorFromText(tag), isDarkMode), marginRight: 6 }}
                  title={`[${tag}]`}
                >
                  {`[${tag}]`}
                </span>
              )}
              <span
                className="chatname"
                style={{
                  color: setBrightness(colorFromText(dispName), isDarkMode),
                }}
                title={dispName}
              >
                {dispName}
              </span>
              {': '}
            </span>
          )}
          <MarkdownParagraph refEmbed={refEmbed} pArray={pArray} />
        </span>
        <span className="chatts">
          {getDateTimeString(ts)}
        </span>
      </div>
    </li>
  );
}

export default React.memo(ChatMessage);
