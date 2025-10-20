/*
 * Admintools
 */

import React, { useState, useEffect, useCallback } from 'react';
import { t } from 'ttag';

import DeleteList from './DeleteList.jsx';
import AnnouncementBar from './AnnouncementBar.jsx';
import { api } from '../utils/utag.js';
import { requestFactionAdminList, requestFactionAdminDelete } from '../store/actions/fetch.js';

async function submitIPAction(
  action,
  vallist,
  callback,
) {
  const data = new FormData();
  data.append('ipaction', action);
  data.append('ip', vallist);
  const resp = await fetch(api`/api/modtools`, {
    credentials: 'include',
    method: 'POST',
    body: data,
  });
  callback(await resp.text());
}

async function getModList(callback) {
  const data = new FormData();
  data.append('modlist', true);
  const resp = await fetch(api`/api/modtools`, {
    credentials: 'include',
    method: 'POST',
    body: data,
  });
  if (resp.ok) {
    callback(await resp.json());
  } else {
    callback([]);
  }
}

async function submitRemMod(userId, callback) {
  const data = new FormData();
  data.append('remmod', userId);
  const resp = await fetch(api`/api/modtools`, {
    credentials: 'include',
    method: 'POST',
    body: data,
  });
  callback(resp.ok, await resp.text());
}

async function submitMakeMod(userName, callback) {
  const data = new FormData();
  data.append('makemod', userName);
  const resp = await fetch(api`/api/modtools`, {
    credentials: 'include',
    method: 'POST',
    body: data,
  });
  if (resp.ok) {
    callback(await resp.json());
  } else {
    callback(await resp.text());
  }
}

async function submitQuickAction(action, callback) {
  const data = new FormData();
  data.append('quickaction', action);
  const resp = await fetch(api`/api/modtools`, {
    credentials: 'include',
    method: 'POST',
    body: data,
  });
  callback(await resp.text());
}

async function getGameState(
  callback,
) {
  const data = new FormData();
  data.append('gamestate', true);
  const resp = await fetch(api`/api/modtools`, {
    credentials: 'include',
    method: 'POST',
    body: data,
  });
  if (resp.ok) {
    callback(await resp.json());
  } else {
    callback({
    });
  }
}

