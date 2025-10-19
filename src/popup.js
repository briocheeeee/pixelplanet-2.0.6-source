/*
 * Main Script for windows (pop-ups and stuff)
 */
import { persistStore } from 'redux-persist';

import { parentExists } from './core/utils.js';
import store from './store/storePopUp.js';
import {
  urlChange,
} from './store/actions/index.js';
import {
  fetchMe,
} from './store/actions/thunks.js';
import SocketClient from './socket/SocketClient.js';
import renderAppPopUp from './components/AppPopUp.jsx';

// eslint-disable-next-line
__webpack_public_path__ = `${window.ssv?.basename || ''}/assets/`;

persistStore(store, {}, () => {
  window.addEventListener('message', store.dispatch);

  store.dispatch({ type: 'HYDRATED' });

  window.addEventListener('popstate', () => {
    store.dispatch(urlChange());
  });

  if (!parentExists()) {
    store.dispatch(fetchMe());
    SocketClient.initialize(store);
  }
});

(function load() {
  const onLoad = () => {
    renderAppPopUp(document.getElementById('app'), store);
    document.removeEventListener('DOMContentLoaded', onLoad);
  };
  document.addEventListener('DOMContentLoaded', onLoad, false);
}());
