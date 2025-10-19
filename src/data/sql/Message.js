/*
 *
 * Database layout for Chat Message History
 *
 */

import Sequelize, { DataTypes, QueryTypes } from 'sequelize';
import sequelize from './sequelize.js';
import Channel from './Channel.js';

const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  cid: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  uid: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  flag: {
    type: DataTypes.CHAR(2),
    defaultValue: 'xx',
    allowNull: false,
  },

  message: {
    type: `${DataTypes.STRING(200)} CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    allowNull: false,
    set(value) {
      this.setDataValue('message', value.slice(0, 200));
    },
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
}, {
  indexes: [
    {
      name: 'messages_cid_id_desc',
      fields: ['cid', 'id'],
      order: { id: 'DESC' },
    },
  ],
});

export async function storeMessage(
  flag, message, cid, uid,
) {
  try {
    await Promise.all([
      Channel.update({ lastMessage: Sequelize.fn('NOW') }, {
        where: { id: cid },
      }),
      Message.create({
        flag,
        message,
        cid,
        uid,
      }),
    ]);
  } catch (error) {
    console.error(`SQL Error on storeMessage: ${error.message}`);
  }
}

export async function getMessagesForChannel(cid, limit) {
  try {
    const models = await sequelize.query(
      `SELECT m.message, m.uid, UNIX_TIMESTAMP(m.createdAt) AS 'ts',
u.name, u.avatar FROM Messages m
  INNER JOIN Users u ON u.id = m.uid
WHERE m.cid = ? ORDER BY m.id DESC LIMIT ?`, {
        replacements: [cid, limit],
        raw: true,
        type: QueryTypes.SELECT,
      },
    );
    const rows = [];
    let i = models.length;
    while (i > 0) {
      i -= 1;
      const { name, message, avatar, uid, ts } = models[i];
      let av = avatar;
      if (typeof av === 'string') {
        if (av.startsWith('/public/avatars/')) {
          av = av.replace('/public/avatars/', '/avatars/');
        } else if (av.startsWith('avatars/')) {
          av = `/${av}`;
        }
      } else if (!av && name === 'Bot') {
        av = '/avatars/6.webp';
      }
      rows.push([name, message, av, uid, ts]);
    }
    return rows;
  } catch (error) {
    console.error(`SQL Error on getMessagesForChannel: ${error.message}`);
  }
  return [];
}

export default Message;
