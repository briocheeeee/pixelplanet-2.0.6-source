/*
 */
import React from 'react';
import { t } from 'ttag';

import { u, cdn } from '../utils/utag.js';
import LogInForm from './LogInForm.jsx';
import useLink from './hooks/link.js';

const logoStyle = {
  marginRight: 5,
};

const LogInArea = () => {
  const link = useLink();

  return (
    <div style={{ textAlign: 'center' }}>
      <p>
        {t`Login to access more features and stats.`}
      </p>
      <h2>{t`Login with Name or Mail:`}</h2>
      <LogInForm />
      <p>
        <span
          className="modallink"
          onClick={() => link('FORGOT_PASSWORD')}
          role="presentation"
        >
          {t`I forgot my Password.`}
        </span>
      </p>
      <h2>{t`or login with:`}</h2>
      <a href={u`/api/auth/discord`}>
        <img
          style={logoStyle}
          width={32}
          src={cdn`/discordlogo.svg`}
          alt="Discord"
        />
      </a>
      <a href={u`/api/auth/google`}>
        <img
          style={logoStyle}
          width={32}
          src={cdn`/googlelogo.svg`}
          alt="Google"
        />
      </a>
      <a href={u`/api/auth/facebook`}>
        <img
          style={logoStyle}
          width={32}
          src={cdn`/facebooklogo.svg`}
          alt="Facebook"
        />
      </a>
      <a href={u`/api/auth/vk`}>
        <img
          style={logoStyle}
          width={32}
          src={cdn`/vklogo.svg`}
          alt="VK"
        />
      </a>
      <a href={u`/api/auth/reddit`}>
        <img
          style={logoStyle}
          width={32}
          src={cdn`/redditlogo.svg`}
          alt="Reddit"
        />
      </a>
      <h2>{t`or register here:`}</h2>
      <button
        type="button"
        onClick={() => link('REGISTER')}
      >
        {t`Register`}
      </button>
    </div>
  );
};

export default React.memo(LogInArea);
