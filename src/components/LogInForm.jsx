/*
 * LogIn Form
 */
import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { t } from 'ttag';

import {
  validateEMail, validateName, validatePassword,
} from '../utils/validation.js';
import { requestLogin } from '../store/actions/fetch.js';
import { loginUser } from '../store/actions/index.js';


function validate(nameoremail, password) {
  const errors = [];
  const mailerror = (nameoremail.indexOf('@') !== -1)
    ? validateEMail(nameoremail)
    : validateName(nameoremail);
  if (mailerror) errors.push(mailerror);
  const passworderror = validatePassword(password);
  if (passworderror) errors.push(passworderror);

  return errors;
}

const inputStyles = {
  display: 'inline-block',
  width: '75%',
  maxWidth: '35em',
};

const LogInForm = () => {
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState([]);

  const dispatch = useDispatch();

  const handleSubmit = async (evt) => {
    evt.preventDefault();
    if (submitting) {
      return;
    }
    const nameoremail = evt.target.nameoremail.value;
    const password = evt.target.password.value;
    const durationsel = evt.target.durationsel.value;

    const valErrors = validate(nameoremail, password);
    if (valErrors.length > 0) {
      setErrors(valErrors);
      return;
    }

    setSubmitting(true);
    const { errors: respErrors, me } = await requestLogin(
      nameoremail, password, durationsel,
    );
    setSubmitting(false);
    if (respErrors) {
      setErrors(respErrors);
      return;
    }
    dispatch(loginUser(me));
  };

  return (
    <form onSubmit={handleSubmit}>
      {errors.map((error) => (
        <p key={error} className="errormessage">
          <span>{t`Error`}</span>:&nbsp;{error}
        </p>
      ))}
      <input
        style={inputStyles}
        name="nameoremail"
        autoComplete="email"
        type="text"
        placeholder={t`Name or Email`}
      /><br />
      <input
        style={inputStyles}
        name="password"
        autoComplete="current-password"
        type="password"
        placeholder={t`Password`}
      />
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
      <p>
        <button type="submit">
          {(submitting) ? '...' : t`LogIn`}
        </button>
      </p>
    </form>
  );
};

export default React.memo(LogInForm);
