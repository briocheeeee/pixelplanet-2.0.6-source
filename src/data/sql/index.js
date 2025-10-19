import { QueryTypes } from 'sequelize';
import sequelize, { sync } from './sequelize.js';
import User, { USERLVL } from './User.js';
import Channel, { CHANNEL_TYPES } from './Channel.js';
import Message from './Message.js';
import Session from './Session.js';
import IP from './IP.js';
import ProxyData from './Proxy.js';
import RangeData from './Range.js';
import Ban, { cleanBans } from './Ban.js';
import BanHistory from './BanHistory.js';
import WhoisReferral from './WhoisReferral.js';
import RangeBan, { cleanRangeBans } from './RangeBan.js';
import RangeBanHistory from './RangeBanHistory.js';
import ProxyWhitelist from './ProxyWhitelist.js';
import ThreePID, { THREEPID_PROVIDERS } from './ThreePID.js';
import ThreePIDHistory from './ThreePIDHistory.js';
import Fish from './Fish.js';
import UserIP from './association_models/UserIP.js';
import UserBlock from './association_models/UserBlock.js';
import UserChannel from './association_models/UserChannel.js';
import IPBan from './association_models/IPBan.js';
import UserBan from './association_models/UserBan.js';
import ThreePIDBan from './association_models/ThreePIDBan.js';
import IPBanHistory from './association_models/IPBanHistory.js';
import UserBanHistory from './association_models/UserBanHistory.js';
import ThreePIDBanHistory from './association_models/ThreePIDBanHistory.js';
import { HourlyCron } from '../../utils/cron.js';

/*
 * clean the database of crap
 */
export async function cleanDB() {
  const queries = [
    'DELETE FROM Ranges WHERE expires < NOW()',
    'DELETE FROM Proxies WHERE expires < NOW()',
    'DELETE FROM Sessions WHERE expires < NOW()',
    'DELETE FROM WhoisReferrals WHERE expires < NOW()',
  ];
  const functions = [
    cleanBans,
    cleanRangeBans,
  ];
  for (let i = 0; i < queries.length; i += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await sequelize.query(queries[i], {
        raw: true,
        type: QueryTypes.DELETE,
      });
    } catch (error) {
      console.error(
        `SQL Error on clean-up query ${queries[i]}: ${error.message}`,
      );
    }
  }
  if (Math.random() < 0.1) {
    /*
     * delete all messages except the most recent 1000 per channel,
     * this is highly database specific, that query is for MySQL 8+ and
     * seems to work on MariaDB as well
     */
    try {
      await sequelize.query(`DELETE m FROM Messages m
LEFT JOIN (
  SELECT id FROM (
    SELECT id,
    ROW_NUMBER() OVER (PARTITION BY cid ORDER BY id DESC) as rn
    FROM Messages
  ) ranked WHERE rn <= 1000
) keep ON m.id = keep.id
WHERE keep.id IS NULL`, {
        raw: true,
        type: QueryTypes.DELETE,
      });
    } catch (error) {
      console.error(
        `SQL Error on clean-up messages : ${error.message}`,
      );
    }
  }
  for (let i = 0; i < functions.length; i += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await functions[i]();
    } catch (error) {
      console.error(
        `SQL Error on clean-up job ${functions[i].name}: ${error.message}`,
      );
    }
  }
}
HourlyCron.hook(cleanDB);

/*
 * Channels
 */
User.belongsToMany(Channel, {
  as: 'channels',
  through: UserChannel,
  foreignKey: 'uid',
});
Channel.belongsToMany(User, {
  as: 'users',
  through: UserChannel,
  foreignKey: 'cid',
});

/*
 * Fish
 */
Fish.belongsTo(User, {
  as: 'user',
  foreignKey: 'uid',
  onDelete: 'CASCADE',
});

/*
 * ip informations of user
 */
IP.belongsToMany(User, {
  as: 'users',
  through: UserIP,
  foreignKey: 'ip',
});
User.belongsToMany(IP, {
  as: 'ips',
  through: UserIP,
  foreignKey: 'uid',
});

/*
 * user sessions
 */
Session.belongsTo(User, {
  as: 'user',
  foreignKey: 'uid',
  onDelete: 'CASCADE',
});
User.hasMany(Session, {
  as: 'sessions',
  foreignKey: 'uid',
});
Session.belongsTo(IP, {
  as: 'ipinfo',
  foreignKey: 'ip',
});
IP.hasMany(Session, {
  as: 'sessions',
  foreignKey: 'ip',
});

/*
 * proxy information of ip
 */
ProxyData.belongsTo(IP, {
  as: 'ipinfo',
  foreignKey: 'ip',
  onDelete: 'CASCADE',
});
IP.hasOne(ProxyData, {
  as: 'proxy',
  foreignKey: 'ip',
});

/*
 * third party ids for oauth login
 */
ThreePID.belongsTo(User, {
  as: 'user',
  foreignKey: 'uid',
});
User.hasMany(ThreePID, {
  as: 'tpids',
  foreignKey: 'uid',
});


/*
 * third party ids history
 */
ThreePIDHistory.belongsTo(User, {
  as: 'user',
  foreignKey: 'uid',
  onDelete: 'CASCADE',
});
User.hasMany(ThreePIDHistory, {
  as: 'tpidsHistory',
  foreignKey: 'uid',
});

/*
 * ip range with whois info for ip
 */
