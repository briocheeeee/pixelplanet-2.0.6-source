/*
 * get profile information of user
 */
import { getFishesOfUser } from '../../data/sql/Fish.js';

export default async (req, res) => {
  const { user } = req;
  const fishes = await getFishesOfUser(user.id);
  res.status(200).json({ fishes });
};
