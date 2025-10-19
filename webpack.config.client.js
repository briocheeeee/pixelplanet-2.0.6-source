/**
 * webpack config for client files
 */

import fs from 'fs';
import path from 'path';
import process from 'process';
import webpack from 'webpack';
import TerserPlugin from 'terser-webpack-plugin';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import sourceMapping from './scripts/sourceMapping.js';
import LicenseListWebpackPlugin from './scripts/LicenseListWebpackPlugin.cjs';

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, './package.json')),
);

/*
 * make sure we build in root dir
 */
process.chdir(import.meta.dirname);

export default ({
  development,
  analyze,
  locale = 'en',
  extract,
  readonly,
}) => {
  const ttag = {
    resolve: {
      translations: (locale !== 'en')
        ? path.resolve('i18n', `${locale}.po`)
        : 'default',
    },
  };

  if (extract) {
    ttag.extract = {
      output: path.resolve('i18n', 'template.pot'),
    };
  }

  const babelPlugins = [
    ['ttag', ttag],
  ];

  return {
    name: 'client',
    target: 'web',

    mode: (development) ? 'development' : 'production',
    devtool: (development) ? 'source-map' : false,

    entry: {
      client:
        [path.resolve('src', 'client.js')],
      globe:
        [path.resolve('src', 'globe.js')],
      popup:
        [path.resolve('src', 'popup.js')],
    },

    output: {
      path: path.resolve('dist', 'public', 'assets'),
      publicPath: '/assets/',
      // chunkReason is set if it is a split chunk like vendor or three
      filename: (pathData) => (pathData.chunk.chunkReason)
        ? '[name].[chunkhash:8].js'
        : `[name].${locale}.[chunkhash:8].js`,
      chunkFilename: `[name].${locale}.[chunkhash:8].js`,
    },

    resolve: {
      alias: {
        /*
         * have to mock it, because we don't ship ttag itself with the client,
         * we have a script for every language
        */
        ttag: 'ttag/dist/mock',
        /*
         * if we don't do that,we might load different versions of three
         */
        three: path.resolve('node_modules', 'three'),
      },
      extensions: ['.js', '.jsx'],
    },

    module: {
      rules: [
        {
          test: /\.svg$/,
          use: [
            'babel-loader',
            {
              loader: 'react-svg-loader',
              options: {
                svgo: {
                  plugins: [
                    {
                      removeViewBox: false,
                    },
                    {
                      removeDimensions: true,
                    },
                  ],
                },
                jsx: false,
              },
            },
          ],
        },
        {
          test: /\.(js|jsx)$/,
          use: [
            {
              loader: 'babel-loader',
              options: {
                plugins: babelPlugins,
              },
            },
            path.resolve('scripts', 'TtagNonCacheableLoader.js'),
          ],
          include: [
            path.resolve('src'),
            ...['image-q'].map((moduleName) => (
              path.resolve('node_modules', moduleName)
            )),
          ],
        },
      ],
    },

    plugins: [
      // Define free variables
      // https://webpack.github.io/docs/list-of-plugins.html#defineplugin
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': development ? '"development"' : '"production"',
        'process.env.BROWSER': true,
        'process.env.PKG_NAME': `"${pkg.name}"`,
        'process.env.PKG_VERSION': `"${pkg.version}"`,
      }),
      // Output license informations
      new LicenseListWebpackPlugin({
        name: 'Client Scripts',
        htmlFilename: 'index.html',
        outputDir: path.join('..', 'legal'),
        includeLicenseFiles: true,
        override: sourceMapping,
        /*
         * build a second summarized html output,
         * because LibreJS doesn't understand this and we still want it
         * TODO: replace it with the mergeByChunnkName option once LibreJS
         *       supports it
         */
        processOutput: (out) => {
          let secondOut = [...out].map((buildObj) => {
            const newBuildObj = {
              ...buildObj,
              scripts: [],
            }
            buildObj.scripts.forEach((scriptObj) => {
              let targetInd = newBuildObj.scripts.findIndex(
                (s) => s.name === scriptObj.name,
              );
              if (targetInd === -1) {
                newBuildObj.scripts.push({ ...scriptObj, url: null });
              } else {
                newBuildObj.scripts[targetInd] = LicenseListWebpackPlugin
                  .deepMergeNamedArrays(
                    newBuildObj.scripts[targetInd],
                    { ...scriptObj, url: null },
                   );
              }
            });
            return newBuildObj;
          });
          secondOut = LicenseListWebpackPlugin.summarizeOutput(secondOut);
          secondOut = LicenseListWebpackPlugin.generateHTML(secondOut);
          fs.writeFileSync(
            path.resolve('dist', 'public', 'legal', 'summarized.html'),
            secondOut,
          );
          return out;
        },
      }),
      // Webpack Bundle Analyzer
      // https://github.com/th0r/webpack-bundle-analyzer
      ...analyze ? [new BundleAnalyzerPlugin({ analyzerPort: 8889 })] : [],
    ],

    optimization: {
      splitChunks: {
        chunks: 'all',
        name: false,
        cacheGroups: {
          default: false,
          defaultVendors: false,

          /*
           * this layout of chunks is also assumed in src/core/assets.js
           * client -> client.js + vendor.js
           * globe -> globe.js + three.js
           */
          vendor: {
            name: 'vendor',
            chunks: (chunk) => chunk.name.startsWith('client'),
            test: /[\\/]node_modules[\\/]/,
          },
          three: {
            name: 'three',
            chunks: 'all',
            test: /[\\/]node_modules[\\/]three[\\/]/,
          },
        },
      },
      ...(development ? {} : {
        minimizer: [
          new TerserPlugin({
            terserOptions: {
              compress: {
                drop_console: true,
                pure_funcs: [
                  'console.log',
                  'console.info',
                  'console.warn',
                  'console.error',
                  'console.debug',
                ],
              },
              keep_fnames: true,
            },
          }),
        ],
      }),
    },

    recordsPath: path.resolve('records.json'),

    stats: {
      colors: true,
      reasons: false,
      hash: false,
      version: false,
      chunkModules: false,
    },

    cache: {
      type: 'filesystem',
      readonly,
    },
  };
}

