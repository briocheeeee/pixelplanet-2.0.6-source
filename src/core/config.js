/*
 * general config that is also available from client code can be found in
 * src/core/constants.js
 */
import fs from 'fs';
import path from 'path';

if (process.env.BROWSER) {
  throw new Error(
    'Do not import `config.js` from inside the client-side code.',
  );
}

let config = {};

(() => {
  const variables = [
    ['ASSET_DIR', 'string', '/assets'],
    ['PORT', 'int', 8080],
    ['HOST', 'string', '127.0.0.1'],
    ['USE_MAILER', 'bool', false],
    ['MAIL_ADDRESS', 'string', 'donotreply@example.com'],
    ['CONTACT_ADDRESS', 'string', 'admin@example.com'],
    ['TILE_FOLDER_REL', 'string', 'tiles'],
    ['USE_XREALIP', 'bool', false],
    ['BACKUP_URL', 'string', null],
    ['OUTGOING_ADDRESS', 'string', null],
    ['PUNISH_DOMINATOR', 'bool', false],
    ['USE_PROXYCHECK', 'bool', false],
    ['PROXYCHECK_KEY', 'string', null],
    ['REDIS_URL', 'string', 'redis://localhost:6379'],
    ['IS_CLUSTER', 'bool', false],
    ['CDN_URL', 'string', ''],
    ['API_URLS', 'array', null],
    ['UNSHARDED_HOST', 'string', null],
    ['BASENAME', 'string', ''],
    ['CORS_HOSTS', 'array', []],
    ['MYSQL_HOST', 'string', 'localhost'],
    ['MYSQL_DATABASE', 'string', 'pixelplanet'],
    ['MYSQL_USER', 'string', 'pixelplanet'],
    ['MYSQL_PW', 'string', 'sqlpassword'],
    ['LOG_MYSQL', 'bool', false],
    ['GUILDED_INVITE', 'string', 'https://www.guilded.gg/'],
    ['HOURLY_EVENT', 'bool', false],
    ['FISHING', 'bool', false],
    ['FISH_AMOUNT', 'int', 3],
    ['APISOCKET_KEY', 'string', null],
    ['ADMIN_IDS', 'numarray', []],
    ['ANNOUNCE_COOLDOWN_WHITELIST', 'numarray', []],
    ['CAPTCHA_TIME', 'int', 30],
    ['CAPTCHA_TIMEOUT', 'int', 120],
    ['TRUSTED_TIME', 'int', 48],
    ['WHOIS_DURATION', 'int', 240],
    ['PROXYCHECK_DURATION', 'int', 72],
    ['FORCE_COUNTRY', 'string', null],
    ['FACEBOOK_APP_ID', 'string', 'dummy'],
    ['FACEBOOK_APP_SECRET', 'string', 'dummy'],
    ['DISCORD_CLIENT_ID', 'string', 'dummy'],
    ['DISCORD_CLIENT_SECRET', 'string', 'dummy'],
    ['GOOGLE_CLIENT_ID', 'string', 'dummy'],
    ['GOOGLE_CLIENT_SECRET', 'string', 'dummy'],
    ['VK_CLIENT_ID', 'string', 'dummy'],
    ['VK_CLIENT_SECRET', 'string', 'dummy'],
    ['REDDIT_CLIENT_ID', 'string', 'dummy'],
    ['REDDIT_CLIENT_SECRET', 'string', 'dummy'],
    ['BACKUP_REDIS_URL', 'string', null],
    ['BACKUP_DIR', 'string', null],
    ['BACKUP_CMD', 'string', null],
    ['BACKUP_INTERVAL', 'int', 30],
    ['RATE_LIMIT_CMD', 'string', null],
    ['IMGBB_API_KEY', 'string', null],
  ];

  const configFileValues = {};
  try {
    const configFile = path.resolve('config.ini');
    if (fs.existsSync(configFile)) {
      fs.readFileSync(path.resolve('config.ini')).toString('utf8')
        .split('\n').forEach((line) => {
          line = line.trim();
          if (line.startsWith('#')) {
            return;
          }
          const seperator = line.indexOf('=');
          // eslint-disable-next-line
          if (seperator === -1 || seperator === 0 || seperator > line.length - 2) {
            return;
          }
          const key = line.substring(0, seperator).trim();
          let value = line.substring(seperator + 1).trim();
          if ((value.startsWith('"') && value.endsWith('"'))
            || (value.startsWith('\'') && value.endsWith('\''))
          ) {
            value = value.substring(1, value.length - 1);
          }
          configFileValues[key] = value;
        });
    }
  } catch (error) {
    console.error(`Couldn't read config file ${error.message}`);
  }

  for (let i = 0; i < variables.length; i += 1) {
    const [key, type, def] = variables[i];

    let userValue = process.env[key];
    if (!userValue) {
      userValue = configFileValues[key];
    }
    let value;

    if (userValue) {
      switch (type) {
        case 'string': {
          value = userValue;
          break;
        }
        case 'int': {
          const num = parseInt(userValue, 10);
          if (Number.isNaN(num)) {
            value = def;
          } else {
            value = num;
          }
          break;
        }
        case 'bool': {
          /* eslint-disable max-len */
          userValue = userValue.toLowerCase();
          if (userValue === 'true' || userValue === 'yes' || userValue === '1') {
            value = true;
          } else if (userValue === 'false' || userValue === 'no' || userValue === '0') {
            value = false;
          } else {
            value = def;
          }
          /* eslint-enable max-len */
          break;
        }
        case 'array': {
          value = userValue.split(',').map((c) => c.trim()).filter((c) => c);
          break;
        }
        case 'numarray': {
          value = userValue.split(',').map((c) => c.trim()).filter((c) => c)
            .map((c) => parseInt(c, 10));
          break;
        }
        default:
          throw new Error(
            `Can not parse config value ${userValue} for ${key}`,
          );
      }
    } else {
      value = def;
    }

    config[key] = value;
  }

  /* generated values */
  config.TILE_FOLDER = path.resolve(config.TILE_FOLDER_REL);

  if (config.CDN_URL) {
    const cdnHost = config.CDN_URL.substring(config.CDN_URL.indexOf('//') + 2);
    const endHostSlash = cdnHost.indexOf('/', 8);
    if (endHostSlash !== -1) {
      config.CDN_HOST = cdnHost.substring(0, endHostSlash);
    } else {
      config.CDN_HOST = cdnHost;
    }
  } else {
    config.CDN_HOST = '';
  }

  config.CORS_HOSTS = config.CORS_HOSTS.map(
    (c) => ((c.split('.').length !== 4 && !c.startsWith('.')) ? `.${c}` : c),
  );
})();

