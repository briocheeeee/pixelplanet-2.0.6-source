module.exports = {
  root: true,
  env: {
    browser: false,
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  extends: [
    'airbnb-base',
    'airbnb',
  ],
  rules: {},
  overrides: [
    {
      files: ['src/**/*.js', 'src/**/*.jsx'],
      excludedFiles: ['src/core/logger.js'],
      rules: {
        'no-console': 'error',
      },
    },
    {
      files: ['scripts/**/*.js', 'webpack.config.*.js'],
      rules: {
        'no-console': 'off',
      },
    },
  ],
};
