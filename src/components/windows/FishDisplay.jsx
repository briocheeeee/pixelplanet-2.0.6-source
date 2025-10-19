/*
 * window to display a fish
 */
import React, { useContext } from 'react';
import { t } from 'ttag';

import WindowContext from '../context/window.js';
import { setBrightness, colorFromText } from '../../core/utils.js';
import { FISH_TYPES } from '../../core/constants.js';
import { cdn } from '../../utils/utag.js';

const FishDisplay = () => {
  const { args: { type, size, ts } } = useContext(WindowContext);

  const { name } = FISH_TYPES[type];
  const shortname = name.toLowerCase().split(' ').join('');
  const backgroundColor = setBrightness(colorFromText(shortname), false);

  return (
    <div className="content">
      <p>
        <span
          className="fishdisplay-title"
          style={{
            backgroundColor,
            color: `hsl(${Math.floor(size / 25 * 120)}, 70%, 75%)`,
          }}
        >{name}</span>
      </p>
      <img
        className="fishdisplay-img"
        src={cdn`/phishes/${shortname}.webp`}
        alt={name}
      />
      <p>
        <span className="stattext">{t`Size`}:</span>&nbsp;
        <span className="statvalue">{size}</span>&nbsp;
        <span className="stattext">kg</span>
      </p>
      <p>
        <span className="stattext">{t`Date of catch`}:</span>&nbsp;
        <span className="statvalue">{new Date(ts).toLocaleString()}</span>
      </p>
    </div>
  );
};

export default FishDisplay;
