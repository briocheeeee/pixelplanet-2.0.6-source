/*
 * We got so many locals that building them all in one go can lead to out-of-memory error
 * Lets split that here
 */

import path from 'path';
import fs from 'fs';
import readline from 'readline';
import { spawn } from 'child_process';
import webpack from 'webpack';
import validate from 'ttag-cli/dist/src/commands/validate.js';

import minifyCss from './minifyCss.js';
import createImages from './createImages.js';
import zipDir from './zipDirectory.js';
import serverConfig from '../webpack.config.server.js';
import clientConfig from '../webpack.config.client.js';

const __filename = import.meta.filename;
const __dirname = import.meta.dirname;

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, '..', 'package.json')),
);

let langs = 'all';
let doBuildServer = false;
let doBuildClient = false;
let parallel = false;
let recursion = false;
let onlyValidate = false;
let development = false;
for (let i = 0; i < process.argv.length; i += 1) {
  switch (process.argv[i]) {
    case '--langs': {
      const newLangs = process.argv[++i];
      if (newLangs) langs = newLangs;
      break;
    }
    case '--client':
      doBuildClient = true;
      break;
    case `--server`:
      doBuildServer = true;
      break;
    case '--parallel':
      parallel = true;
      break;
    case '--recursion':
      recursion = true;
      break;
    case '--validate':
      onlyValidate = true;
      break;
    case '--dev':
      development = true;
      break;
    default:
      // nothing
  }
}
if (!doBuildServer && !doBuildClient) {
  doBuildServer = true;
  doBuildClient = true;
}

/*
 * get available locals based on the files available in ../i18n
 */
function getAllAvailableLocals() {
  const langDir = path.resolve(__dirname, '..', 'i18n');
  const langs = fs.readdirSync(langDir)
    .filter((e) => (e.endsWith('.po') && !e.startsWith('ssr')))
    .map((l) => l.slice(0, -3));
  langs.unshift('en');
  return langs;
}

/*
 * get amount of msgid and msgstr of po file
 */
function getPoFileStats(file) {
  return new Promise((resolve) => {
    const fileStream = fs.createReadStream(file);
    const lineReader = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let msgid = 0;
    let msgstr = 0;

    lineReader.on('line', (l) => {
      l = l.trim();
      if (l.endsWith('""')) {
        return;
      }
      let seperator = l.indexOf(' ');
      if (seperator === -1) {
        seperator = l.indexOf('\t');
      }
      if (seperator === -1) {
        return;
      }
      const tag = l.substring(0, seperator);
      if (tag === 'msgid') {
        msgid += 1;
      } else if (tag === 'msgstr') {
        msgstr += 1;
      }
    });

    lineReader.on('close', (l) => {
      resolve({ msgid, msgstr });
    });
  });
}

async function filterLackingLocals(langs, percentage) {
  langs = langs.filter((l) => l !== 'en');
  const promises = [];
  const { msgid, msgstr } = await getPoFileStats(path.resolve(
    __dirname, '..', 'i18n', `template.pot`,
  ));

  const langStats = await Promise.all(langs
    .map((l) => getPoFileStats(
      path.resolve(__dirname, '..', 'i18n', `${l}.po`),
    )));
  const goodLangs = [ 'en' ];
  const badLangs = [];
  for (let i = 0; i < langs.length; i += 1) {
    const lang = langs[i];
    const stats = langStats[i];
    const percent = Math.floor(stats.msgstr / msgid * 100);
    if (percent >= percentage) {
      goodLangs.push(lang);
    } else {
      console.log(`Lang ${lang} completion:`, percent, '%');
      badLangs.push(lang);
    }
  }
  return {
    goodLangs,
    badLangs,
  };
}

/*
 * check if language files contain errors
 */
function validateLangs(langs) {
  console.log('Validating language files...');
  const langDir = path.resolve(__dirname, '..', 'i18n');
  const brokenLangs = [];
  for (const lang of langs) {
    const langFiles = [`${lang}.po`, `ssr-${lang}.po`];
    for (const langFile of langFiles) {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write(`i18n/${langFile} `);
      const filePath = path.join(langDir, langFile);
      if (!fs.existsSync(filePath)) {
        continue;
      }
      try {
        validate.default(filePath);
      } catch (error) {
        brokenLangs.push(langFile);
      }
    }
  }
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  return brokenLangs;
}

/*
 * clean up before build and copy files
 */
