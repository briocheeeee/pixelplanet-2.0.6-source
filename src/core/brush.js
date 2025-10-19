export const BRUSH_SHAPES = {
  classic: 'classic',
  square: 'square',
  circle: 'circle',
  diamond: 'diamond',
  cross: 'cross',
  custom: 'custom',
};

const clampSize = (n) => Math.max(1, Math.min(5, Math.floor(n || 1)));

export function getBrushOffsets(shape, size = 1, matrix = null) {
  const s = clampSize(size);
  if (shape === BRUSH_SHAPES.classic) return [[0, 0]];
  if (shape === BRUSH_SHAPES.custom && Array.isArray(matrix)) {
    const half = 2;
    const out = [];
    for (let y = 0; y < 5; y += 1) {
      for (let x = 0; x < 5; x += 1) {
        if (matrix[y] && matrix[y][x]) out.push([x - half, y - half]);
      }
    }
    return out.length ? out : [[0, 0]];
  }
  const out = [];
  const half = Math.floor((s - 1) / 2);
  const rng = [];
  for (let d = -half; d <= half; d += 1) rng.push(d);
  switch (shape) {
    case BRUSH_SHAPES.square: {
      for (const dy of rng) for (const dx of rng) out.push([dx, dy]);
      break;
    }
    case BRUSH_SHAPES.circle: {
      const r = half + 0.5;
      for (const dy of rng) {
        for (const dx of rng) {
          if ((dx * dx + dy * dy) <= r * r) out.push([dx, dy]);
        }
      }
      break;
    }
    case BRUSH_SHAPES.diamond: {
      for (const dy of rng) for (const dx of rng) if (Math.abs(dx) + Math.abs(dy) <= half) out.push([dx, dy]);
      break;
    }
    case BRUSH_SHAPES.cross: {
      for (const d of rng) out.push([d, 0]);
      for (const d of rng) if (d !== 0) out.push([0, d]);
      break;
    }
    default:
      return [[0, 0]];
  }
  return out.length ? out : [[0, 0]];
}

export function normalizeMatrix(matrix) {
  const m = Array.isArray(matrix) ? matrix.slice(0, 5) : [];
  const out = [];
  for (let y = 0; y < 5; y += 1) {
    const row = Array.isArray(m[y]) ? m[y].slice(0, 5) : [];
    const r = [];
    for (let x = 0; x < 5; x += 1) r.push(!!row[x]);
    out.push(r);
  }
  return out;
}
