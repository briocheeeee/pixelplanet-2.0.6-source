/*
 * Form to ask for captcha.
 * Offers input for captchas, parent needs to provide a form and
 * get "captcha" and "captchaid" values
 */

/* eslint-disable jsx-a11y/no-autofocus */

import React, {
  useState, useEffect, useCallback, useRef,
} from 'react';
import { t } from 'ttag';
import { IoReloadCircleSharp } from 'react-icons/io5';

import { api } from '../utils/utag.js';
import { getRandomString } from '../core/utils.js';

async function getUrlAndId() {
  const url = api`/captcha.svg`;
  try {
    const resp = await fetch(url, {
      cache: 'no-cache',
    });
    if (resp.ok) {
      const captchaid = resp.headers.get('captcha-id');
      const challengeNeeded = resp.headers.get('challenge-needed') === '1';
      const svg = await resp.text();
      return [svg, captchaid, challengeNeeded];
    }
  } catch {
    // nothing
  }
  return null;
}

/*
 * autoload: Load captcha immediately and autofocus input textbox
 * width: width of the captcha image
 */
const Captcha = ({
  autoload, width, setLegit, onReadyStateChange,
}) => {
  const [captchaData, setCaptchaData] = useState({});
  const [challengeSolution, setChallengeSolution] = useState(null);
  
  const [animationRunning, setAnimationRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);

  const svgContainerRef = useRef();
  const animReqRef = useRef(null);
  const phaseRef = useRef(0);
  const periodRef = useRef(8000);
  const nextGlimpseRef = useRef(0);
  const glimpseUntilRef = useRef(0);
  const lastProgressRef = useRef(0);
  const lastUpdateRef = useRef(0);
  const progressFillRef = useRef(null);
  const glimpseActiveRef = useRef(false);
  const lastTsRef = useRef(0);
  const elapsedRef = useRef(0);
  const accAngleRef = useRef(0);

  const makeRng = useCallback((seedStr) => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seedStr.length; i += 1) {
      h ^= seedStr.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    let seed = h >>> 0;
    return () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return (seed >>> 0) / 4294967296;
    };
  }, []);

  const reloadCaptcha = useCallback(async () => {
    /*
     * load Cahptcha
     */
    if (loading) {
      return;
    }
    setLoading(true);
    setCaptchaData({});
    setAnimationRunning(false);
    const captchaResponse = await getUrlAndId();
    setLoading(false);
    if (!captchaResponse) {
      setErrors([t`Could not load captcha`]);
      return;
    }
    const [svg, captchaid, challengeNeeded] = captchaResponse;

    /*
     * solve JS Challenge in Worker on first load
     */
    if (challengeNeeded && challengeSolution === null) {
      const worker = new Worker(`/challenge.js?cb=${getRandomString()}`);
      // TODO Timeout
      worker.onmessage = (e) => {
        setChallengeSolution(e.data);
        worker.terminate();
      };
      // empty string for waiting
      setChallengeSolution('');
    }

    setCaptchaData({ svg, id: captchaid });
    setErrors([]);
  }, [challengeSolution, loading]);

  useEffect(() => {
    /*
     * prepare svg for animated elements
     */
    if (captchaData.svg) {
      const svgElement = svgContainerRef.current.firstElementChild;
      svgElement.style.width = '100%';
      svgElement.style.height = '100%';
      let cnt = 0;
      const transforms = {};
      const ns = svgElement.namespaceURI;
      let defs = svgElement.querySelector('defs');
      if (!defs) {
        defs = document.createElementNS(ns, 'defs');
        svgElement.insertBefore(defs, svgElement.firstChild);
      }
      const paths = Array.from(svgElement.querySelectorAll('path'));
      const metrics = paths.map((el, idx) => {
        const bb = el.getBBox ? el.getBBox() : null;
        if (!bb || bb.width === 0 || bb.height === 0) return null;
        const ar = bb.width / bb.height;
        const cx = bb.x + bb.width / 2;
        return { el, idx, bb, ar, cx };
      }).filter(Boolean);
      metrics.sort((a, b) => a.cx - b.cx);
      const groups = [];
      const avgWidth = metrics.reduce((s, m) => s + m.bb.width, 0) / Math.max(1, metrics.length);
      const gapThresh = Math.max(4, avgWidth * 0.6);
      metrics.forEach((m) => {
        const last = groups[groups.length - 1];
        if (!last || Math.abs(m.cx - last.cxEnd) > gapThresh) {
          groups.push({ items: [m], cxEnd: m.cx, bb: { x1: m.bb.x, y1: m.bb.y, x2: m.bb.x + m.bb.width, y2: m.bb.y + m.bb.height } });
        } else {
          last.items.push(m);
          last.cxEnd = m.cx;
          last.bb.x1 = Math.min(last.bb.x1, m.bb.x);
          last.bb.y1 = Math.min(last.bb.y1, m.bb.y);
          last.bb.x2 = Math.max(last.bb.x2, m.bb.x + m.bb.width);
          last.bb.y2 = Math.max(last.bb.y2, m.bb.y + m.bb.height);
        }
      });
      const groupInfo = groups.map((g) => {
        const width = g.bb.x2 - g.bb.x1;
        const height = g.bb.y2 - g.bb.y1;
        const ar = width && height ? width / height : 0;
        const main = g.items.reduce((p, c) => (p && p.bb.width * p.bb.height > c.bb.width * c.bb.height ? p : c), null);
        return { ...g, width, height, ar, main };
      }).filter((g) => g.main);
      const chosen = [];
      if (groupInfo.length > 0) {
        const rng = makeRng(String(captchaData.id || 'seed'));
        for (let gi = 0; gi < groupInfo.length; gi += 1) {
          const g = groupInfo[gi];
          const corners = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
          const corner = corners[Math.floor(rng() * corners.length)];
          const fracW = 0.22 + rng() * 0.12;
          const fracH = 0.22 + rng() * 0.12;
          chosen.push({ m: g.main, bb: { x: g.bb.x1, y: g.bb.y1, width: g.width, height: g.height }, fracW, fracH, corner });
        }
      }
      const selected = chosen;
      selected.forEach(({ m, bb, fracW, fracH, corner }, i) => {
        const el = m.el;
        const letterBB = bb;
        const marginPx = Math.max(1, Math.min(letterBB.width, letterBB.height) * 0.08);
        const w = letterBB.width;
        const h = letterBB.height;
        const rngLocal = makeRng(String(captchaData.id || 'seed') + ':' + i);
        const minAreaFrac = 0.12;
        const maxAreaFrac = 0.2;
        const areaFrac = minAreaFrac + rngLocal() * (maxAreaFrac - minAreaFrac);
        const targetArea = Math.max(w * h * areaFrac, 36);
        const aspect = 0.75 + rngLocal() * 0.5;
        let tw = Math.sqrt(2 * targetArea * aspect);
        let th = (2 * targetArea) / tw;
        const maxTw = Math.max(4, w - 2 * marginPx);
        const maxTh = Math.max(4, h - 2 * marginPx);
        let scale = Math.min(1, maxTw / tw, maxTh / th);
        tw *= scale; th *= scale;
        const minSide = Math.max(6, Math.min(w, h) * 0.18);
        if (tw < minSide || th < minSide) {
          const s2 = Math.max(minSide / tw, minSide / th);
          const limit = Math.min(maxTw / tw, maxTh / th);
          const sFinal = Math.min(s2, limit);
          tw *= sFinal; th *= sFinal;
        }
        let x0; let y0; let p1x; let p1y; let p2x; let p2y;
        if (corner === 'topLeft') {
          x0 = letterBB.x + marginPx; y0 = letterBB.y + marginPx;
          p1x = x0 + tw; p1y = y0;
          p2x = x0; p2y = y0 + th;
        } else if (corner === 'topRight') {
          x0 = letterBB.x + w - marginPx; y0 = letterBB.y + marginPx;
          p1x = x0 - tw; p1y = y0;
          p2x = x0; p2y = y0 + th;
        } else if (corner === 'bottomLeft') {
          x0 = letterBB.x + marginPx; y0 = letterBB.y + h - marginPx;
          p1x = x0 + tw; p1y = y0;
          p2x = x0; p2y = y0 - th;
        } else {
          x0 = letterBB.x + w - marginPx; y0 = letterBB.y + h - marginPx;
          p1x = x0 - tw; p1y = y0;
          p2x = x0; p2y = y0 - th;
        }
        const cx = (x0 + p1x + p2x) / 3;
        const cy = (y0 + p1y + p2y) / 3;
        const cpId = `cp${cnt}`;
        const mkId = `mk${cnt}`;
        const apId = `ap${cnt}`;
        const baseId = `bw${cnt}`;
        const clip = document.createElementNS(ns, 'clipPath');
        clip.setAttribute('id', cpId);
        clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
        const cpoly = document.createElementNS(ns, 'polygon');
        cpoly.setAttribute('points', `${x0},${y0} ${p1x},${p1y} ${p2x},${p2y}`);
        clip.appendChild(cpoly);
        defs.appendChild(clip);
        const mask = document.createElementNS(ns, 'mask');
        mask.setAttribute('id', mkId);
        mask.setAttribute('maskContentUnits', 'userSpaceOnUse');
        const mAll = document.createElementNS(ns, 'rect');
        mAll.setAttribute('x', `${letterBB.x}`);
        mAll.setAttribute('y', `${letterBB.y}`);
        mAll.setAttribute('width', `${letterBB.width}`);
        mAll.setAttribute('height', `${letterBB.height}`);
        mAll.setAttribute('fill', '#ffffff');
        const mCut = document.createElementNS(ns, 'polygon');
        mCut.setAttribute('points', `${x0},${y0} ${p1x},${p1y} ${p2x},${p2y}`);
        mCut.setAttribute('fill', '#000000');
        mask.appendChild(mAll);
        mask.appendChild(mCut);
        defs.appendChild(mask);
        const baseWrap = document.createElementNS(ns, 'g');
        baseWrap.setAttribute('mask', `url(#${mkId})`);
        baseWrap.setAttribute('id', baseId);
        const parent = el.parentNode;
        parent.insertBefore(baseWrap, el);
        baseWrap.appendChild(el);
        const overlay = document.createElementNS(ns, 'g');
        overlay.setAttribute('id', apId);
        overlay.setAttribute('clip-path', `url(#${cpId})`);
        const clone = el.cloneNode(true);
        overlay.appendChild(clone);
        parent.appendChild(overlay);
        const dir = rngLocal() < 0.5;
        const speed = 0.85 + rngLocal() * 0.45;
        transforms[apId] = {
          x: cx,
          y: cy,
          clockwise: dir,
          speed,
          baseId,
          overlayId: apId,
          maskId: mkId,
        };
        cnt += 1;
      });
      if (Object.keys(transforms).length > 0) {
        setCaptchaData((prev) => ({ ...prev, transforms }));
        setAnimationRunning(true);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captchaData.svg]);

  

  useEffect(() => {
    if (!animationRunning || !captchaData.transforms) {
      return () => {};
    }
    const svgElement = svgContainerRef.current?.firstElementChild;
    if (!svgElement) {
      return () => {};
    }
    const applyAngle = (value) => {
      for (const [id, vals] of Object.entries(captchaData.transforms)) {
        const el = document.getElementById(id);
        if (!el) continue;
        const list = el.transform?.baseVal;
        if (!list) continue;
        let t;
        if (list.numberOfItems > 0) {
          t = list.getItem(0);
        } else if (el.ownerSVGElement && el.ownerSVGElement.createSVGTransform) {
          t = el.ownerSVGElement.createSVGTransform();
          list.appendItem(t);
        }
        if (t) {
          const sign = vals.clockwise ? 1 : -1;
          const sp = vals.speed || 1;
          t.setRotate(sign * value * sp, vals.x, vals.y);
        }
      }
    };
    const now = performance.now();
    phaseRef.current = 0;
    glimpseUntilRef.current = 0;
    nextGlimpseRef.current = Infinity;
    lastTsRef.current = now;
    elapsedRef.current = 0;
    accAngleRef.current = 0;
    glimpseActiveRef.current = false;
    applyAngle(0);
    const step = (ts) => {
      if (!animationRunning) {
        return;
      }
      let dt = ts - lastTsRef.current;
      if (dt < 0) dt = 0;
      if (dt > 100) dt = 100;
      lastTsRef.current = ts;
      elapsedRef.current += dt;
      const addDeg = (dt / periodRef.current) * 360;
      accAngleRef.current += addDeg;
      const angle = phaseRef.current + accAngleRef.current;
      applyAngle(angle);
      const p = Math.round(accAngleRef.current % 360);
      if (p !== lastProgressRef.current && (ts - lastUpdateRef.current) > 30) {
        lastProgressRef.current = p;
        lastUpdateRef.current = ts;
        if (progressFillRef.current) {
          const w = Math.max(0, Math.min(100, Math.round((p / 360) * 100)));
          progressFillRef.current.style.width = `${w}%`;
        }
      }
      animReqRef.current = requestAnimationFrame(step);
    };
    animReqRef.current = requestAnimationFrame(step);
    return () => {
      if (animReqRef.current) {
        cancelAnimationFrame(animReqRef.current);
        animReqRef.current = null;
      }
    };
  }, [animationRunning, captchaData.transforms]);

  useEffect(() => {
    if (autoload) {
      reloadCaptcha();
    }
  // intentionally only executed on first render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (onReadyStateChange) {
      onReadyStateChange(challengeSolution !== '' && !!captchaData.id);
    }
  }, [challengeSolution, captchaData.id, onReadyStateChange]);

  const contWidth = width || 100;

  return (
    <>
      <p>
        {t`Type the characters from the following image:`}
        &nbsp;
        <span style={{ fontSize: 11 }}>
          ({t`Tip: Not case-sensitive; I and l are the same`})
        </span>
      </p>
      {errors.map((error) => (
        <p key={error} className="errormessage">
          <span>{t`Error`}</span>:&nbsp;{error}
        </p>
      ))}
      <div
        style={{
          width: `${contWidth}%`,
          paddingTop: `${Math.floor(contWidth * 0.6)}%`,
          position: 'relative',
          display: 'inline-block',
          backgroundColor: '#e0e0e0',
        }}
      >
        {(captchaData.svg) ? (
          <div
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              top: '0',
              left: '0',
            }}
            /* eslint-disable-next-line react/no-danger */
            dangerouslySetInnerHTML={{ __html: captchaData.svg }}
            title="CAPTCHA"
            ref={svgContainerRef}
            key="svgc"
          />
        )
          : (
            <span
              style={{
                width: '100%',
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%,-50%)',
              }}
              role="button"
              tabIndex={0}
              title={t`Load Captcha`}
              className="modallink"
              onClick={reloadCaptcha}
              onKeyPress={reloadCaptcha}
              key="caplt"
            >
              {t`Click to Load Captcha`}
            </span>
          )}
        {captchaData.transforms && (
        <div
          style={{
            position: 'absolute',
            left: 5,
            right: 5,
            bottom: 4,
            height: 4,
            borderRadius: 2,
            overflow: 'hidden',
            backgroundColor: 'rgba(0,0,0,0.2)',
            zIndex: 2,
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        >
          <div
            ref={progressFillRef}
            className="modallink"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: '0%',
              backgroundColor: 'currentColor',
              cursor: 'default',
              pointerEvents: 'none',
            }}
          />
        </div>
        )}
      </div>
      <p>
        {t`Can't read? Reload:`}&nbsp;
        <span
          role="button"
          tabIndex={-1}
          title={t`Reload`}
          className="modallink"
          style={{ fontSize: 28 }}
          onClick={reloadCaptcha}
        >
          <IoReloadCircleSharp />
        </span>
      </p>
      <input
        name="captcha"
        placeholder={t`Enter Characters`}
        type="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        onChange={() => setLegit && setLegit(true)}
        autoFocus={autoload}
        style={{
          width: '6em',
          fontSize: 21,
          margin: 5,
        }}
      />
      <input type="hidden" name="captchaid" value={captchaData.id || '0'} />
      <input
        type="hidden"
        name="challengesolution"
        value={challengeSolution || ''}
      />
    </>
  );
};

export default React.memo(Captcha);