function cleanUpBeforeBuild(doBuildServer, doBuildClient) {
  const parentDir = path.resolve(__dirname, '..');
  const distDir = path.resolve(__dirname, '..', 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);
  // remove files we need to regenerate
  const webpackCachePath = path.join(parentDir, 'node_modules', '.cache', 'webpack');
  fs.rmSync(webpackCachePath, { recursive: true, force: true });
  if (doBuildClient && doBuildServer) {
    const assetPath = path.join(distDir, 'public', 'assets');
    fs.rmSync(assetPath, { recursive: true, force: true });
    const legalPath = path.join(distDir, 'public', 'legal');
    fs.rmSync(legalPath, { recursive: true, force: true });
  }
  if (doBuildServer) {
    const captchaFontsPath = path.join(distDir, 'captchaFonts');
    fs.rmSync(captchaFontsPath, { recursive: true, force: true });
  }
  // copy necessary files
  if (doBuildServer) {
    // copy files to dist directory
    [
      'LICENSE',
      'COPYING',
      'AUTHORS',
      'README.md',
      path.join('src', 'canvases.json'),
      path.join('deployment', 'ecosystem.yml'),
      path.join('deployment', 'ecosystem-backup.yml'),
      path.join('deployment', 'config.ini'),
    ].forEach((f) => {
      fs.copyFileSync(
        path.join(parentDir, f),
        path.join(distDir, path.basename(f)),
      );
    });
    // copy folder to dist directory
    const dirsToDirectlyCopy = ['public', 'doc'];
    if (!fs.existsSync(path.join(parentDir, 'overrides', 'captchaFonts'))) {
      dirsToDirectlyCopy.push(path.join('deployment', 'captchaFonts'));
    }
    dirsToDirectlyCopy.forEach((d) => {
      fs.cpSync(
        path.join(parentDir, d),
        path.join(distDir, path.basename(d)),
        { recursive: true },
      );
    });
    // copy stuff we have to rename
    fs.cpSync(
      path.join(parentDir, 'src', 'data', 'redis', 'lua'),
      path.join(distDir, 'workers', 'lua'),
      { recursive: true },
    );
    // ./src/funcs get shipped seperately to allow overriding
    fs.cpSync(
      path.join(parentDir, 'src', 'funcs'),
      path.join(distDir, 'workers', 'funcs'),
      { recursive: true },
    );
    /*
     * overrides exist to deploy our own files
     * that are not part of the repository, like logo.svg
     */
    const overrideDir = path.join(parentDir, 'overrides');
    if (fs.existsSync(overrideDir)) {
      fs.cpSync(
        overrideDir,
        path.join(distDir),
        { dereference: true, recursive: true },
      );
    }
  }
}

/*
 * clean up after build
 */
function cleanUpAfterBuild(builtServer, builtClient) {
  if (builtServer && builtClient) {
    const assetPath = path.resolve(__dirname, '..', 'dist', 'public', 'assets');
    fs.readdirSync(assetPath)
      .filter((e) => e.endsWith('.LICENSE.txt'))
      .forEach((l) => fs.rmSync(path.join(assetPath, l)));
    const serverLicenseFile = path.resolve(__dirname, '..', 'dist', 'server.js.LICENSE.txt');
    if (fs.existsSync(serverLicenseFile)) {
      fs.rmSync(serverLicenseFile);
    }
  }
}


function compile(webpackConfig) {
  return new Promise((resolve, reject) => {
    webpack(webpackConfig, (err, stats) => {
      if (err) {
        return reject(err);
      }
      const statsConfig = (webpackConfig.length) ? webpackConfig[0].stats : webpackConfig.stats;
      console.log(stats.toString(statsConfig))
      return resolve();
    });
  });
}

function buildServer() {
  console.log('-----------------------------');
  console.log(`Build server...`);
  console.log('-----------------------------');
  const ts = Date.now();

  return new Promise((resolve, reject) => {
    const argsc = (langs === 'all')
      ? ['webpack', '--env', 'extract', '--config', './webpack.config.server.js']
      : ['webpack', '--config', './webpack.config.server.js']
    const serverCompile = spawn('npx', argsc, {
      shell: process.platform == 'win32',
    });
    serverCompile.stdout.on('data', (data) => {
      console.log(data.toString());
    });
    serverCompile.stderr.on('data', (data) => {
      console.error(data.toString());
    });
    serverCompile.on('close', (code) => {
      if (code) {
        reject(new Error('Server compilation failed!'));
      } else {
        console.log('---------------------------------------');
        console.log(`Server Compilation finished in ${Math.floor((Date.now() - ts) / 1000)}s`);
        console.log('---------------------------------------');
        resolve();
      }
    });
  });
}

