/*
 * draw windows
 */

import React from 'react';
import { useSelector, shallowEqual, useDispatch } from 'react-redux';

import Window from './Window.jsx';
import Overlay from './Overlay.jsx';
import {
  closeFullscreenWindows,
} from '../store/actions/windows.js';
import {
  selectIfFullscreen,
  selectActiveWindowIds,
} from '../store/selectors/windows.js';

const WindowManager = () => {
  const windowIds = useSelector(selectActiveWindowIds, shallowEqual);
  const [
    fullscreenExistOrShowWindows,
    someOpenFullscreen,
  ] = useSelector(selectIfFullscreen, shallowEqual);
  const dispatch = useDispatch();

  if (!fullscreenExistOrShowWindows || !windowIds.length) {
    return null;
  }

  return (
    <div id="wm">
      <Overlay
        show={someOpenFullscreen}
        onClick={() => dispatch(closeFullscreenWindows())}
      />
      {windowIds.map((id) => <Window key={id} id={id} />)}
    </div>
  );
};

export default WindowManager;
