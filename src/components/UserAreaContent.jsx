/*
 * Menu to change user credentials
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useSelector, shallowEqual, useDispatch } from 'react-redux';
import { t } from 'ttag';

import UserMessages from './UserMessages.jsx';
import FishList from './FishList.jsx';
import ChangePassword from './ChangePassword.jsx';
import ChangeName from './ChangeName.jsx';
import ChangeUsername from './ChangeUsername.jsx';
import ChangeMail from './ChangeMail.jsx';
import DeleteAccount from './DeleteAccount.jsx';
import SocialSettings from './SocialSettings.jsx';
import AvatarUpload from './AvatarUpload.jsx';
import { logoutUser } from '../store/actions/index.js';
import { requestLogOut } from '../store/actions/fetch.js';
import { numberToString } from '../core/utils.js';
import { selectIsDarkMode } from '../store/selectors/gui.js';

const AREAS = {
  CHANGE_NAME: ChangeName,
  CHANGE_USERNAME: ChangeUsername,
  CHANGE_MAIL: ChangeMail,
  CHANGE_PASSWORD: ChangePassword,
  DELETE_ACCOUNT: DeleteAccount,
  SOCIAL_SETTINGS: SocialSettings,
};

const Stat = ({
  text, value, rank, zero,
}) => (
  <p>
    <span className="stattext">{(rank) ? `${text}: #` : `${text}: `}</span>
    &nbsp;
    <span className="statvalue">{numberToString(value, zero)}</span>
  </p>
);

const UserAreaContent = () => {
  const [area, setArea] = useState('NONE');

  const dispatch = useDispatch();
  const logout = useCallback(async () => {
    const ret = await requestLogOut();
    if (ret) {
      dispatch(logoutUser());
    }
  }, [dispatch]);

  const isDarkMode = useSelector(selectIsDarkMode);
  const [
    name,
    havePassword,
    username,
    avatar,
  ] = useSelector((state) => [
    state.user.name,
    state.user.havePassword,
    state.user.username,
    state.user.avatar,
  ], shallowEqual);
  const [
    totalPixels,
    dailyTotalPixels,
    ranking,
    dailyRanking,
  ] = useSelector((state) => [
    state.ranks.totalPixels,
    state.ranks.dailyTotalPixels,
    state.ranks.ranking,
    state.ranks.dailyRanking,
  ], shallowEqual);

  const Area = AREAS[area];
  const [avatarVersion, setAvatarVersion] = useState(0);
  useEffect(() => {
    if (avatar) setAvatarVersion(Date.now());
  }, [avatar]);

  return (
    <div className="content">
      <UserMessages />
      {(typeof avatar === 'string' && (avatar.startsWith('/avatars/') || avatar.startsWith('http'))) && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 6, paddingBottom: 10 }}>
          <img
            alt="avatar"
            src={`${avatar}?v=${avatarVersion}`}
            style={{
              width: 128,
              height: 128,
              maxWidth: '30vw',
              maxHeight: '30vw',
              borderRadius: '50%',
              objectFit: 'cover',
            }}
          />
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 10 }}>
        <AvatarUpload />
      </div>
      <Stat
        text={t`Today Placed Pixels`}
        value={dailyTotalPixels}
      />
      <Stat
        text={t`Daily Rank`}
        value={dailyRanking}
        zero="N/A"
        rank
      />
      <Stat
        text={t`Placed Pixels`}
        value={totalPixels}
      />
      <Stat
        text={t`Total Rank`}
        value={ranking}
        zero="N/A"
        rank
      />
      <FishList />
      <div>
        <p>
          {t`Your name is:`}<span className="statvalue">{` ${name} `}</span>
          [<span>{` ${username} `}</span>]
        </p>(
        <span
          role="button"
          tabIndex={-1}
          className="modallink"
          onClick={logout}
        > {t`Log out`}</span>
        <span className="hdivider" />
        <span
          role="button"
          tabIndex={-1}
          className="modallink"
          onClick={() => setArea('CHANGE_NAME')}
        > {t`Change Name`}</span>
        <span className="hdivider" />
        {(username.startsWith('pp_')) && (
          <React.Fragment key="choseun">
            <span
              role="button"
              tabIndex={-1}
              style={{
                fontWeight: 'bold',
                color: (isDarkMode) ? '#fcff4b' : '#8f270d',
              }}
              className="modallink"
              onClick={() => setArea('CHANGE_USERNAME')}
            > {t`Choose Username`}</span>
            <span className="hdivider" />
          </React.Fragment>
        )}
        <span
          role="button"
          tabIndex={-1}
          className="modallink"
          onClick={() => setArea('CHANGE_MAIL')}
        > {t`Login Methods`}</span>
        <span className="hdivider" />
        <span
          role="button"
          tabIndex={-1}
          style={(havePassword) ? {} : {
            fontWeight: 'bold',
            color: (isDarkMode) ? '#fcff4b' : '#8f270d',
          }}
          className="modallink"
          onClick={() => setArea('CHANGE_PASSWORD')}
        > {(havePassword) ? t`Change Password` : t`Set Password`}</span>
        <span className="hdivider" />
        <span
          role="button"
          tabIndex={-1}
          className="modallink"
          onClick={() => setArea('DELETE_ACCOUNT')}
        > {t`Delete Account`}</span> )
        <br />(
        <span
          role="button"
          tabIndex={-1}
          className="modallink"
          onClick={() => setArea('SOCIAL_SETTINGS')}
        > {t`Social Settings`}</span> )
      </div>
      {(Area) && <Area key="area" done={() => setArea(null)} />}
    </div>
  );
};

export default React.memo(UserAreaContent);