function buildClients(slangs) {
  return new Promise((resolve, reject) => {
    const clientCompile = spawn('npm', ['run', 'build', '--', '--client', '--recursion', '--langs', slangs.join(',')], {
      shell: process.platform == 'win32',
    });
    clientCompile.stdout.on('data', (data) => {
      console.log(data.toString());
    });
    clientCompile.stderr.on('data', (data) => {
      console.error(data.toString());
    });
    clientCompile.on('close', (code) => {
      if (code) {
        reject(new Error('Client compilation failed!'));
      } else {
        resolve();
      }
    });
  });
}

async function buildClientsSync(avlangs) {
  for(let i = 0; i < avlangs.length; i += 1) {
    const lang = avlangs[i];
    console.log(`Build client for locale ${lang}...`);
    await compile(clientConfig({
      development,
      analyze: false,
      extract: false,
      locale: lang,
      readonly: recursion,
    }));
  }
}

function buildClientsParallel(avlangs) {
  const st = Date.now();
  const numProc = 3;
  let nump = Math.floor(avlangs.length / numProc);
  if (!nump) nump = 1;

  const promises = [];
  while (avlangs.length >= nump) {
    const slangs = avlangs.splice(0, nump);
    promises.push(buildClients(slangs));
  }
  if (avlangs.length) {
    promises.push(buildClientsSync(avlangs));
  }
  return Promise.all(promises);
}

async function build() {
  const st = Date.now();
  // cleanup old files
  if (!recursion) {
    cleanUpBeforeBuild(doBuildServer, doBuildClient);
  }

  // decide which languages to build
  let avlangs = getAllAvailableLocals();
  if (langs !== 'all') {
    avlangs = langs.split(',').map((l) => l.trim())
      .filter((l) => avlangs.includes(l));
  } else {
    let badLangs;
    ({ goodLangs: avlangs, badLangs } = await filterLackingLocals(avlangs, 50));
    if (badLangs.length) {
      console.log(
        'Skipping',
        badLangs.length,
        'locals because of low completion:',
        badLangs,
      );
    }
  }
  if (!avlangs.length) {
    console.error(`ERROR: language ${langs} not available`);
    process.exit(1);
    return;
  }
  console.log('Building', avlangs.length, 'locales:', avlangs);

  const brokenLangs = validateLangs(avlangs);
  if (brokenLangs.length) {
    console.error('ERROR: Translation files', brokenLangs, 'contain errors.');
    process.exit(2);
    return;
  }
  if (onlyValidate) {
    console.log('Validation complete, everything is fine.');
    process.exit(0);
    return;
  }

  const promises = [];

  if (doBuildServer) {
    promises.push(buildServer());
  }

  if (doBuildClient) {
    if (!recursion) {
      console.log('Building one client package...');
      await compile(clientConfig({
        development,
        analyze: false,
        extract: (langs === 'all'),
        locale: avlangs.shift(),
        readonly: false,
      }));

      console.log('-----------------------------');
      console.log(`Minify CSS assets...`);
      console.log('-----------------------------');
      await minifyCss();

      if (doBuildServer) {
        /*
         * server copies files into ./dist/public, it
         * is needed for creating images
         */
        console.log('-----------------------------');
        console.log(`Creating Images...`);
        console.log('-----------------------------');
        await createImages();
      }
      console.log('-----------------------------');
    }

    if (parallel) {
      promises.push(buildClientsParallel(avlangs));
    } else {
      promises.push(buildClientsSync(avlangs));
    }
  }
  await Promise.all(promises);

  if (!recursion) {
    cleanUpAfterBuild(doBuildServer, doBuildClient);
    if (doBuildServer && doBuildClient) {
      console.log('-----------------------------');
      console.log(`Archiving Source...`);
      console.log('-----------------------------');
      await zipDir(
        path.resolve(__dirname, '..'),
        path.resolve(__dirname, '..', 'dist', 'public', 'legal',
          `${pkg.name}-${pkg.version}-source.zip`,
        ),
      );
      console.log('-----------------------------');
    }
    console.log(`Finished building in ${(Date.now() - st) / 1000}s`);
  } else {
    console.log(`Worker done in ${(Date.now() - st) / 1000}s`);
  }
}

build();
