import { t } from 'ttag';

import Help from './Help.jsx';
import Settings from './Settings.jsx';
import UserArea from './UserArea.jsx';
import Register from './Register.jsx';
import CanvasSelect from './CanvasSelect.jsx';
import Archive from './Archive.jsx';
import Chat from './Chat.jsx';
import Player from './Player.jsx';
import FishDisplay from './FishDisplay.jsx';
import ForgotPassword from './ForgotPassword.jsx';
import UserProfile from './UserProfile.jsx';
import FactionProfile from './FactionProfile.jsx';

export default {
  HELP: [Help, t`Help`],
  SETTINGS: [Settings, t`Settings`],
  USERAREA: [UserArea, t`User Area`],
  REGISTER: [Register, t`Registration`],
  FORGOT_PASSWORD: [ForgotPassword, t`Forgot Password`],
  CHAT: [Chat, t`Chat`],
  CANVAS_SELECTION: [CanvasSelect, t`Canvas Selection`],
  ARCHIVE: [Archive, t`Canvas Archive`],
  PLAYER: [Player, t`Player`],
  FISH_DISPLAY: [FishDisplay, t`Fish Display`],
  USER_PROFILE: [UserProfile, t`User Profile`],
  FACTION_PROFILE: [FactionProfile, t`Faction Profile`],
  /* other windows */
};

/*
 * NOTE:
 * set windows that should be accessible via popup / url
 * also in ../../core/constants.js
 */
