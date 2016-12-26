#!/usr/bin/env node
require('../server.babel');

const reloader = require('piping')({
  throw: false,
  hook: true,
  respawnOnExit: true,
  ignore: /(\/\.|~$|src\/)/i,
  usePolling: true,
  interval: 1000,
});
if (!reloader) {
  return;
}

const express = require('express');
const webpack = require('webpack');
const webpackConfig = require('../webpack/dev.config.js');
const compiler = webpack(webpackConfig);

const app = express();
app.use(require('webpack-dev-middleware')(compiler, webpackConfig.devServer));
app.use(require('webpack-hot-middleware')(compiler));
app.use('/', express.static('.'));

const server = app.listen(process.env.PORT || 3000, function () {
  console.log(`Dev server listening on port ${server.address().port}`);
});

reloader.on('reload', function (done) {
  server.close(function () {
    if (done) done();
    process.exit();
  });
});
