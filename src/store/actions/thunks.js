/*
 * thunk actions
 */
import { t } from 'ttag';

import {
  requestStartDm,
  requestBlock,
  requestBlockDm,
  requestPrivatize,
  requestLeaveChan,
  requestRankings,
  requestProfile,
  requestChatMessages,
  requestMe,
} from './fetch.js';
import {
  pAlert,
  receiveStats,
  receiveMe,
  blockUser,
  unblockUser,
  blockingDm,
  privatize,
  selectPencilMode,
} from './index.js';
import {
  addChatChannel,
  removeChatChannel,
} from './socket.js';
import { PENCIL_MODE } from '../../core/constants.js';

function setApiFetching(fetching) {
  return {
    type: 'SET_API_FETCHING',
    fetching,
  };
}

function setChatFetching(fetching) {
  return {
    type: 's/SET_CHAT_FETCHING',
    fetching,
  };
}

function receiveChatHistory(
  cid,
  history,
) {
  return {
    type: 's/REC_CHAT_HISTORY',
    cid,
    history,
  };
}

/*
 * query with either userId or userName
 */
export function startDm(query, cb = null) {
  return async (dispatch) => {
    dispatch(setApiFetching(true));
    const res = await requestStartDm(query);
    if (typeof res === 'string') {
      dispatch(pAlert(
        'Direct Message Error',
        res,
        'error',
        'OK',
      ));
    } else {
      const cid = Number(Object.keys(res)[0]);
      dispatch(addChatChannel(res));
      if (cb) {
        cb(cid);
      }
    }
    dispatch(setApiFetching(false));
  };
}

export function fetchStats() {
  return async (dispatch) => {
    const rankings = await requestRankings();
    if (!rankings.errors) {
      dispatch(receiveStats(rankings));
    }
  };
}

export function fetchProfile() {
  return async (dispatch) => {
    const profile = await requestProfile();
    if (!profile.errors) {
      dispatch({ type: 'REC_PROFILE', profile });
    }
  };
}

export function fetchMe() {
  return async (dispatch) => {
    const me = await requestMe();
    if (!me.errors) {
      dispatch(receiveMe(me));
    }
  };
}

export function fetchChatMessages(cid) {
  return async (dispatch) => {
    dispatch(setChatFetching(true));
    const history = await requestChatMessages(cid);
    if (history) {
      setTimeout(() => { dispatch(setChatFetching(false)); }, 500);
      dispatch(receiveChatHistory(cid, history));
    } else {
      setTimeout(() => { dispatch(setChatFetching(false)); }, 5000);
    }
  };
}

export function setUserBlock(
  userId,
  userName,
  block,
) {
  return async (dispatch) => {
    dispatch(setApiFetching(true));
    const res = await requestBlock(userId, block);
    if (res) {
      dispatch(pAlert(
        'User Block Error',
        res,
        'error',
        'OK',
      ));
    } else if (block) {
      dispatch(blockUser(userId, userName));
    } else {
      dispatch(unblockUser(userId, userName));
    }
    dispatch(setApiFetching(false));
  };
}

export function setBlockingDm(block) {
  return async (dispatch) => {
    dispatch(setApiFetching(true));
    const res = await requestBlockDm(block);
    if (res) {
      dispatch(pAlert(
        'Blocking DMs Error',
        res,
        'error',
        'OK',
      ));
    } else {
      dispatch(blockingDm(block));
    }
    dispatch(setApiFetching(false));
  };
}

export function setPrivatize(priv) {
  return async (dispatch) => {
    dispatch(setApiFetching(true));
    const res = await requestPrivatize(priv);
    if (res) {
      dispatch(pAlert(
        'Setting User Private Error',
        res,
        'error',
        'OK',
      ));
    } else {
      dispatch(privatize(priv));
    }
    dispatch(setApiFetching(false));
  };
}

export function setLeaveChannel(
  cid,
) {
  return async (dispatch) => {
    dispatch(setApiFetching(true));
    const res = await requestLeaveChan(cid);
    if (res) {
      dispatch(pAlert(
        'Leaving Channel Error',
        res,
        'error',
        'OK',
      ));
    } else {
      dispatch(removeChatChannel(cid));
    }
    dispatch(setApiFetching(false));
  };
}

function setNotification(notification) {
  return {
    type: 'SET_NOTIFICATION',
    notification,
  };
}

function unsetNotification() {
  return {
    type: 'UNSET_NOTIFICATION',
  };
}

let lastNotify = null;
export function notify(notification) {
  return (dispatch) => {
    dispatch(setNotification(notification));
    if (lastNotify) {
      clearTimeout(lastNotify);
      lastNotify = null;
    }
    lastNotify = setTimeout(() => {
      dispatch(unsetNotification());
    }, 1500);
  };
}

export function switchPencilMode() {
  return (dispatch, getState) => {
    let pencilMode = getState().canvas.pencilMode + 1;
    let bound = PENCIL_MODE.HISTORY;
    if (window.ssv?.backupurl) bound += 1;
    if (pencilMode >= bound) pencilMode = 0;
    let notification = t`Pencil picks: `;
    switch (pencilMode) {
      case 0:
        notification += t`Selected Color`;
        break;
      case 1:
        notification += t`From Template`;
        break;
      case 2:
        notification += t`From History`;
        break;
      default:
    }
    dispatch(selectPencilMode(pencilMode));
    dispatch(notify(notification));
  };
}
