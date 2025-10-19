/*
 * SignUp Form to register new user by mail
 */

import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { t } from 'ttag';

import Captcha from '../Captcha.jsx';
import {
  validateEMail, validateName, validatePassword, validateUsername,
} from '../../utils/validation.js';
import { requestRegistration } from '../../store/actions/fetch.js';
import { loginUser } from '../../store/actions/index.js';
import useLink from '../hooks/link.js';


function validate(name, username, email, password, confirmPassword) {
  const errors = [];
  const mailerror = validateEMail(email);
  if (mailerror) errors.push(mailerror);
  const nameerror = validateName(name);
  if (nameerror) errors.push(nameerror);
  const usernameerror = validateUsername(username);
  if (usernameerror) errors.push(usernameerror);
  const passworderror = validatePassword(password);
  if (passworderror) errors.push(passworderror);

  if (password !== confirmPassword) {
    errors.push('Passwords do not match');
  }
  return errors;
}

const Register = () => {
  const [submitting, setSubmitting] = useState('');
  const [ready, setReady] = useState(false);
  const [errors, setErrors] = useState([]);
  // used to be able to force Captcha rerender on error
  const [captKey, setCaptKey] = useState(Date.now());

  const dispatch = useDispatch();

  const link = useLink();

  const handleSubmit = async (evt) => {
    evt.preventDefault();
    if (submitting || !ready) {
      return;
    }
    const name = evt.target.name.value;
    const username = evt.target.username.value;
    const email = evt.target.email.value;
    const password = evt.target.password.value;
    const confirmPassword = evt.target.confirmpassword.value;
    const durationsel = evt.target.durationsel.value;
    const captcha = evt.target.captcha.value;
    const captchaid = evt.target.captchaid.value;
    const challengeSolution = evt.target.challengesolution.value;

    const valErrors = validate(
      name, username, email, password, confirmPassword,
    );
    if (valErrors.length > 0) {
      setErrors(valErrors);
      return;
    }

    setSubmitting(true);
    const { errors: respErrors, me } = await requestRegistration(
      name,
      username,
      email,
      password,
      durationsel,
      captcha,
      captchaid,
      challengeSolution,
    );
    setSubmitting(false);
    if (respErrors) {
      setCaptKey(Date.now());
      setErrors(respErrors);
      return;
    }

    dispatch(loginUser(me));
    link('USERAREA');
  };

  /* eslint-disable max-len */
  return (
    <div className="content">
      <form
        style={{ paddingLeft: '5%', paddingRight: '5%' }}
        onSubmit={handleSubmit}
      >
        <p>{t`Register new account here`}</p>
        <h3>{t`Name`}:</h3>
        {t`This is the name that other people see, e.g. in Chat. You can change it at any time. All characters except @, /, \, >, < and # are allowed.`}<br />
        <input
          name="name"
          className="reginput"
          autoComplete="username"
          type="text"
          placeholder={t`Name`}
        />
        <h3>{t`User Name`}:</h3>
        {t`The name of your account, only a-z, A-Z, -, ., and - characters are allowed. It is permanent, you can not change it later.`}<br />
        <input
          name="username"
          className="reginput"
          autoComplete="username"
          type="text"
          placeholder={t`Name`}
        />
        <h3>{t`Email`}:</h3>
        {t`Email is used to verify your account. You might get a cofirmation mail after registering.`}<br />
        <input
          name="email"
          className="reginput"
          autoComplete="email"
          type="text"
          placeholder={t`Email`}
        />
        <h3>{t`Password`}:</h3>
        <input
          name="password"
          className="reginput"
          autoComplete="new-password"
          type="password"
          placeholder={t`Password`}
        />
        <h3>{t`Confirm Password`}:</h3>
        <input
          name="confirmpassword"
          className="reginput"
          autoComplete="new-password"
          type="password"
          placeholder={t`Confirm Password`}
        />
        {errors.map((error) => (
          <p key={error} className="errormessage"><span>{t`Error`}</span>
            :&nbsp;{error}</p>
        ))}
        <p>
          {t`Stay logged in: `}
          <select defaultValue={24 * 31} name="durationsel">
            <option value={0}>{t`Until the browser closes`}</option>
            <option value={24 * 7}>{t`For one week`}</option>
            <option value={24 * 31}>{t`For one month`}</option>
            <option value={24 * 265}>{t`For one year`}</option>
            <option value="forever">{t`Forever`}</option>
          </select>
        </p>
        <h3>{t`Captcha`}:</h3>
        <Captcha
          autoload={false}
          width={85}
          key={captKey}
          onReadyStateChange={setReady}
        /><br />
        <button
          type="submit"
          disabled={submitting || !ready}
        >
          {t`Submit`}
        </button>
        <button
          type="button"
          onClick={() => link('USERAREA')}
        >
          {t`Cancel`}
        </button>
      </form>
    </div>
  );
};


export default React.memo(Register);
