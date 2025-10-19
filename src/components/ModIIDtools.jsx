/*
 * Admintools
 */

/* eslint-disable max-len */

import React, { useState } from 'react';
import { t } from 'ttag';

import { parseInterval } from '../core/utils.js';
import { api } from '../utils/utag.js';

async function submitIIDAction(
  action,
  iid,
  bid,
  iidoruser,
  identifierList,
  reason,
  duration,
  username,
) {
  const data = new FormData();
  data.append('iidaction', action);
  switch (action) {
    case 'givecaptcha':
    case 'whitelist':
    case 'unwhitelist': {
      if (!iid) {
        return t`You must enter an IID`;
      }
      data.append('iid', iid);
      break;
    }
    case 'baninfo': {
      if (!bid) {
        return t`You must enter an BID`;
      }
      data.append('bid', bid);
      break;
    }
    case 'status': {
      if (!iidoruser) {
        return t`You must enter an IID or UserId`;
      }
      data.append('iidoruser', iidoruser);
      break;
    }
    case 'changeusername': {
      if (!iidoruser) {
        return t`You must enter a UserId`;
      }
      if (!username) {
        return t`You must enter a username`;
      }
      data.append('iidoruser', iidoruser);
      data.append('username', username);
      break;
    }
    case 'ban': {
      const time = parseInterval(duration);
      if (time === 0 && duration !== '0') {
        return t`You must enter a duration`;
      }
      if (!reason) {
        return t`You must enter a reason`;
      }
      data.append('reason', reason);
      data.append('time', time);
      // fall through
    }
    case 'unban': {
      if (!identifierList) {
        return t`You must enter at least one IID, User Id or BID`;
      }
      data.append('identifiers', identifierList);
      break;
    }
    default:
      // nothing
  }
  const resp = await fetch(api`/api/modtools`, {
    credentials: 'include',
    method: 'POST',
    body: data,
  });
  return resp.text();
}

function ModIIDtools() {
  const [iIDAction, selectIIDAction] = useState('status');
  const [iid, selectIid] = useState('');
  const [bid, selectBid] = useState('');
  const [iidOrUser, selectIidOrUser] = useState('');
  const [identifierList, setIdentifierList] = useState('');
  const [reason, setReason] = useState('');
  const [username, setUsername] = useState('');
  const [duration, setDuration] = useState('1d');
  const [resp, setResp] = useState('');
  const [submitting, setSubmitting] = useState(false);

  return (
    <div style={{ textAlign: 'center', paddingLeft: '5%', paddingRight: '5%' }}>
      <form
        onSubmit={async (evt) => {
          evt.preventDefault();
          if (submitting) {
            return;
          }
          const ret = await submitIIDAction(
            iIDAction, iid, bid, iidOrUser, identifierList,
            reason, duration, username,
          );
          setSubmitting(false);
          setResp(ret);
        }}
      >
        <h3>{t`IID Actions`}</h3>
        <select
          value={iIDAction}
          onChange={(e) => {
            const sel = e.target;
            selectIIDAction(sel.options[sel.selectedIndex].value);
          }}
        >
          {[
            'status', 'baninfo', 'ban', 'unban',
            'whitelist', 'unwhitelist',
            'givecaptcha', 'changeusername',
          ].map((opt) => (
            <option
              key={opt}
              value={opt}
            >
              {opt}
            </option>
          ))}
        </select>
        {(iIDAction === 'ban') && (
          <React.Fragment key="ban">
            <p>{t`Reason`}</p>
            <input
              maxLength="200"
              style={{
                width: '100%',
              }}
              value={reason}
              placeholder={t`Enter Reason`}
              onChange={(evt) => setReason(evt.target.value)}
            />
            <p>
              {`${t`Duration`}: `}
              <input
                style={{
                  display: 'inline-block',
                  width: '100%',
                  maxWidth: '7em',
                }}
                value={duration}
                placeholder="1d"
                onChange={(evt) => {
                  setDuration(evt.target.value.trim());
                }}
              />
              {t`(0 = infinite)`}
            </p>
          </React.Fragment>
        )}
        {(iIDAction === 'whitelist' || iIDAction === 'unwhitelist' || iIDAction === 'givecaptcha' || iIDAction === 'ipstatus') && (
          <p key="iidactions">
            IID:&nbsp;
            <input
              value={iid}
              style={{
                display: 'inline-block',
                width: '100%',
                maxWidth: '37em',
              }}
              type="text"
              placeholder="xxxx-xxxxx-xxxx"
              onChange={(evt) => {
                selectIid(evt.target.value.trim());
              }}
            />
          </p>
        )}
        {(iIDAction === 'baninfo') && (
          <p key="baninfo">
            BID:&nbsp;
            <input
              value={bid}
              style={{
                display: 'inline-block',
                width: '100%',
                maxWidth: '37em',
              }}
              type="text"
              placeholder="xxxx-xxxxx-xxxx"
              onChange={(evt) => {
                selectBid(evt.target.value.trim());
              }}
            />
          </p>
        )}
        {(iIDAction === 'status') && (
          <p key="status">
            IID or UserID or Name:&nbsp;
            <input
              value={iidOrUser}
              style={{
                display: 'inline-block',
                width: '100%',
                maxWidth: '37em',
              }}
              type="text"
              onChange={(evt) => {
                selectIidOrUser(evt.target.value.trim());
              }}
            />
          </p>
        )}
        {(iIDAction === 'changeusername') && (
          <React.Fragment key="changeusername">
            <p>
              UserID or Name:
              <input
                value={iidOrUser}
                style={{
                  display: 'inline-block',
                  width: '100%',
                  maxWidth: '37em',
                }}
                type="text"
                onChange={(evt) => {
                  selectIidOrUser(evt.target.value.trim());
                }}
              />
            </p>
            <p>{t`Username`}</p>
            <input
              maxLength="200"
              style={{
                width: '100%',
              }}
              value={username}
              placeholder={t`Enter Reason`}
              onChange={(evt) => setUsername(evt.target.value)}
            />
          </React.Fragment>
        )}
        {(iIDAction === 'ban' || iIDAction === 'unban') && (
          <p key="banunban">
            IID, UID or BID:
            <br />
            <textarea
              style={{
                width: '100%',
                maxWidth: '37em',
              }}
              rows="10"
              cols="17"
              value={identifierList}
              onChange={(e) => setIdentifierList(e.target.value)}
            />
          </p>
        )}
        <p>
          <button type="submit">
            {(submitting) ? '...' : t`Submit`}
          </button>
        </p>
      </form>
      <textarea
        style={{
          width: '100%',
        }}
        rows={(resp) ? resp.split('\n').length : 10}
        value={resp}
        readOnly
      />
    </div>
  );
}

export default React.memo(ModIIDtools);
