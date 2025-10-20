/**
 *
 */
import express from 'express';
import path from 'path';

import ranking from './ranking.js';
import fs from 'fs';
import voidl from './void.js';
import history from './history.js';
import tiles from './tiles.js';
import chunks from './chunks.js';
import adminapi from './adminapi.js';
import captcha from './captcha.js';
import challenge from './challenge.js';
import resetPassword from './reset_password.js';
import api from './api/index.js';

import { expressTTag } from '../middleware/ttag.js';
import cors from '../middleware/cors.js';
import { parseIP } from '../middleware/ip.js';
import rateLimiter from '../middleware/ratelimit.js';
import generateGlobePage from '../ssr/Globe.jsx';
import generatePopUpPage from '../ssr/PopUp.jsx';
import generateMainPage from '../ssr/Main.jsx';

import { MONTH, AVAILABLE_POPUPS } from '../core/constants.js';
import { GUILDED_INVITE, BASENAME, CDN_HOST } from '../core/config.js';

const router = express.Router();

/*
 * if we are running on a path, we throw in a router in between
 */
const basenameRouter = (BASENAME) ? express.Router() : router;
if (BASENAME) {
  basenameRouter.use(BASENAME, router);
  basenameRouter.get('/', (req, res) => {
    /* eslint-disable max-len */
    res.status(404).send(`<!DOCTYPE html>
<html>
  <head><title>Not Here</title></head>
  <body>Pixelplanet is available under: <a href="${BASENAME}">${BASENAME}</a></body>
</html>`);
    /* eslint-enable max-len */
  });
}

const expressStatic = express.static(
  path.join(__dirname, 'public'), {
    maxAge: 12 * MONTH,
    extensions: ['html'],
    setHeaders: (res, reqPath) => {
      if (reqPath.includes('/legal')) {
        res.setHeader('Cache-Control', `public, max-age=${3 * 24 * 3600}`);
      }
    },
  },
);

(() => {
  const cwdPublic = path.join(process.cwd(), 'public');
  let avatarDir;
  if (fs.existsSync(cwdPublic)) {
    avatarDir = path.join(cwdPublic, 'avatars');
  } else if (fs.existsSync(path.join(__dirname, '..', 'public'))) {
    avatarDir = path.join(__dirname, '..', 'public', 'avatars');
  } else {
    avatarDir = path.join(__dirname, 'public', 'avatars');
  }
  if (!fs.existsSync(avatarDir)) {
    try { fs.mkdirSync(avatarDir, { recursive: true }); } catch {}
  }
  router.use('/avatars', express.static(avatarDir, { maxAge: 12 * MONTH }));
  let favatarDir;
  if (fs.existsSync(cwdPublic)) {
    favatarDir = path.join(cwdPublic, 'favatars');
  } else if (fs.existsSync(path.join(__dirname, '..', 'public'))) {
    favatarDir = path.join(__dirname, '..', 'public', 'favatars');
  } else {
    favatarDir = path.join(__dirname, 'public', 'favatars');
  }
  if (!fs.existsSync(favatarDir)) {
    try { fs.mkdirSync(favatarDir, { recursive: true }); } catch {}
  }
  router.use('/favatars', express.static(favatarDir, { maxAge: 12 * MONTH }));
})();

router.get('/invite/:code', (req, res) => {
  const base = BASENAME || '';
  const code = encodeURIComponent(req.params.code);
  res.redirect(`${base}/?invite=${code}`);
});

/* ip */
router.use(parseIP);

/*
 * Serving Chunks
 */
router.get(['/chunks/:c/:x/:y/:z.bmp', '/chunks/:c/:x/:y.bmp'], chunks);

/*
 * zoomed tiles
 */
router.use('/tiles', tiles);


router.use(rateLimiter);

/*
 * Redirect to guilded
 */
router.use('/guilded', (req, res) => {
  res.redirect(GUILDED_INVITE);
});

/*
 * Following with CORS,
 * this also means that all the landing pages are CORS, which is weird,
 * but it is the simplest way to make CDN_URL CORS aware
 */
router.use(cors);

/*
 * if we get accessed by CDN, only serve static files
 */
router.use((req, res, next) => {
  if (CDN_HOST && CDN_HOST === req.ip.getHost(false, false)) {
    req.tickRateLimiter(600);
    expressStatic(req, res, () => {
      if (!res.headersSent) {
        res.status(404).send(`<!DOCTYPE html>
<html>
  <head><title>Not here</title></head>
  <body>This domain is used as a CDN. You can't access anything here.</body>
</html>`);
      }
    });
    return;
  }
  next();
});

/* translations */
router.use(expressTTag);

/*
 * adminapi
 */
router.use('/adminapi', adminapi);

//
// 3D Globe (react generated)
// -----------------------------------------------------------------------------
router.get('/globe', (req, res) => {
  req.tickRateLimiter(3000);

  const { html, etag: globeEtag } = generateGlobePage(req);

  res.set({
    'Cache-Control': 'private, no-cache', // seconds
    ETag: globeEtag,
  });

  if (!html) {
    res.status(304).end();
    return;
  }

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
});

//
// PopUps
// -----------------------------------------------------------------------------
router.use(
  AVAILABLE_POPUPS.map((p) => `/${p.toLowerCase()}`),
  (req, res, next) => {
    if (req.method !== 'GET') {
      next();
      return;
    }
    req.tickRateLimiter(3000);

    const { html, etag: winEtag } = generatePopUpPage(req);

    res.set({
      'Cache-Control': 'private, no-cache', // seconds
      ETag: winEtag,
    });

    if (!html) {
      res.status(304).end();
      return;
    }

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  },
);

//
// Main Page
// -----------------------------------------------------------------------------
router.get('/', (req, res) => {
  req.tickRateLimiter(3000);

  const { html, csp, etag: mainEtag } = generateMainPage(req);

  res.set({
    'Cache-Control': 'private, no-cache', // seconds
    'Content-Security-Policy': csp,
    ETag: mainEtag,
  });

  if (!html) {
    res.status(304).end();
    return;
  }

  res.set({
    'Content-Type': 'text/html; charset=utf-8',
  });
  res.status(200).send(html);
});


/*
 * Password Reset Link
 */
router.use('/reset_password', resetPassword);

/*
 * API calls
 */
router.use('/api', api);

/*
 * void info
 */
router.get('/void', voidl);

/*
 * ranking of pixels placed
 * daily and total
 */
router.get('/ranking', ranking);

/*
 * give: date per query
 * returns: array of HHMM backups available
 */
router.get('/history', history);

/*
 * serve captcha
 */
router.get('/captcha.svg', captcha);

/*
 * serve js challenge
 */
router.get('/challenge.js', challenge);

router.use((req, res, next) => {
  req.tickRateLimiter(600);
  next();
});

/*
 * public folder
 */
router.use(expressStatic);

export default basenameRouter;
