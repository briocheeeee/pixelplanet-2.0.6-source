import React, { useRef } from 'react';
import { useSelector } from 'react-redux';

import { MarkdownParagraph } from './Markdown.jsx';
import {
  colorFromText,
  setBrightness,
  getDateTimeString,
} from '../core/utils.js';
import { selectIsDarkMode } from '../store/selectors/gui.js';
import { parseParagraph } from '../core/MarkdownParser.js';
import { cdn } from '../utils/utag.js';


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
                openCm(event.clientX, event.clientY, name, uid);
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
              <span
                className="chatname"
                style={{
                  color: setBrightness(colorFromText(name), isDarkMode),
                }}
                title={name}
              >
                {name}
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
