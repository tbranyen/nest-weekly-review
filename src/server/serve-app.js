'use strict';

var fs = require('fs');
var filePath = __dirname + '/../../app-production.js';

module.exports = function(req, res) {
  fs.createReadStream(filePath).on('error', function() {
    throw new Error(
      'Unable to read production build of application. Please run `npm run ' +
      'build`.'
    );
  }).pipe(res);
};
