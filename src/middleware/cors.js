/*
 * express middleware to set CORS Headers
 */
import { CORS_HOSTS } from '../core/config.js';

/**
 * check if it is a cors request and if allowed return its host
 * @param req expressjs request
 * @return host or null
 */
export function corsHost(req) {
  if (!CORS_HOSTS.length) {
    return null;
  }

  const { origin } = req.headers;
  if (!origin || origin === 'null') {
    return null;
  }

  const originHost = `.${origin.slice(origin.indexOf('//') + 2)}`;
  if (originHost === req.ip.getHost(false, true)) {
    /* no CORS */
    return null;
  }

  /*
   * form .domain.tld will accept both domain.tld and x.domain.tld,
   * all CORS_HOSTS entries shall start with a dot or be an IP
   */
  const isAllowed = CORS_HOSTS.some((c) => originHost.endsWith(c));
  if (!isAllowed) {
    return null;
  }
  return origin;
}

/**
 * @param req expressjs request
 * @return boolean if this is a CORS request and if it is, if it's allowed,
 * only really useful for websockets, because otherwise the browser is doing
 * the CORS check
 */
export function isCORSAllowed(req) {
  const { origin } = req.headers;
  if (!origin) {
    return false;
  }
  const originHost = `.${origin.slice(origin.indexOf('//') + 2)}`;
  const host = req.ip.getHost(false, true);
  /*
   * In some websocket requests from localhost, the origin is the loopback IP
   * and the host is localhost, it is super silly
   */
  if (originHost.endsWith(host) || origin === '127.0.0.1') {
    return true;
  }
  return CORS_HOSTS.some((c) => originHost.endsWith(c));
}

export default (req, res, next) => {
  const origin = corsHost(req);

  if (!origin) {
    next();
    return;
  }

  /* different origin produces different response */
  res.set({
    Vary: 'Origin',
  });

  /*
   * The recommended way of dealing with multiple origin is to return whatever
   * origin requested, according to MDN.
   */
  res.set({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
  });

  if (req.method === 'OPTIONS') {
    res.set({
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST',
      'Access-Control-Max-Age': '86400',
    });
    res.sendStatus(200);
    return;
  }
  next();
};
