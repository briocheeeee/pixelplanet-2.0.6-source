import { DataTypes } from 'sequelize';
import sequelize from './sequelize.js';

export const FACTION_POLICY = {
  OPEN: 0,
  REQUEST: 1,
  INVITE_ONLY: 2,
};

const Faction = sequelize.define('Faction', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: `${DataTypes.STRING(24)} CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    allowNull: false,
    unique: 'faction_name',
  },
  tag: {
    type: `${DataTypes.STRING(4)} CHARACTER SET ascii COLLATE ascii_general_ci`,
    allowNull: false,
    unique: 'faction_tag',
  },
  avatar: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  joinPolicy: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
    defaultValue: FACTION_POLICY.OPEN,
  },
  memberCount: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },
  ownerId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

const FactionMember = sequelize.define('FactionMember', {
  uid: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
  },
  fid: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },
  role: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },
  joinedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

const FactionBan = sequelize.define('FactionBan', {
  fid: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
  },
  uid: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

const FactionCountryExclude = sequelize.define('FactionCountryExclude', {
  fid: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
  },
  country: {
    type: `${DataTypes.STRING(2)} CHARACTER SET ascii COLLATE ascii_general_ci`,
    primaryKey: true,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

const FactionInvite = sequelize.define('FactionInvite', {
  fid: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },
  code: {
    type: `${DataTypes.STRING(14)} CHARACTER SET ascii COLLATE ascii_general_ci`,
    allowNull: false,
    unique: 'faction_invite_code',
  },
  invitedUid: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },
  createdBy: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

const FactionJoinRequest = sequelize.define('FactionJoinRequest', {
  fid: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
  },
  uid: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

export {
  Faction,
  FactionMember,
  FactionBan,
  FactionCountryExclude,
  FactionInvite,
  FactionJoinRequest,
};
