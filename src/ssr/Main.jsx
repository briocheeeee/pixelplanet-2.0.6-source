/*
 * Html for mainpage
 */

/* eslint-disable max-len */
import etag from 'etag';

import hashScript from '../utils/scriptHash.js';
import { getTTag, availableLangs as langs } from '../middleware/ttag.js';
import { getJsAssets, getThemeCssAssets } from '../core/assets.js';
import chooseAPIUrl from '../core/chooseAPIUrl.js';
import {
  BACKUP_URL, CONTACT_ADDRESS, UNSHARDED_HOST, CDN_HOST, CDN_URL, BASENAME,
} from '../core/config.js';

const basedQuotes = [
  ['Do not use Discord', 'Discord is bad, you should not use it', '/memes/discord.png', 'image', 380, 379],
  ['#ShillForChina', 'Taiwan is a part of China', '/memes/china.png', 'image', 512, 341],
  ['Donald J. Trump', 'When Elon Musk came to the White House asking me for help on all of his many subsidized projects, wether it&#39;s electric cars that don&#39;t drive long enough, driverless cars that crash, or rocketships to nowhere, without which subsidies he&#39;d be worthless, and telling me how he was a big Trump fan and Republican, I could have said, &#34;drop to your knees and beg&#34;, and he would have done it...', '/memes/trump.png', 'image', 397, 399],
  ['Donald J. Trump', 'Why would Kim Jong-un insult me by calling me &#34;old,&#34; when i would NEVER call him &#34;short and fat?&#34; Oh well, I try so hard to be his friend - and maybe someday that will happen!', '/memes/trump.png', 'image', 397, 399],
  ['Joe Biden', 'If you have a problem figuring out whether you&#39;re for me or Trump, then you ain&#39;t Black.', '/memes/biden.png', 'image', 400, 400],
  ['Joe Biden', 'Transgender Americans shape our Nation&#39;s soul', '/memes/biden.png', 'image', 400, 400],
  ['Vladimir Putin', 'To forgive the terrorists is up to God, but to send them there is up to us.', '/memes/putin.png', 'image', 1004, 1005],
  ['Alexander G. Lukashenko', 'It&#39;s better to be a dictator than gay.', '/memes/luka.png', 'image', 665, 658],
  ['ILLIT', 'ILLIT - EZPZ', '/memes/illit1.mp4', 'video', 720, 1280],
  ['Donald J. Trump', 'This guy has been talked about for years!', '/memes/trump-epstein.mp4', 'video', 720, 1280],
  ['Candace Owens', 'What is antisemitism?', '/memes/owens1.mp4', 'video', 640, 360],
  ['Candace Owens', 'Antisemite of the year 2024', '/memes/owens2.mp4', 'video', 640, 360],
];

/**
 * Generates string with html of main page
 * @param countryCoords Cell with coordinates of client country
 * @param lang language code
 * @return [html, csp] html and content-security-policy value for mainpage
 */
function generateMainPage(req) {
  const { lang, ip } = req;
  const host = ip.getHost(false);
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const apiUrl = (UNSHARDED_HOST && host.startsWith(UNSHARDED_HOST))
    ? null : chooseAPIUrl();
  const ssv = {
    availableStyles: getThemeCssAssets(),
    langs,
    backupurl: BACKUP_URL,
    contactAddress: CONTACT_ADDRESS,
    apiUrl,
    basename: BASENAME,
    cdnUrl: CDN_URL,
    lang,
  };

  const ssvR = JSON.stringify(ssv);
  const scripts = getJsAssets('client', lang);

  const headScript = `/* @license magnet:?xt=urn:btih:0b31508aeb0634b347b8270c7bee4d411b5d4109&dn=agpl-3.0.txt AGPL-3.0-or-later */\n(function(){window.ssv=JSON.parse('${ssvR}');window.me=fetch('${apiUrl || BASENAME}/api/me',{credentials:'include'})})();\n/* @license-end */`;
  const scriptHash = hashScript(headScript);

  const csp = `script-src 'self' ${CDN_HOST} ${scriptHash} *.tiktok.com *.ttwstatic.com; worker-src 'self' blob:;`;

  const mainEtag = etag(scripts.concat(ssvR).join('_'), { weak: true });
  if (req.headers['if-none-match'] === mainEtag) {
    return { html: null, csp, etag: mainEtag };
  }

  const { t } = getTTag(lang);

  let description;
  let title;
  let media;
  let type;
  let width;
  let height;
  if (req.headers['user-agent']?.includes('https://discordapp.com')) {
    [title, description, media, type, width, height] = basedQuotes[Math.floor(Math.random() * basedQuotes.length)];
  } else {
    description = t`Place color pixels on an map styled canvas with other players online`;
    title = t`PixelPlanet`;
    media = '/apple-touch-icon.png';
    type = 'image';
    width = 256;
    height = 256;
  }
  media = BASENAME + media;

  const html = `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="UTF-8" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:type" content="${(type === 'video') ? 'video.other' : 'website'}" />
    <meta property="og:site_name" content="${host}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:${type}" content="${proto}://${host}${media}" />
    <meta property="og:${type}:secure_url" content="https://${host}${BASENAME}${media}" />
    <meta property="og:${type}:width" content="${width}" />
    <meta property="og:${type}:height" content="${height}" />${(type === 'video') ? `
    <meta property="og:video:type" content="video/mp4" />` : ''}
    <meta name="google" content="nopagereadaloud" />
    <meta name="theme-color" content="#cae3ff" />
    <meta name="viewport" content="user-scalable=no, width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <link rel="icon" href="${BASENAME}/favicon.ico" type="image/x-icon" />
    <link rel="apple-touch-icon" href="${BASENAME}/apple-touch-icon.png" />
    <script>${headScript}</script>
    <link rel="stylesheet" type="text/css" id="globcss" href="${CDN_URL || BASENAME}${getThemeCssAssets().default}" />
  </head>
  <body>
    <div id="app"></div>
    ${scripts.map((script) => `<script src="${CDN_URL || BASENAME}${script}"></script>`).join('')}
    <a data-jslicense="1" style="display: none;" href="${BASENAME}/legal">JavaScript license information</a>
  </body>
</html>`;

  return { html, csp, etag: mainEtag };
}

export default generateMainPage;
