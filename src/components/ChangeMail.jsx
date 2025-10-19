/*
 * Form to Change ANY Third Party Identiier,
 * it is called ChangeMail, because that is what it originally was
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { t } from 'ttag';

import DeleteList from './DeleteList.jsx';
import {
  validateEMail, validatePassword,
} from '../utils/validation.js';
import {
  requestMailChange, requestTpids, requestRemoveTpid,
} from '../store/actions/fetch.js';
import { THREEPID_PROVIDERS } from '../core/constants.js';

function validate(havePassword, email, password) {
  const errors = [];

  if (havePassword) {
    const passerror = validatePassword(password);
    if (passerror) errors.push(passerror);
  }
  const mailerror = validateEMail(email);
  if (mailerror) errors.push(mailerror);

  return errors;
}

const ChangeMail = ({ done }) => {
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [tpids, setTpids] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState([]);

  const havePassword = useSelector((state) => state.user.havePassword);

  const updateTpids = useCallback(async () => {
    const res = await requestTpids();
    if (res.errors) {
      setErrors(res.errors);
    }
    setTpids(res.tpids);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { updateTpids(); }, []);

  const changeMail = useCallback(async (evt) => {
    evt.preventDefault();
    if (submitting) {
      return;
    }
    const valErrors = validate(havePassword, email, password);
    if (valErrors.length > 0) {
      setErrors(valErrors);
      return;
    }

    setSubmitting(true);
    const { errors: respErrors } = await requestMailChange(email, password);
    setSubmitting(false);
    if (respErrors) {
      setErrors(respErrors);
      return;
    }
    setErrors([]);
    setEmail('');
    setPassword('');
    updateTpids();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, havePassword, password, submitting]);

  const tpidLogos = useMemo(() => {
    const logos = {};
    Object.keys(THREEPID_PROVIDERS).forEach((providerString) => {
      const provider = THREEPID_PROVIDERS[providerString];
      logos[provider] = `/${providerString.toLowerCase()}logo.svg`;
    });
    return logos;
  }, []);

  const removeTpid = useCallback(async (id) => {
    if (submitting) {
      return;
    }
    if (havePassword) {
      const passerror = validatePassword(password);
      if (passerror) {
        setErrors([passerror]);
        return;
      }
    }

    setSubmitting(true);
    const { errors: respErrors } = await requestRemoveTpid(id, password);
    setSubmitting(false);
    if (respErrors) {
      setErrors(respErrors);
      return;
    }
    setErrors([]);
    setPassword('');
    setTpids(tpids.filter(({ id: tid }) => tid !== id));
  }, [password, tpids, submitting, havePassword]);

  return (
    <div className="inarea">
      {errors.map((error) => (
        <p key={error} className="errormessage">
          <span>{t`Error`}</span>:&nbsp;
          {error}
        </p>
      ))}
      {(havePassword)
      && (
        <React.Fragment key="pass">
          {t`To use this page, enter your Password:`}
          <br />
          <input
            value={password}
            onChange={(evt) => setPassword(evt.target.value)}
            type="password"
            placeholder={t`Password`}
          />
          <div className="modaldivider" />
        </React.Fragment>
      )}
      {(() => {
        /* this is so ugly, but it is what it is.. */
        if (tpids === null && !errors.length) {
          return (
            <p>{t`...loading Login methods...`}</p>
          );
        }
        if (!tpids?.length) {
          return null;
        }
        return (
          <React.Fragment key="tpids">
            <p>{t`Remove a Login method:`}</p>
            <DeleteList
              list={tpids.map(({ id, provider, tpid }) => [
                id, tpid, tpidLogos[provider],
              ])}
              callback={removeTpid}
              enabled={!submitting}
            />
          </React.Fragment>
        );
      })()}
      {(tpids?.length || (tpids === null && !errors.length)) && (
        <div className="modaldivider" />
      )}
      <p>{t`Change your Mail Adress here:`}</p>
      <form onSubmit={changeMail}>
        <input
          value={email}
          onChange={(evt) => setEmail(evt.target.value)}
          type="text"
          placeholder={t`New Mail`}
        />
        <button type="submit">
          {(submitting) ? '...' : t`Save`}
        </button>
      </form>
      <div className="modaldivider" />
      <button type="button" onClick={done}>{t`Cancel`}</button>
    </div>
  );
};

export default React.memo(ChangeMail);
