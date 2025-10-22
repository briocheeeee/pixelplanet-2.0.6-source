import { USERLVL } from '../../data/sql/index.js';
import { getMessageById, updateMessageText } from '../../data/sql/Message.js';
import socketEvents from '../../socket/socketEvents.js';
import { escapeMd } from '../../core/utils.js';

export default async function chatDelete(req, res) {
  const { t } = req.ttag;
  try {
    const { user } = req;
    if (!user || user.userlvl < USERLVL.ADMIN) {
      res.status(403).json({ errors: [t`Just admins can do that`] });
      return;
    }
    const { mid } = req.body || {};
    const id = parseInt(mid, 10);
    if (!id || Number.isNaN(id) || id <= 0) {
      res.status(400).json({ errors: [t`Invalid request`] });
      return;
    }
    const msg = await getMessageById(id);
    if (!msg) {
      res.status(404).json({ errors: [t`Not found`] });
      return;
    }
    const orig = typeof msg.message === 'string' ? msg.message : '';
    const mention = `@[${escapeMd(user.name)}](${user.id})`;
    const info = `${t`deleted by`} ${mention}`;
    const maxLen = 200;
    const sepChar = ' ';
    const availableForMask = Math.max(0, maxLen - info.length - sepChar.length);
    let masked = '';
    for (let i = 0; i < orig.length && masked.length < availableForMask; i += 1) {
      masked += (orig[i] === ' ') ? ' ' : '#';
    }
    const sep = masked.length ? ' ' : '';
    let combined = `${masked}${sep}${info}`.trimStart();
    if (combined.length > maxLen) {
      const availForMask2 = Math.max(0, maxLen - info.length - (sep ? 1 : 0));
      const m2 = masked.slice(0, availForMask2);
      combined = m2 ? `${m2} ${info}` : info;
    }

    const alreadyDeleted = (() => {
      try {
        const m = msg.message.match(/@\[[^\]]+\]\(\d+\)\s*$/);
        if (!m) return false;
        const prefix = msg.message.slice(0, m.index).trimEnd();
        return prefix.startsWith('#');
      } catch { return false; }
    })();
    if (msg.message === combined || alreadyDeleted) {
      res.status(200).json({ ok: true, already: true });
      return;
    }
    const ok = await updateMessageText(id, combined);
    if (!ok) {
      res.status(500).json({ errors: [t`Server error`] });
      return;
    }

    socketEvents.broadcastEditChatMessage(msg.cid, id, combined, true, info);
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ errors: ['internal'] });
  }
}
