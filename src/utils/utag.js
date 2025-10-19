/*
 * tagFunctions for template literals that prepends a basename or CDN
 * This is only useful client side
 */

if (!process.env.BROWSER) {
  throw new Error('Only include utag in client code');
}

/*
 * basename needs to be a path like '/ppfun', it shall not end with an '/'
 */
const basename = window.ssv?.basename || '';

/*
 * apiUrl needs to be a url like 'https://pixelplanet.fun', shall not end with
 * an '/'
 */
const apiUrl = window.ssv?.apiUrl || basename;

/*
 * cdnUrl needs to be a url without path like "https://pixelplanet.fun"
 */
const cdnUrl = window.ssv?.cdnUrl || basename;

/**
 * tagFunction to change the path of a URL
 */
export function u(strings, ...values) {
  let result = basename;
  for (let i = 0; i < strings.length; i++) {
    result += strings[i];
    if (i < values.length) {
      result += values[i];
    }
  }
  return result;
}

/**
 * tagFunction to redirect a URL to a CDN
 */
export function cdn(strings, ...values) {
  let result = cdnUrl;
  for (let i = 0; i < strings.length; i++) {
    result += strings[i];
    if (i < values.length) {
      result += values[i];
    }
  }
  return result;
}

/**
 * tagFUnction to redirect to API_URL
 */
export function api(strings, ...values) {
  let result = apiUrl;
  for (let i = 0; i < strings.length; i++) {
    result += strings[i];
    if (i < values.length) {
      result += values[i];
    }
  }
  return result;
}
