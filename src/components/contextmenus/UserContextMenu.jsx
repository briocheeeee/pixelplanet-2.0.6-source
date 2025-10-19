/*
 *
 */

import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { t } from 'ttag';

import {
  startDm,
  setUserBlock,
} from '../../store/actions/thunks.js';
import { escapeMd } from '../../core/utils.js';
import { openWindow } from '../../store/actions/windows.js';
import { requestUserPrivacy } from '../../store/actions/fetch.js';

/*
 * args: {
 *   name,
 *   uid,
 *   setChannel,
 *   addToInput,
 * }
 */
const UserContextMenu = ({ args, close }) => {
  const channels = useSelector((state) => state.chat.channels);
  const fetching = useSelector((state) => state.fetching.fetchingApi);

  const dispatch = useDispatch();

  const {
    name,
    uid,
    setChannel,
    addToInput,
  } = args;

  const [showProfile, setShowProfile] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await requestUserPrivacy(uid);
      if (!active) return;
      if (!res?.errors) {
        setShowProfile(!res.private);
      } else {
        setShowProfile(false);
      }
    })();
    return () => { active = false; };
  }, [uid]);

  return (
    <>
      {(showProfile) && (
      <div
        role="button"
        key="viewprofile"
        tabIndex={0}
        onClick={() => {
          dispatch(openWindow('USER_PROFILE', false, name, { uid, name }, true));
          close();
        }}
        style={{ borderTop: 'none' }}
      >
        {t`View Profile`}
      </div>
      )}
      <div
        role="button"
        key="ping"
        tabIndex={0}
        onClick={() => {
          const ping = `@[${escapeMd(name)}](${uid})`;
          addToInput(ping);
          close();
        }}
        style={{ borderTop: 'none' }}
      >
        {t`Ping`}
      </div>
      <div
        role="button"
        key="dm"
        tabIndex={0}
        onClick={() => {
          /*
           * if dm channel already exists,
           * just switch
           */
          const cids = Object.keys(channels);
          for (let i = 0; i < cids.length; i += 1) {
            const cid = cids[i];
            if (channels[cid].length === 4 && channels[cid][3] === uid) {
              setChannel(cid);
              close();
              return;
            }
          }
          if (!fetching) {
            dispatch(startDm({ userId: uid }, setChannel));
          }
          close();
        }}
      >
        {t`DM`}
      </div>
      <div
        role="button"
        key="block"
        tabIndex={-1}
        onClick={() => {
          dispatch(setUserBlock(uid, name, true));
          close();
        }}
      >
        {t`Block`}
      </div>
    </>
  );
};

export default React.memo(UserContextMenu);
