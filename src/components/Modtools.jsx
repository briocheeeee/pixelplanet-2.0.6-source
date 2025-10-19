/*
 * Modtools
 */

import React, { useState } from 'react';
import { useSelector } from 'react-redux';

import Canvastools from './ModCanvastools.jsx';
import Admintools from './Admintools.jsx';
import Watchtools from './ModWatchtools.jsx';
import IIDTools from './ModIIDtools.jsx';
import { USERLVL } from '../core/constants.js';


const CONTENT = {
  Canvas: Canvastools,
  Admin: Admintools,
  Watch: Watchtools,
  IID: IIDTools,
};

function Modtools() {
  const [selectedPart, selectPart] = useState('Canvas');

  const userlvl = useSelector((state) => state.user.userlvl);

  const Content = CONTENT[selectedPart];

  const parts = Object.keys(CONTENT)
    .filter((part) => part !== 'Admin' || userlvl >= USERLVL.ADMIN);

  return (
    <>
      <div className="content" style={{ overflowWrap: 'anywhere' }}>
        {parts.map((part, ind) => (
          <React.Fragment key={part}>
            <span
              role="button"
              tabIndex={-1}
              className={
                (selectedPart === part) ? 'modallink selected' : 'modallink'
              }
              onClick={() => selectPart(part)}
            >{part}</span>
            {(ind !== parts.length - 1)
              && <span className="hdivider" />}
          </React.Fragment>
        ))}
        <div className="modaldivider" />
      </div>
      {Content && <Content />}
    </>
  );
}

export default React.memo(Modtools);