export const {
  ASSET_DIR,
  PORT,
  HOST,
  USE_MAILER,
  MAIL_ADDRESS,
  CONTACT_ADDRESS,
  USE_XREALIP,
  BACKUP_URL,
  OUTGOING_ADDRESS,
  PUNISH_DOMINATOR,
  USE_PROXYCHECK,
  PROXYCHECK_KEY,
  REDIS_URL,
  IS_CLUSTER,
  CDN_URL,
  API_URLS,
  UNSHARDED_HOST,
  BASENAME,
  CORS_HOSTS,
  MYSQL_HOST,
  MYSQL_DATABASE,
  MYSQL_USER,
  MYSQL_PW,
  LOG_MYSQL,
  GUILDED_INVITE,
  HOURLY_EVENT,
  FISHING,
  FISH_AMOUNT,
  APISOCKET_KEY,
  ADMIN_IDS,
  ANNOUNCE_COOLDOWN_WHITELIST,
  CAPTCHA_TIME,
  CAPTCHA_TIMEOUT,
  TRUSTED_TIME,
  WHOIS_DURATION,
  PROXYCHECK_DURATION,
  FORCE_COUNTRY,
  FACEBOOK_APP_ID,
  FACEBOOK_APP_SECRET,
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  VK_CLIENT_ID,
  VK_CLIENT_SECRET,
  REDDIT_CLIENT_ID,
  REDDIT_CLIENT_SECRET,
  TILE_FOLDER,
  CDN_HOST,
  BACKUP_REDIS_URL,
  BACKUP_DIR,
  BACKUP_CMD,
  BACKUP_INTERVAL,
  RATE_LIMIT_CMD,
  IMGBB_API_KEY,
} = config;

config = null;
