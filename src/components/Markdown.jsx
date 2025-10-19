/*
 * Renders Markdown that got parsed by core/MarkdownParser
 */
import React from 'react';

import MdLink from './MdLink.jsx';
import MdMention from './MdMention.jsx';

// eslint-disable-next-line max-len
const formatRelativeTime = (ms, nowArg) => {
  const now = (typeof nowArg === 'number') ? nowArg : Date.now();
  const diff = ms - now;
  const abs = Math.abs(diff);
  let unit = 'second';
  let value = diff / 1000;
  if (abs >= 60000 && abs < 3600000) {
    unit = 'minute';
    value = diff / 60000;
  } else if (abs >= 3600000 && abs < 86400000) {
    unit = 'hour';
    value = diff / 3600000;
  } else if (abs >= 86400000 && abs < 604800000) {
    unit = 'day';
    value = diff / 86400000;
  } else if (abs >= 604800000 && abs < 2629800000) {
    unit = 'week';
    value = diff / 604800000;
  } else if (abs >= 2629800000 && abs < 31557600000) {
    unit = 'month';
    value = diff / 2629800000;
  } else if (abs >= 31557600000) {
    unit = 'year';
    value = diff / 31557600000;
  }
  const rounded = Math.round(value);
  const hasRtf = (typeof Intl !== 'undefined' && typeof Intl.RelativeTimeFormat === 'function');
  if (hasRtf) {
    const rtf = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });
    return rtf.format(rounded, unit);
  }
  const shortUnits = { second: 's', minute: 'min', hour: 'h', day: 'd', week: 'w', month: 'mo', year: 'y' };
  return (diff > 0) ? `in ${rounded}${shortUnits[unit]}` : `${rounded}${shortUnits[unit]} ago`;
};

const formatAbsoluteByStyle = (date, style) => {
  const pad2 = (n) => String(n).padStart(2, '0');
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const weekdayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const h = date.getHours();
  const m = date.getMinutes();
  const s = date.getSeconds();
  const h12 = h % 12 || 12;
  const ampm = h < 12 ? 'AM' : 'PM';
  const timeShort = `${h12}:${pad2(m)} ${ampm}`;
  const timeLong = `${h12}:${pad2(m)}:${pad2(s)} ${ampm}`;
  const month = date.getMonth();
  const day = date.getDate();
  const year = date.getFullYear();
  const dateShort = `${pad2(month + 1)}/${pad2(day)}/${year}`;
  const dateLong = `${monthNames[month]} ${day}, ${year}`;
  const weekdayLong = weekdayNames[date.getDay()];
  switch (style) {
    case 't': return timeShort;
    case 'T': return timeLong;
    case 'd': return dateShort;
    case 'D': return dateLong;
    case 'f': return `${dateLong} ${timeShort}`;
    case 'F': return `${weekdayLong}, ${dateLong} ${timeShort}`;
    case 'Fs': return `${weekdayLong}, ${dateLong} ${timeLong}`;
    default: return `${dateLong} ${timeShort}`;
  }
};

