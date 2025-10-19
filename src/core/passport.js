/**
 *
 *
 */

import passport from 'passport';
import GoogleStrategy from 'passport-google-oauth2';
import DiscordStrategy from 'passport-discord';
import FacebookStrategy from 'passport-facebook';
import RedditStrategy from 'passport-reddit/lib/passport-reddit/strategy.js';
import VkontakteStrategy from 'passport-vkontakte/lib/strategy.js';

import { sanitizeName, validateEMail } from '../utils/validation.js';
import logger from './logger.js';
import { USERLVL, THREEPID_PROVIDERS } from '../data/sql/index.js';
import {
  getUserByEmail,
  getUserByTpid,
  getNameThatIsNotTaken,
  createNewUser,
  setUserLvl,
} from '../data/sql/User.js';
import { addOrReplaceTpid } from '../data/sql/ThreePID.js';
import {
  FACEBOOK_APP_ID,
  FACEBOOK_APP_SECRET,
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  VK_CLIENT_ID,
  VK_CLIENT_SECRET,
  REDDIT_CLIENT_ID,
  REDDIT_CLIENT_SECRET,
} from './config.js';


/**
 * OAuth SignIns, either mail or tpid has to be given
 * @param providerString one out of the possible OATUH_PROVIDERS enums
 * @param name name of thid party account
 * @param email email
 * @param tpid id of third party account
 *
 */
export async function oauthLogin(
  providerString, name, email = null, tpid = null,
) {
  name = sanitizeName(name);
  if (email?.length > 40 || validateEMail(email)) {
    email = null;
  }

  const provider = THREEPID_PROVIDERS[providerString];
  if (!provider) {
    throw new Error(`Can not login with ${providerString}`);
  }
  if (!email && !tpid) {
    throw new Error(
      // eslint-disable-next-line max-len
      `${provider} didn't give us enough information to log you in, maybe you don't have an email set in their account?`,
    );
  }

  const promises = [];
  let user;
  // try with associated email
  if (email) {
    user = await getUserByEmail(email);
  }
  // try wwith threepid
  if (!user && tpid) {
    user = await getUserByTpid(provider, tpid);
  }
  // create new user
  if (!user) {
    name = await getNameThatIsNotTaken(name);
    logger.info(
      // eslint-disable-next-line max-len
      `Create new user from ${providerString} oauth login ${email} / ${name} / ${tpid}`,
    );
    user = await createNewUser(name, null);
    if (!user) {
      throw new Error('Could not create user');
    }
  }

  /* reddit doesn't neccessarily require email, so we cant verify that */
  const verified = provider !== THREEPID_PROVIDERS.REDDIT && email;
  if (tpid) {
    promises.push(addOrReplaceTpid(user.id, provider, tpid, verified));
  }
  if (email) {
    promises.push(
      addOrReplaceTpid(user.id, THREEPID_PROVIDERS.EMAIL, email),
    );
  }
  if (verified && user.userlvl === USERLVL.REGISTERED) {
    promises.push(setUserLvl(user.id, USERLVL.VERIFIED));
  }
  await Promise.all(promises);

  /* this is NOT a full user instance, only { id, name, password, userlvl } */
  return user;
}

/**
 * Sign in with Facebook.
 */
passport.use(new FacebookStrategy({
  clientID: FACEBOOK_APP_ID,
  clientSecret: FACEBOOK_APP_SECRET,
  callbackURL: '/api/auth/facebook/return',
  proxy: true,
  profileFields: ['displayName', 'email'],
}, async (req, accessToken, refreshToken, profile, done) => {
  try {
    const { displayName: name, emails, id } = profile;
    const email = emails[0].value;
    const user = await oauthLogin('FACEBOOK', name, email, id);
    done(null, user);
  } catch (err) {
    done(err);
  }
}));

/**
 * Sign in with Discord.
 */
passport.use(new DiscordStrategy({
  clientID: DISCORD_CLIENT_ID,
  clientSecret: DISCORD_CLIENT_SECRET,
  callbackURL: '/api/auth/discord/return',
  proxy: true,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const { id, email, username: name } = profile;
    const user = await oauthLogin('DISCORD', name, email, id);
    done(null, user);
  } catch (err) {
    done(err);
  }
}));

/**
 * Sign in with Google.
 */
passport.use(new GoogleStrategy({
  clientID: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
  callbackURL: '/api/auth/google/return',
  proxy: true,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const { displayName: name, emails, id } = profile;
    const email = emails[0].value;
    const user = await oauthLogin('GOOGLE', name, email, id);
    done(null, user);
  } catch (err) {
    done(err);
  }
}));

/*
 * Sign in with Reddit
 */
passport.use(new RedditStrategy({
  clientID: REDDIT_CLIENT_ID,
  clientSecret: REDDIT_CLIENT_SECRET,
  callbackURL: '/api/auth/reddit/return',
  proxy: true,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const { id } = profile;
    const name = sanitizeName(profile.name);
    // reddit does not give us access to email
    const user = await oauthLogin('REDDIT', name, null, id);
    done(null, user);
  } catch (err) {
    done(err);
  }
}));

/**
 * Sign in with Vkontakte
 */
passport.use(new VkontakteStrategy({
  clientID: VK_CLIENT_ID,
  clientSecret: VK_CLIENT_SECRET,
  callbackURL: '/api/auth/vk/return',
  proxy: true,
  scope: ['email'],
  profileFields: ['displayName', 'email'],
}, async (accessToken, refreshToken, params, profile, done) => {
  try {
    const { displayName: name, id } = profile;
    const { email } = params;
    if (!email) {
      throw new Error(
        // eslint-disable-next-line max-len
        'Sorry, you can not use vk login with an account that does not have a verified email set.',
      );
    }
    const user = await oauthLogin('VK', name, email, id);
    done(null, user);
  } catch (err) {
    done(err);
  }
}));


export default passport;