async function submitAnnouncement(text, callback) {
  const resp = await fetch(api`/api/announce`, {
    credentials: 'include',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (resp.ok) {
    callback(true, 'Announcement sent');
  } else {
    const data = await resp.json().catch(() => ({}));
    const msg = (data && data.errors && data.errors[0]) ? data.errors[0] : await resp.text();
    callback(false, msg);
  }
}

function Admintools() {
  const [iPAction, selectIPAction] = useState('iidtoip');
  const [modName, selectModName] = useState('');
  const [txtval, setTxtval] = useState('');
  const [resp, setResp] = useState(null);
  const [annText, setAnnText] = useState('');
  const [modlist, setModList] = useState([]);
  const [gameState, setGameState] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [annPreview, setAnnPreview] = useState(false);
  const [fq, setFq] = useState('');
  const [fpage, setFpage] = useState(1);
  const [frows, setFrows] = useState([]);
  const [fbusy, setFbusy] = useState(false);

  useEffect(() => {
    getModList((mods) => setModList(mods));
  }, []);

  useEffect(() => {
    getGameState((stats) => setGameState(stats));
  }, []);

  const reqQuickAction = useCallback((action) => () => {
    if (submitting) return;
    setSubmitting(true);
    submitQuickAction(action, (ret) => {
      setResp(ret);
      setSubmitting(false);
    });
  }, [submitting]);

  return (
    <div className="content">
      {resp && (
        <div className="respbox">
          {resp.split('\n').map((line) => (
            <p key={line.slice(0, 3)}>
              {line}
            </p>
          ))}
          <span
            role="button"
            tabIndex={-1}
            className="modallink"
            onClick={() => setResp(null)}
          >
            {t`Close`}
          </span>
        </div>
      )}
      <div>
        <br />
        <h3>{t`IP Actions`}</h3>
        <p>
          {t`Do stuff with IPs (one IP per line)`}
        </p>
        <select
          value={iPAction}
          onChange={(e) => {
            const sel = e.target;
            selectIPAction(sel.options[sel.selectedIndex].value);
          }}
        >
          {['iidtoip', 'iptoiid', 'markusersashacked']
            .map((opt) => (
              <option
                key={opt}
                value={opt}
              >
                {opt}
              </option>
            ))}
        </select>
        <br />
        <textarea
          rows="10"
          cols="17"
          value={txtval}
          onChange={(e) => setTxtval(e.target.value)}
        /><br />
        <button
          type="button"
          onClick={() => {
            if (submitting) return;
            setSubmitting(true);
            submitIPAction(
              iPAction,
              txtval,
              (ret) => {
                setSubmitting(false);
                setTxtval(ret);
              },
            );
          }}
        >
          {(submitting) ? '...' : t`Submit`}
        </button>
        <br />
        <div className="modaldivider" />

        <h3>{t`Factions`}</h3>
        <div>
          <input
            value={fq}
            onChange={(e) => setFq(e.target.value)}
            placeholder={t`Search name`}
            style={{ width: '100%', maxWidth: '20em' }}
          />
          <button
            type="button"
            onClick={async () => {
              if (fbusy) return;
              setFbusy(true);
              const ret = await requestFactionAdminList(fq, 1, 20);
              setFbusy(false);
              setFrows((ret && ret.data) ? ret.data : []);
              setFpage(1);
            }}
          >{(fbusy) ? '...' : t`Search`}</button>
        </div>
        <div>
          <table style={{ display: 'inline' }}>
            <thead>
              <tr>
                <th>{t`ID`}</th>
                <th>{t`Tag`}</th>
                <th>{t`Name`}</th>
                <th>{t`Members`}</th>
                <th>{t`Actions`}</th>
              </tr>
            </thead>
            <tbody>
              {frows.map((r) => (
                <tr key={r.id}>
                  <td className="c-num">{r.id}</td>
                  <td>{r.tag}</td>
                  <td>{r.name}</td>
                  <td className="c-num">{r.memberCount}</td>
                  <td>
                    <span
                      role="button"
                      tabIndex={-1}
                      className="modallink"
                      onClick={async () => {
                        if (fbusy) return;
                        setFbusy(true);
                        const ok = await requestFactionAdminDelete(r.id);
                        setFbusy(false);
                        if (!ok.errors) {
                          setFrows(frows.filter((x) => x.id !== r.id));
                        }
                      }}
                    >{t`Delete`}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 6 }}>
            <span
              role="button"
              tabIndex={-1}
              className="modallink"
              onClick={async () => {
                if (fpage <= 1 || fbusy) return;
                const np = fpage - 1;
                setFbusy(true);
                const ret = await requestFactionAdminList(fq, np, 20);
                setFbusy(false);
                setFrows((ret && ret.data) ? ret.data : []);
                setFpage(np);
              }}
            >{t`Prev`}</span>
            <span className="hdivider" />
            <span
              role="button"
              tabIndex={-1}
              className="modallink"
              onClick={async () => {
                if (fbusy) return;
                const np = fpage + 1;
                setFbusy(true);
                const ret = await requestFactionAdminList(fq, np, 20);
                setFbusy(false);
                setFrows((ret && ret.data) ? ret.data : []);
                setFpage(np);
              }}
            >{t`Next`}</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
          <div style={{ width: '100%', maxWidth: '40em' }}>
            <h3 style={{ textAlign: 'center', marginBottom: '0.25rem' }}>{t`Announcement`}</h3>
            <p style={{ textAlign: 'center', marginTop: 0 }}>
              {t`Send a short site-wide announcement (rate limited to every 1 hour per admin).`}
            </p>
            <textarea
              rows="4"
              style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}
              value={annText}
              onChange={(e) => setAnnText(e.target.value)}
              placeholder={t`Announcement text`}
            />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setAnnPreview(true)}
              >
                {t`Preview`}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (submitting) return;
                  const text = annText.trim();
                  if (!text) return;
                  setSubmitting(true);
                  submitAnnouncement(text, (ok, msg) => {
                    setSubmitting(false);
                    setResp(msg);
                    if (ok) {
                      setAnnText('');
                      setAnnPreview(false);
                    }
                  });
                }}
              >
                {(submitting) ? '...' : t`Send Announcement`}
              </button>
            </div>
          </div>
        </div>
        {annPreview && (
          <div style={{ marginTop: '0.5rem' }}>
            <AnnouncementBar
              manualOpen
              manualText={annText}
              manualBy={t`Preview`}
              manualAt={Date.now()}
              preview
              onClose={() => setAnnPreview(false)}
            />
          </div>
        )}
        
        <br />
        <div className="modaldivider" />

        <h3>{t`Quick Actions`}</h3>
        <button
          type="button"
          onClick={reqQuickAction('resetcaptchas')}
        >
          {(submitting) ? '...' : t`Reset Captchas of ALL Users`}
        </button>
        <br />
        <button
          type="button"
          onClick={reqQuickAction('rollcaptchafonts')}
        >
          {(submitting) ? '...' : t`Roll different Captcha Fonts`}
        </button>
        <br />
        <button
          type="button"
          onClick={reqQuickAction('givefishes')}
        >
          {(submitting) ? '...' : t`Give Everyone A Fish`}
        </button>
        <br />
        {(gameState.needVerification) ? (
          <button
            key="disableverify"
            type="button"
            onClick={() => {
              reqQuickAction('disableverify')();
              setGameState({ ...gameState, needVerification: false });
            }}
          >
            {(submitting) ? '...' : t`Stop requiring Verification to Place`}
          </button>
        ) : (
          <button
            key="enableverify"
            type="button"
            onClick={() => {
              reqQuickAction('enableverify')();
              setGameState({ ...gameState, needVerification: true });
            }}
          >
            {(submitting) ? '...' : t`Require Verification to Place`}
          </button>
        )}
        <br />
        <div className="modaldivider" />

        <h3>{t`Manage Moderators`}</h3>
        <p>
          {t`Remove Moderator`}
        </p>
        {(modlist.length) ? (
          <DeleteList
            list={modlist}
            callback={(id) => {
              if (submitting) return;
              setSubmitting(true);
              submitRemMod(id, (success, ret) => {
                if (success) {
                  setModList(
                    modlist.filter((modl) => (modl[0] !== id)),
                  );
                }
                setSubmitting(false);
                setResp(ret);
              });
            }}
            enabled={!submitting}
            joinident
          />
        )
          : (
            <p>{t`There are no mods`}</p>
          )}
        <br />
        <p>
          {t`Assign new Mod`}
        </p>
        <p>
          {t`Enter UserName of new Mod`}:&nbsp;
          <input
            value={modName}
            style={{
              display: 'inline-block',
              width: '100%',
              maxWidth: '20em',
            }}
            type="text"
            placeholder={t`User Name`}
            onChange={(evt) => {
              const co = evt.target.value.trim();
              selectModName(co);
            }}
          />
        </p>
        <button
          type="button"
          onClick={() => {
            if (submitting) return;
            setSubmitting(true);
            submitMakeMod(
              modName,
              (ret) => {
                if (typeof ret === 'string') {
                  setResp(ret);
                } else {
                  setResp(`Made ${ret[1]} mod successfully.`);
                  setModList([...modlist, ret]);
                }
                setSubmitting(false);
              },
            );
          }}
        >
          {(submitting) ? '...' : t`Submit`}
        </button>
        <br />
      </div>
    </div>
  );
}

export default React.memo(Admintools);
