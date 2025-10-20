import { getFishesOfUser } from '../../data/sql/Fish.js';
import { User } from '../../data/sql/index.js';
import { getUserFactionTag } from '../../data/redis/factions.js';
import { USER_FLAGS } from '../../data/sql/User.js';
import { getUserRanks } from '../../data/redis/ranks.js';

export default async (req, res) => {
  const { user } = req;
  const uid = Number(req.query?.uid) || 0;
  if (!uid) {
    res.status(400).json({ errors: ['invalid user'] });
    return;
  }
  const target = await User.findByPk(uid, {
    attributes: ['id', 'name', 'username', 'avatar', 'flags'],
    raw: true,
  });
  if (!target) {
    res.status(404).json({ errors: ['user not found'] });
    return;
  }
  const isPrivate = !!(target.flags & (0x01 << USER_FLAGS.PRIV));
  if (isPrivate && (!user || user.id !== uid)) {
    res.status(200).json({ private: true });
    return;
  }
  const [fishes, ranks, ftag] = await Promise.all([
    getFishesOfUser(uid),
    getUserRanks(uid),
    getUserFactionTag(uid),
  ]);
  let avatar = target.avatar || null;
  if (typeof avatar === 'string') {
    if (avatar.startsWith('/public/avatars/')) {
      avatar = avatar.replace('/public/avatars/', '/avatars/');
    } else if (!avatar.startsWith('/avatars/') && !avatar.startsWith('http')) {
      avatar = `/avatars/${avatar}`;
    }
  }
  const [totalPixels, dailyTotalPixels, ranking, dailyRanking] = ranks || [];
  res.status(200).json({
    private: false,
    user: {
      id: target.id,
      name: target.name,
      username: target.username,
      avatar,
      factionTag: ftag || null,
    },
    stats: {
      totalPixels: totalPixels || 0,
      dailyTotalPixels: dailyTotalPixels || 0,
      ranking: ranking || 0,
      dailyRanking: dailyRanking || 0,
    },
    fishes,
  });
};
