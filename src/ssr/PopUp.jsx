/*
 * create html for popup page
 *
 */

/* eslint-disable max-len */
import etag from 'etag';

import { getTTag, availableLangs as langs } from '../middleware/ttag.js';
import { getJsAssets, getThemeCssAssets } from '../core/assets.js';
import chooseAPIUrl from '../core/chooseAPIUrl.js';
import {
  BACKUP_URL, CONTACT_ADDRESS, UNSHARDED_HOST, CDN_URL, BASENAME,
} from '../core/config.js';


/**
 * generates string with html of win page
 * @param lang language code
 * @return html and etag of popup page
 */
function generatePopUpPage(req) {
  const { lang } = req;
  const host = req.ip.getHost(false);
  const apiUrl = (UNSHARDED_HOST && host.startsWith(UNSHARDED_HOST))
    ? null : chooseAPIUrl();
  const ssvR = JSON.stringify({
    availableStyles: getThemeCssAssets(),
    langs,
    backupurl: BACKUP_URL,
    contactAddress: CONTACT_ADDRESS,
    apiUrl,
    basename: BASENAME,
    cdnUrl: CDN_URL,
    lang,
  });
  const scripts = getJsAssets('popup', lang);

  const popEtag = etag(scripts.concat(ssvR).join('_'), { weak: true });
  if (req.headers['if-none-match'] === popEtag) {
    return { html: null, etag: popEtag };
  }

  const { t } = getTTag(lang);

  const html = `<!doctype html>
    <html lang="${lang}">
      <head>
        <meta charset="UTF-8" />
        <title>${t`ppfun`}</title>
        <meta name="description" content="${t`PixelPlanet.Fun PopUp`}" />
        <meta name="google" content="nopagereadaloud" />
        <meta name="theme-color" content="#cae3ff" />
        <meta name="viewport"
          content="user-scalable=no, width=device-width, initial-scale=1.0, maximum-scale=1.0"
        />
        <link rel="icon" href="${BASENAME}/favicon.ico" type="image/x-icon" />
        <link rel="apple-touch-icon" href="${BASENAME}/apple-touch-icon.png" />
        <script>/* @license magnet:?xt=urn:btih:0b31508aeb0634b347b8270c7bee4d411b5d4109&dn=agpl-3.0.txt AGPL-3.0-or-later */\n(function(){window.ssv=JSON.parse('${ssvR}'); window.me=fetch('${apiUrl || BASENAME}/api/me',{credentials:'include'})})();\n/* @license-end */</script>
        <link rel="stylesheet" type="text/css" id="globcss" href="${CDN_URL || BASENAME}${getThemeCssAssets().default}" />
      </head>
      <body>
        <div id="app" class="popup">
        </div>
        ${scripts.map((script) => `<script src="${CDN_URL || BASENAME}${script}"></script>`).join('')}
        <a data-jslicense="1" style="display: none;" href="${BASENAME}/legal">JavaScript license information</a>
      </body>
    </html>
  `;

  return { html, etag: popEtag };
}

export default generatePopUpPage;
