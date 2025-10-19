/**
 *
 * http://tostring.it/2014/06/23/advanced-logging-with-nodejs/
 *
 */

import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import fs from 'fs';

import { PORT } from './config.js';

const LOG_BASE = './dist/log';
try { fs.mkdirSync(LOG_BASE, { recursive: true }); } catch {}
try { fs.mkdirSync(`${LOG_BASE}/moderation`, { recursive: true }); } catch {}

export const PIXELLOGGER_PREFIX = `${LOG_BASE}/pixels-${PORT}-`;
const PROXYLOGGER_PREFIX = `${LOG_BASE}/proxycheck-${PORT}-`;
const MODTOOLLOGGER_PREFIX = `${LOG_BASE}/moderation/modtools-${PORT}-`;
const ANNOUNCELOGGER_PREFIX = `${LOG_BASE}/moderation/announce-${PORT}-`;
const SERVERLOGGER_PREFIX = `${LOG_BASE}/server-${PORT}-`;

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.splat(),
    format.simple(),
  ),
  transports: [
    new DailyRotateFile({
      level: 'info',
      filename: `${SERVERLOGGER_PREFIX}%DATE%.log`,
      maxSize: '20m',
      maxFiles: '14d',
      utc: true,
      colorize: false,
    }),
  ],
});

export const pixelLogger = createLogger({
  format: format.printf(({ message }) => message),
  transports: [
    new DailyRotateFile({
      filename: `${PIXELLOGGER_PREFIX}%DATE%.log`,
      maxFiles: '14d',
      utc: true,
      colorize: false,
    }),
  ],
});

export const proxyLogger = createLogger({
  format: format.combine(
    format.splat(),
    format.simple(),
  ),
  transports: [
    new DailyRotateFile({
      level: 'info',
      filename: `${PROXYLOGGER_PREFIX}%DATE%.log`,
      maxSize: '10m',
      maxFiles: '14d',
      utc: true,
      colorize: false,
    }),
  ],
});

export const announcementLogger = createLogger({
  format: format.printf(({ message }) => message),
  transports: [
    new DailyRotateFile({
      level: 'info',
      filename: `${ANNOUNCELOGGER_PREFIX}%DATE%.log`,
      maxSize: '20m',
      maxFiles: '14d',
      utc: true,
      colorize: false,
    }),
  ],
});

export const modtoolsLogger = createLogger({
  format: format.printf(({ message }) => message),
  transports: [
    new DailyRotateFile({
      level: 'info',
      filename: `${MODTOOLLOGGER_PREFIX}%DATE%.log`,
      maxSize: '20m',
      maxFiles: '14d',
      utc: true,
      colorize: false,
    }),
  ],
});



export default logger;
