/*
 * express middlewares for handling ip information
 */
import { USE_XREALIP, FORCE_COUNTRY } from '../core/config.js';
import {
  sanitizeIPString, ipToHex, getHostFromRequest, isPrivateIP,
} from '../utils/intel/ip.js';
import { getIPIntelOverShards } from '../utils/intel/index.js';
import { queue } from '../utils/intel/queue.js';
import { getIPAllowance, touchIP } from '../data/sql/IP.js';
import { parseListOfBans } from '../data/sql/Ban.js';

const getIPAllowanceQueued = queue(getIPAllowance);

export class IP {
  /* expressjs request object */
  #req;
  /*
   * {
   *   lastSeen,
   *   isWhitelisted,
   *   isBanned,
   *   isProxy,
   *   country: two letter country code,
   *   whoisExpires: Date object for when whois expires,
   *   proxyCheckExpires: Date object for when proxycheck expires,
   * }
   */
  #allowance;
  /* null | boolean */
  isProxy = null;
  /* null | boolean */
  isBanned = null;
  /* null | boolean */
  isMuted = null;
  /*
   * timestamp when ban should be rechecked,
   * null means to never recheck (so if not banned or perma banned)
   */
  banRecheckTs = null;

  constructor(req) {
    this.#req = req;
  }

  /**
   * @return ip as string, IPv6 cut to 64bit block
   */
  get ipString() {
    const req = this.#req;
    let ipString;
    if (USE_XREALIP) {
      const hdr = req.headers;
      if (typeof hdr['cf-connecting-ip'] === 'string') {
        ipString = hdr['cf-connecting-ip'];
      } else if (typeof hdr['x-real-ip'] === 'string') {
        ipString = hdr['x-real-ip'];
      } else if (typeof hdr['x-forwarded-for'] === 'string') {
        ipString = hdr['x-forwarded-for'].split(',')[0].trim();
      }
    }
    if (!ipString) {
      ipString = req.socket?.remoteAddress || req.connection.remoteAddress;
      if (USE_XREALIP) {
        console.warn(
          `Connection not going through reverse proxy! IP: ${ipString}`,
        );
      } else if (typeof req.headers['x-forwarded-for'] === 'string') {
        ipString = req.headers['x-forwarded-for'].split(',')[0].trim();
      }
    }
    ipString = sanitizeIPString(ipString);
    Object.defineProperty(this, 'ipString', { value: ipString });
    return ipString;
  }

  /**
   * @return ip as hex string, IPv6 cut to 64bit block
   */
  get ipHex() {
    return ipToHex(this.ipString);
  }

  /**
   * @return ip as Number (IPv4) or BigInt (IPv6)
   */
  get ipNum() {
    const ipHex = `0x${this.ipHex}`;
    return (ipHex.length > 10) ? BigInt(ipHex) : Number(ipHex);
  }

  /**
   * @return lower case two letter country code of ip if given by header
   */
  get country() {
    if (typeof FORCE_COUNTRY === 'string' && FORCE_COUNTRY) {
      const cc = FORCE_COUNTRY.slice(0, 2).toLowerCase();
      if (/^[a-z]{2}$/.test(cc)) return cc;
    }
    const hdr = this.#req.headers;
    const candidates = [
      hdr['cf-ipcountry'],
      hdr['x-vercel-ip-country'],
      hdr['fastly-country-code'],
      hdr['x-appengine-country'],
      hdr['x-country-code'],
      hdr['x-geo-country'],
      hdr['geoip-country-code'],
    ];
    for (let i = 0; i < candidates.length; i += 1) {
      const val = candidates[i];
      if (typeof val === 'string' && val.length >= 2) {
        const cc = val.slice(0, 2).toLowerCase();
        if (/^[a-z]{2}$/.test(cc)) {
          return cc;
        }
      }
    }
    return 'xx';
  }

  toString() {
    return this.ipString;
  }

  toHex() {
    return this.ipHex;
  }

  toNum() {
    return this.ipNum;
  }

  /**
   * get host
   * @param includeProto include the http:// part (default true)
   * @param stripSub strip subdomains and heep the dot (default: false)
   * @return host from request
   */
  getHost(includeProto, stripSub) {
    return getHostFromRequest(this.#req, includeProto, stripSub);
  }

  /**
   * update lastSeen timestamps of IP
   * @return Promise<>
   */
  touch() {
    if (!this.#allowance
      || this.#allowance.lastSeen.getTime() > Date.now() - 10 * 60 * 1000
    ) {
      return null;
    }
    return touchIP(this.ipString);
  }

  refresh() {
    return this.getAllowance(true);
  }

  /**
   * fetch allowance data of ip
   * @param refresh whether we should refetch it, even if we have it already
   * @return { isBanned, isProxy, isMuted }
   */
  async getAllowance(refresh = false) {
    const currentTs = Date.now();

    if (!this.#allowance || refresh
      || this.#allowance.whoisExpiresTs < currentTs
      || this.#allowance.proxyCheckExpiresTs < currentTs
      || (this.banRecheckTs !== null && this.banRecheckTs < currentTs)
    ) {
      const { ipString } = this;
      const allowance = await getIPAllowanceQueued(ipString);

      /* fetch whois and proxycheck if needed */
      const needWhois = allowance.whoisExpiresTs < currentTs;
      const needProxyCheck = allowance.proxyCheckExpiresTs < currentTs;
      if (needWhois || needProxyCheck) {
        try {
          const [
            whoisData, proxyCheckData,
          ] = await getIPIntelOverShards(ipString, needWhois, needProxyCheck);

          if (whoisData) {
            allowance.whoisExpiresTs = whoisData.expiresTs;
            allowance.country = whoisData.country || 'xx';
          }

          if (proxyCheckData) {
            allowance.proxyCheckExpiresTs = proxyCheckData.expiresTs;
            allowance.isProxy = proxyCheckData.isProxy;
          }
        } catch (error) {
          console.error(`IP Error on getIPAllowance: ${error.message}`);
        }
      }

      /* prefer whois for country code over headers: overwrite getter */
      if (allowance.country && allowance.country !== 'xx') {
        Object.defineProperty(this, 'country', { value: allowance.country });
      }

      const [isBanned, isMuted, banRecheckTs] = parseListOfBans(allowance.bans);
      this.isBanned = isBanned;
      this.isMuted = isMuted;
      this.banRecheckTs = banRecheckTs;
      this.isProxy = !allowance.isWhitelisted
        && allowance.isProxy
        && !isPrivateIP(ipString);
      this.#allowance = allowance;
    }
    return {
      isBanned: this.isBanned,
      isProxy: this.isProxy,
      isMuted: this.isMuted,
    };
  }
}

/*
 * express middleware to add IP object to request
 */
export function parseIP(req, res, next) {
  Object.defineProperty(req, 'ip', { value: new IP(req) });
  next();
}

/*
 * express middleware to resolve IP allowance in a promise under req.promise,
 * must be called after parseIP.
 * Promise can be resolved by './promises.js' middleware.
 * This has the purpose to allow other actions to happen while we wait.
 */
export async function ipAllowancePromisified(req, res, next) {
  if (!req.promise) {
    req.promise = [];
  }
  req.promise.push(req.ip.getAllowance());
  next();
}
