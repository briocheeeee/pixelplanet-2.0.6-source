import { URL } from 'url';

function sameSite(req) {
  const host = req.ip.getHost(false, true);
  const origin = req.headers.origin;
  if (origin) {
    const o = `.${origin.slice(origin.indexOf('//') + 2)}`;
    if (o.endsWith(host)) return true;
    return false;
  }
  const ref = req.headers.referer;
  if (ref) {
    try {
      const u = new URL(ref);
      const r = `.${u.host}`;
      if (r.endsWith(host)) return true;
      return false;
    } catch {
      return false;
    }
  }
  return false;
}

export default function originGuard(req, res, next) {
  const m = req.method;
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') {
    if (m === 'GET') {
      const p = req.path || '';
      if (p === '/auth/logout' || p === '/auth/logout/') {
        if (!sameSite(req)) {
          res.status(403).json({ errors: ['forbidden'] });
          return;
        }
      }
    }
    next();
    return;
  }
  if (!sameSite(req)) {
    res.status(403).json({ errors: ['forbidden'] });
    return;
  }
  next();
}
