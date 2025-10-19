/*
 * get ThreePIDs
 */
import { getTPIDsOfUser } from '../../../data/sql/ThreePID.js';
import { censorIdentifier } from '../../../core/utils.js';

export default async (req, res) => {
  const tpids = await getTPIDsOfUser(req.user.id);

  for (let i = 0; i < tpids.length; i += 1) {
    const tpid = tpids[i];
    tpid.tpid = censorIdentifier(tpid.tpid);
  }

  res.status(200).json({ tpids });
};
