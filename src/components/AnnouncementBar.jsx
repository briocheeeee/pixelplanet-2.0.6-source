import React, { useEffect, useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { hideAnnouncement } from '../store/actions/index.js';
import Markdown from './Markdown.jsx';
import { parse } from '../core/MarkdownParser.js';

const AnnouncementBar = ({ manualOpen, manualText, manualBy, manualAt, preview = false, onClose }) => {
  const dispatch = useDispatch();
  const storeState = useSelector((s) => s.announcement);
  const open = manualOpen ?? storeState.open;
  const text = manualText ?? storeState.text;
  const by = manualBy ?? storeState.by;
  const at = manualAt ?? storeState.at;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      const id = setTimeout(() => setVisible(true), 10);
      const duration = 20000;
      const hid = preview ? null : setTimeout(() => dispatch(hideAnnouncement()), duration);
      return () => {
        clearTimeout(id);
        if (hid) clearTimeout(hid);
      };
    }
    setVisible(false);
    return undefined;
  }, [open, dispatch, preview]);

  const md = useMemo(() => parse(text || ''), [text]);

  if (!open) return null;

  const atNum = Number(at);
  const ts = Number.isFinite(atNum) && atNum > 0 ? new Date(atNum).toLocaleTimeString() : '';
  const classes = [
    'AnnouncementBar',
    'pos-top',
    visible ? 'show' : '',
    preview ? 'preview' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} role="status" aria-live="polite">
      <div className="AnnouncementBar__row">
        <div className="AnnouncementBar__text">
          <Markdown mdArray={md} />
        </div>
        {((by && by.length) || (ts && ts.length)) && (
          <span className="AnnouncementBar__meta">
            {[by, ts].filter(Boolean).join(' • ')}
          </span>
        )}
        <button
          type="button"
          className="AnnouncementBar__close"
          onClick={() => {
            if (onClose) onClose();
            else dispatch(hideAnnouncement());
          }}
          aria-label="Close announcement"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default React.memo(AnnouncementBar);
