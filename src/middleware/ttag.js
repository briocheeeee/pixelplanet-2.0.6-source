/*
 * Provide translation serverside
 */
import { TTag } from 'ttag';
import { parse as parseCookie } from 'cookie';

import assetWatcher from '../core/fsWatcher.js';
import { getLangsOfJsAsset } from '../core/assets.js';
import lccc from '../../i18n/lccc.json';

const localeImports = import.meta.webpackContext('../../i18n', {
  recursive: false,
  regExp: /^\.[/\\]ssr-.+\.po$/,
});

const ttags = {};

export const availableLangs = [];

function loadTtags() {
  const langs = localeImports.keys();
  const jsLangs = getLangsOfJsAsset('client');
  availableLangs.length = 0;

  for (let i = 0; i < langs.length; i += 1) {
    const file = langs[i];
    // ./ssr-de.po
    const lang = file.replace('./ssr-', '').replace('.po', '').toLowerCase();
    /*
     * In cases where the language code and country code differ,
     * it can be mapped in i18n/lccc.json
     */
    const flag = lccc[lang] || lang;
    if (jsLangs.includes(lang)) {
      if (!ttags[lang]) {
        const ttag = new TTag();
        ttag.addLocale(lang, localeImports(file).default);
        ttag.useLocale(lang);
        ttags[lang] = ttag;
      }
      availableLangs.push([lang, flag]);
    } else if (ttags[lang]) {
      delete ttags[lang];
    }
  }

  if (jsLangs.includes('en') || !availableLangs.length) {
    if (!ttags.en) {
      ttags.en = new TTag();
    }
    availableLangs.push(['en', 'gb']);
  } else if (ttags.en) {
    delete ttags.en;
  }
}

loadTtags();
// reload on asset change
assetWatcher.onChange(() => {
  loadTtags();
});

export function getTTag(lang) {
  return ttags[lang] || ttags.en || Object.values(ttags)[0];
}

/*
 * gets preferred language out of localisation string
 * @param location string (like from accept-language header)
 * @return language code
 */
function languageFromLocalisation(localisation) {
  if (!localisation) {
    return 'en';
  }
  let lang = localisation;
  let i = lang.indexOf('-');
  if (i !== -1) {
    lang = lang.slice(0, i);
  }
  i = lang.indexOf(',');
  if (i !== -1) {
    lang = lang.slice(0, i);
  }
  i = lang.indexOf(';');
  if (i !== -1) {
    lang = lang.slice(0, i);
  }
  return lang.toLowerCase();
}

/*
 * express middleware for getting language
 * It checks the lang cookie, and if not present,
 * the Accept-Language header
 */
export function expressTTag(req, res, next) {
  const cookies = parseCookie(req.headers.cookie || '');
  const language = cookies.plang || req.headers['accept-language'];
  let lang = languageFromLocalisation(language);
  if (!ttags[lang]) {
    if (ttags.en) {
      lang = 'en';
    } else {
      [lang] = Object.keys(ttags);
    }
  }
  req.lang = lang;
  req.ttag = ttags[lang];
  next();
}

export default ttags;
