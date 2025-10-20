/**
 *
 */

import React, {
  Suspense, useCallback, useContext, useEffect,
} from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { t } from 'ttag';

import { fetchStats, fetchProfile } from '../../store/actions/thunks.js';
import WindowContext from '../context/window.js';
import useInterval from '../hooks/interval.js';
import LogInArea from '../LogInArea.jsx';
import Tabs from '../Tabs.jsx';
import UserAreaContent from '../UserAreaContent.jsx';
import { USERLVL } from '../../core/constants.js';

// eslint-disable-next-line max-len
const Rankings = React.lazy(() => import(/* webpackChunkName: "stats" */ '../Rankings.jsx'));
// eslint-disable-next-line max-len
const Converter = React.lazy(() => import(/* webpackChunkName: "converter" */ '../Converter.jsx'));
// eslint-disable-next-line max-len
const Modtools = React.lazy(() => import(/* webpackChunkName: "modtools" */ '../Modtools.jsx'));
// eslint-disable-next-line max-len
const Factions = React.lazy(() => import(/* webpackChunkName: "factions" */ '../Factions.jsx'));

const UserArea = () => {
  const id = useSelector((state) => state.user.id);
  const userlvl = useSelector((state) => state.user.userlvl);
  const lastStatsFetch = useSelector((state) => state.ranks.lastFetch);
  const lastProfileFetch = useSelector((state) => state.profile.lastFetch);

  const {
    args,
    setArgs,
    setTitle,
  } = useContext(WindowContext);
  const {
    activeTab = t`Profile`,
  } = args;
  const dispatch = useDispatch();

  const setActiveTab = useCallback((label) => {
    setArgs({
      activeTab: label,
    });
    setTitle(label);
  }, [setArgs, setTitle]);

  useInterval(() => {
    if (Date.now() - 300000 > lastStatsFetch) {
      dispatch(fetchStats());
    }
  }, 300000);

  useEffect(() => {
    if (Date.now() - 60000 > lastStatsFetch) {
      dispatch(fetchStats());
    }
  }, [lastStatsFetch, dispatch]);

  useEffect(() => {
    if (id && Date.now() - 600000 > lastProfileFetch) {
      dispatch(fetchProfile());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastProfileFetch, id]);


  return (
    <div style={{ textAlign: 'center' }}>
      <Tabs activeTab={activeTab} setActiveTab={setActiveTab}>
        <div label={t`Profile`}>
          {(id) ? <UserAreaContent /> : <LogInArea />}
        </div>
        <div label={t`Statistics`}>
          <Suspense fallback={<div>Loading...</div>}>
            <Rankings />
          </Suspense>
        </div>
        <div label={t`Factions`}>
          <Suspense fallback={<div>Loading...</div>}>
            <Factions />
          </Suspense>
        </div>
        <div label={t`Converter`}>
          <Suspense fallback={<div>Loading...</div>}>
            <Converter />
          </Suspense>
        </div>
        {(userlvl >= USERLVL.MOD) && (
        <div label={(userlvl >= USERLVL.ADMIN) ? t`Admintools` : t`Modtools`}>
          <Suspense fallback={<div>{t`Loading...`}</div>}>
            <Modtools />
          </Suspense>
        </div>
        )}
      </Tabs>
      <br />
      {t`Consider joining us on Guilded:`}&nbsp;
      <a href="./guilded" target="_blank">{t`Invited to Chat`}</a>
      <br />
    </div>
  );
};

export default React.memo(UserArea);
