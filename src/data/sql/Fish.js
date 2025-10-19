import { DataTypes } from 'sequelize';
import sequelize from './sequelize.js';

const Fish = sequelize.define('Fish', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  uid: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  type: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
  },

  size: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

export async function storeFish(uid, type, size) {
  try {
    await Fish.create({
      uid,
      type,
      size,
    });
  } catch (error) {
    console.error(`SQL Error on storeFish: ${error.message}`);
  }
}

export async function getFishesOfUser(uid) {
  const fishes = [];
  try {
    const fishModels = await Fish.findAll({
      attributes: [
        'type',
        'size',
        'createdAt',
      ],
      where: { uid },
      order: [['createdAt', 'DESC']],
      raw: true,
    });
    let i = fishModels.length;
    while (i > 0) {
      i -= 1;
      const { type, size, createdAt } = fishModels[i];
      fishes.push({ type, size, ts: createdAt.getTime() });
    }
  } catch (error) {
    console.error(`SQL Error on getFishesOfUser: ${error.message}`);
  }
  return fishes;
}

export default Fish;
