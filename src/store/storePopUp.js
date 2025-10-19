/*
 * redux store for popups
 */

/* eslint-disable no-console */

import {
  applyMiddleware, createStore, combineReducers,
} from 'redux';
import { thunk } from 'redux-thunk';

/*
 * reducers
 */
import sharedReducers from './sharedReducers.js';
import popup from './reducers/popup.js';

/*
 * middleware
 */
import parent from './middleware/parent.js';
import socketClientHook from './middleware/socketClientHookPopUp.js';
import title from './middleware/titlePopUp.js';

const reducers = combineReducers({
  ...sharedReducers,
  popup,
});

const store = createStore(
  reducers,
  applyMiddleware(
    thunk,
    parent,
    socketClientHook,
    title,
  ),
);

/*
 * persistStore of redux-persist is called in popup.js
 */

export default store;