const TimeChip = ({ ms, style }) => {
  const [now, setNow] = React.useState(Date.now());
  const chipRef = React.useRef(null);
  const floatRef = React.useRef(null);
  const isHoverRef = React.useRef(false);

  React.useEffect(() => {
    const updateDelay = () => {
      const abs = Math.abs(ms - now);
      if (abs >= 86400000) return 60000; // 1d+ -> update every minute
      if (abs >= 3600000) return 30000; // 1h+ -> every 30s
      if (abs >= 60000) return 5000; // 1min+ -> every 5s
      return 1000; // else every second
    };
    let cancelled = false;
    let timer = null;
    const schedule = () => {
      if (cancelled) return;
      const delay = updateDelay();
      timer = setTimeout(() => {
        setNow(Date.now());
        schedule();
      }, delay);
    };
    schedule();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [ms]);

  const date = new Date(ms);
  const rel = formatRelativeTime(ms, now);
  const styleChar = (typeof style === 'string' && style.length) ? style[0] : undefined;
  const isRelative = (styleChar === 'R' || styleChar === 'r');
  const text = isRelative ? rel : formatAbsoluteByStyle(date, styleChar || 'f');
  const tooltip = formatAbsoluteByStyle(date, 'Fs');

  const ensureFloat = React.useCallback(() => {
    if (floatRef.current) return floatRef.current;
    const el = document.createElement('div');
    el.className = 'timestamp-tooltip-floating';
    document.body.appendChild(el);
    floatRef.current = el;
    return el;
  }, []);

  const removeFloat = React.useCallback(() => {
    const el = floatRef.current;
    if (el && el.parentNode) el.parentNode.removeChild(el);
    floatRef.current = null;
  }, []);

  const positionFloat = React.useCallback(() => {
    const host = chipRef.current;
    const el = floatRef.current;
    if (!host || !el) return;
    el.textContent = tooltip;
    const src = host.querySelector('.timestamp-tooltip');
    if (src) {
      const cs = window.getComputedStyle(src);
      el.style.backgroundColor = cs.backgroundColor;
      el.style.color = cs.color;
      el.style.boxShadow = cs.boxShadow;
      el.style.borderRadius = cs.borderRadius;
      el.style.padding = cs.padding;
      el.style.fontSize = cs.fontSize;
      el.style.lineHeight = cs.lineHeight;
      el.style.fontFamily = cs.fontFamily;
    }
    el.style.visibility = 'hidden';
    el.style.display = 'block';
    el.style.left = '0px';
    el.style.top = '0px';
    const r = host.getBoundingClientRect();
    const ew = el.offsetWidth;
    const eh = el.offsetHeight;
    const vpw = window.innerWidth;
    const vph = window.innerHeight;
    let left = Math.round(r.left + r.width / 2 - ew / 2);
    if (left < 8) left = 8;
    if (left + ew > vpw - 8) left = vpw - 8 - ew;
    let top = Math.round(r.top - eh - 8);
    if (top < 8) top = Math.round(r.bottom + 8);
    if (top + eh > vph - 8) top = vph - 8 - eh;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.visibility = 'visible';
  }, [tooltip]);

  const onEnter = React.useCallback(() => {
    isHoverRef.current = true;
    ensureFloat();
    positionFloat();
  }, [ensureFloat, positionFloat]);

  const onLeave = React.useCallback(() => {
    isHoverRef.current = false;
    removeFloat();
  }, [removeFloat]);

  React.useEffect(() => {
    if (!isHoverRef.current) return undefined;
    positionFloat();
    const onScroll = () => positionFloat();
    const onResize = () => positionFloat();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [positionFloat, now, tooltip]);

  React.useEffect(() => () => removeFloat(), [removeFloat]);

  return (
    <span
      className="timestamp-chip"
      ref={chipRef}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
    >
      <time dateTime={date.toISOString()}>{text}</time>
      <span className="timestamp-tooltip">{tooltip}</span>
    </span>
  );
};

export const MarkdownParagraph = React.memo(({ pArray, refEmbed }) => pArray.map((part) => {
  if (!Array.isArray(part)) {
    return part;
  }
  const type = part[0];
  switch (type) {
    case 'c':
      return (<code>{part[1]}</code>);
    case '*':
      return (
        <strong>
          <MarkdownParagraph pArray={part[1]} />
        </strong>
      );
    case '~':
      return (
        <s>
          <MarkdownParagraph pArray={part[1]} />
        </s>
      );
    case '+':
      return (
        <em>
          <MarkdownParagraph pArray={part[1]} />
        </em>
      );
    case '_':
      return (
        <u>
          <MarkdownParagraph pArray={part[1]} />
        </u>
      );
    case 'img':
    case 'l': {
      return (
        <MdLink refEmbed={refEmbed} href={part[2]} title={part[1]} />
      );
    }
    case 'time': {
      const unix = Number(part[1]);
      const style = part[2];
      const ms = unix * 1000;
      return (
        <TimeChip ms={ms} style={style} />
      );
    }
    case '@': {
      return (
        <MdMention uid={part[2]} name={part[1]} />
      );
    }
    default:
      return type;
  }
}));

const Markdown = ({ mdArray }) => mdArray.map((part) => {
  const type = part[0];
  switch (type) {
    /* Heading */
    case 'a': {
      const level = Number(part[1]);
      const heading = part[2];
      const children = part[3];
      let headingElem = [];
      switch (level) {
        case 1:
          headingElem = <h1>{heading}</h1>;
          break;
        case 2:
          headingElem = <h2>{heading}</h2>;
          break;
        case 3:
          headingElem = <h3>{heading}</h3>;
          break;
        default:
          headingElem = <h4>{heading}</h4>;
      }
      return (
        <>
          {headingElem}
          <section>
            <Markdown mdArray={children} />
          </section>
        </>
      );
    }
    /* Paragraph */
    case 'p': {
      return (
        <p>
          <MarkdownParagraph pArray={part[1]} />
        </p>
      );
    }
    /* Code Block */
    case 'cb': {
      const content = part[1];
      return <pre>{content}</pre>;
    }
    case '>':
    case '<': {
      const children = part[1];
      return (
        <blockquote
          className={(type === '>') ? 'gt' : 'rt'}
        >
          <Markdown mdArray={children} />
        </blockquote>
      );
    }
    case 'ul': {
      const children = part[1];
      return (
        <ul>
          <Markdown mdArray={children} />
        </ul>
      );
    }
    case 'ol': {
      const children = part[1];
      return (
        <ol>
          <Markdown mdArray={children} />
        </ol>
      );
    }
    case '-': {
      const children = part[1];
      return (
        <li>
          <Markdown mdArray={children} />
        </li>
      );
    }
    default:
      return part[0];
  }
});

const MarkdownArticle = ({ mdArray }) => (
  <article>
    <Markdown mdArray={mdArray} />
  </article>
);

export default React.memo(MarkdownArticle);