IP.belongsTo(RangeData, {
  as: 'range',
  foreignKey: 'rid',
});

RangeData.hasMany(IP, {
  as: 'ips',
  foreignKey: 'rid',
});
/*
 * generic ban by threepid, userid and ip
 */
Ban.belongsToMany(IP, {
  as: 'ips',
  through: IPBan,
  foreignKey: 'bid',
});
IP.belongsToMany(Ban, {
  as: 'bans',
  through: IPBan,
  foreignKey: 'ip',
});
// tpid
Ban.belongsToMany(ThreePID, {
  as: 'tpids',
  through: ThreePIDBan,
  foreignKey: 'bid',
});
ThreePID.belongsToMany(Ban, {
  as: 'bans',
  through: ThreePIDBan,
  foreignKey: 'tid',
});
// user
Ban.belongsToMany(User, {
  as: 'users',
  through: UserBan,
  foreignKey: 'bid',
});
User.belongsToMany(Ban, {
  as: 'bans',
  through: UserBan,
  foreignKey: 'uid',
});
// mods
Ban.belongsTo(User, {
  as: 'mod',
  foreignKey: 'muid',
});
User.hasMany(Ban, {
  as: 'banActions',
  foreignKey: 'muid',
});
/*
 * history of past bans
 */
BanHistory.belongsToMany(IP, {
  as: 'ips',
  through: IPBanHistory,
  foreignKey: 'bid',
});
IP.belongsToMany(BanHistory, {
  as: 'banHistory',
  through: IPBanHistory,
  foreignKey: 'ip',
});
// tpid
BanHistory.belongsToMany(ThreePID, {
  as: 'tpids',
  through: ThreePIDBanHistory,
  foreignKey: 'bid',
});
ThreePID.belongsToMany(BanHistory, {
  as: 'banHistory',
  through: ThreePIDBanHistory,
  foreignKey: 'tid',
});
// user
BanHistory.belongsToMany(User, {
  as: 'users',
  through: UserBanHistory,
  foreignKey: 'bid',
});
User.belongsToMany(BanHistory, {
  as: 'banHistory',
  through: UserBanHistory,
  foreignKey: 'uid',
});
// mods
BanHistory.belongsTo(User, {
  as: 'mod',
  foreignKey: 'muid',
});
User.hasMany(BanHistory, {
  as: 'banActionHistory',
  foreignKey: 'muid',
});
BanHistory.belongsTo(User, {
  as: 'lmod',
  foreignKey: 'lmuid',
});
User.hasMany(BanHistory, {
  as: 'banLiftingHistory',
  foreignKey: 'lmuid',
});

/*
 * ip whitelist
 */
ProxyWhitelist.belongsTo(User, {
  as: 'mod',
  foreignKey: 'muid',
});
User.hasMany(ProxyWhitelist, {
  as: 'ipWhitelistActions',
  foreignKey: 'muid',
});
ProxyWhitelist.belongsTo(IP, {
  as: 'ipinfo',
  foreignKey: 'ip',
  onDelete: 'CASCADE',
});
IP.hasOne(ProxyWhitelist, {
  as: 'whitelist',
  foreignKey: 'ip',
});

/*
 * range ban
 */
RangeBan.belongsTo(RangeData, {
  as: 'iprange',
  foreignKey: 'rid',
  onDelete: 'CASCADE',
});
RangeData.hasOne(RangeBan, {
  as: 'bans',
  foreignKey: 'rid',
});
RangeBan.belongsTo(User, {
  as: 'mod',
  foreignKey: 'muid',
});
User.hasMany(RangeBan, {
  as: 'rangeBanActions',
  foreignKey: 'muid',
});

/*
 * ip range ban history
 */
RangeBanHistory.belongsTo(RangeData, {
  as: 'iprange',
  foreignKey: 'rid',
  onDelete: 'CASCADE',
});
RangeData.hasMany(RangeBanHistory, {
  as: 'banHistory',
  foreignKey: 'rid',
});
RangeBanHistory.belongsTo(User, {
  as: 'mod',
  foreignKey: 'muid',
});
User.hasMany(RangeBanHistory, {
  as: 'rangeBanActionHistory',
  foreignKey: 'muid',
});
RangeBanHistory.belongsTo(User, {
  as: 'lmod',
  foreignKey: 'lmuid',
});
User.hasMany(RangeBanHistory, {
  as: 'rangeBanLiftingHistory',
  foreignKey: 'lmuid',
});

/*
 * chat messages
 */
Message.belongsTo(Channel, {
  as: 'channel',
  foreignKey: 'cid',
  onDelete: 'CASCADE',
});
Message.belongsTo(User, {
  as: 'user',
  foreignKey: 'uid',
  onDelete: 'CASCADE',
});

/*
 * User blocks of other user
 *
 * uid: User that blocks
 * buid: User that is blocked
 */
User.belongsToMany(User, {
  as: 'blocked',
  through: UserBlock,
  foreignKey: 'uid',
});
User.belongsToMany(User, {
  as: 'blockedBy',
  through: UserBlock,
  foreignKey: 'buid',
});

export {
  sync,
  sequelize,
  // Models
  ProxyWhitelist,
  User,
  Channel,
  UserChannel,
  Message,
  UserBlock,
  RangeData,
  IP,
  Ban,
  WhoisReferral,
  ThreePID,
  Fish,
  // constants
  USERLVL,
  THREEPID_PROVIDERS,
  CHANNEL_TYPES,
};
