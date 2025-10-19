import React, { useMemo, useCallback } from 'react';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import { t } from 'ttag';
import {
  setBrushShape,
  setBrushSize,
  toggleBrushCell,
} from '../store/actions/index.js';
import { BRUSH_SHAPES, normalizeMatrix } from '../core/brush.js';

const grid5 = (arr) => normalizeMatrix(arr);

const presets = [
  { key: BRUSH_SHAPES.classic, label: t`Classic`, size: 1, matrix: grid5([[0,0,0,0,0],[0,0,0,0,0],[0,0,1,0,0],[0,0,0,0,0],[0,0,0,0,0]]) },
  { key: BRUSH_SHAPES.square, label: t`Square`, size: 5 },
  { key: BRUSH_SHAPES.circle, label: t`Circle`, size: 5 },
  { key: BRUSH_SHAPES.diamond, label: t`Diamond`, size: 5 },
  { key: BRUSH_SHAPES.cross, label: t`Cross`, size: 5 },
  { key: BRUSH_SHAPES.custom, label: t`Custom`, size: 5 },
];

function MiniGrid({ matrix }) {
  return (
    <div className="brush-mini-grid">
      {matrix.map((row, y) => row.map((v, x) => (
        <div key={`${x}-${y}`} className={v ? 'on' : 'off'} />
      )))}
    </div>
  );
}

function getPresetMatrix(shape, size, custom) {
  if (shape === BRUSH_SHAPES.custom) return normalizeMatrix(custom);
  if (shape === BRUSH_SHAPES.classic) return grid5([[0,0,0,0,0],[0,0,0,0,0],[0,0,1,0,0],[0,0,0,0,0],[0,0,0,0,0]]);
  const s = Math.max(1, Math.min(5, size || 5));
  const half = 2; // preview always 5x5
  const m = Array.from({ length: 5 }, () => Array(5).fill(false));
  const rng = (n) => Array.from({ length: n }, (_, i) => i);
  const offs = [];
  const ring = [];
  for (let d = -2; d <= 2; d += 1) ring.push(d);
  switch (shape) {
    case BRUSH_SHAPES.square:
      for (let y = -Math.floor((s-1)/2); y <= Math.floor((s-1)/2); y += 1)
        for (let x = -Math.floor((s-1)/2); x <= Math.floor((s-1)/2); x += 1)
          offs.push([x, y]);
      break;
    case BRUSH_SHAPES.circle: {
      const r = Math.floor((s-1)/2) + 0.5;
      for (const y of ring) for (const x of ring) if (x*x + y*y <= r*r) offs.push([x, y]);
      break; }
    case BRUSH_SHAPES.diamond:
      for (const y of ring) for (const x of ring) if (Math.abs(x)+Math.abs(y) <= Math.floor((s-1)/2)) offs.push([x, y]);
      break;
    case BRUSH_SHAPES.cross:
      for (const d of ring) offs.push([d, 0]);
      for (const d of ring) if (d !== 0) offs.push([0, d]);
      break;
    default:
      offs.push([0, 0]);
  }
  for (const [dx, dy] of offs) {
    const gx = dx + half; const gy = dy + half;
    if (gx >= 0 && gx < 5 && gy >= 0 && gy < 5) m[gy][gx] = true;
  }
  return m;
}

export default function BrushShapeSettings() {
  const [shape, size, custom] = useSelector((s) => [
    s.canvas.brushShape,
    s.canvas.brushSize,
    s.canvas.brushMatrix,
  ], shallowEqual);
  const dispatch = useDispatch();

  const previewMatrix = useMemo(() => getPresetMatrix(shape, size, custom), [shape, size, custom]);

  const onSelect = useCallback((p) => {
    dispatch(setBrushShape(p.key));
    dispatch(setBrushSize(p.size));
    // persistence to cookie (lightweight)
    try {
      document.cookie = `brushShape=${p.key}; path=/; SameSite=Lax`;
      document.cookie = `brushSize=${p.size}; path=/; SameSite=Lax`;
    } catch (e) {}
  }, [dispatch]);

  const onToggleCell = (x, y) => {
    dispatch(toggleBrushCell(x, y));
    try {
      const matrix = normalizeMatrix(custom);
      document.cookie = `brushCustom=${encodeURIComponent(JSON.stringify(matrix))}; path=/; SameSite=Lax`;
    } catch (e) {}
  };

  return (
    <div className="setitem brushsettings">
      <div className="setrow">
        <h3 className="settitle">{t`Brush Shape`}</h3>
        <div className="brushshape-stack" style={{ "--brush-gap": "12px" }}>
          <div className="brushshape-group">
            {presets.map((p) => (
              <div key={p.key} className="brush-card">
                <button
                  type="button"
                  className={`brush-preset ${shape === p.key ? 'active' : ''}`}
                  onClick={() => onSelect(p)}
                  aria-pressed={shape === p.key}
                >
                  <span className="label">{p.label}</span>
                  <MiniGrid matrix={getPresetMatrix(p.key, p.size || 5, custom)} />
                </button>
              </div>
            ))}
          </div>
          {shape === BRUSH_SHAPES.custom && (
            <div className="brushbelow">
              <div className="brush-editor-label">{t`Custom Shape Editor (Click to toggle)`}</div>
              <div className="brush-editor" role="grid" aria-label="custom brush editor">
                {normalizeMatrix(custom).map((row, y) => (
                  row.map((v, x) => (
                    <div
                      key={`${x}-${y}`}
                      role="button"
                      tabIndex={0}
                      aria-pressed={v}
                      onClick={() => onToggleCell(x, y)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggleCell(x, y); }}
                      className={`cell ${v ? 'on' : 'off'}`}
                    />
                  ))
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
