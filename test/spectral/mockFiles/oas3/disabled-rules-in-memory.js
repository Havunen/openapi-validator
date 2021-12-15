const yaml = require('js-yaml');
const fs = require('fs');

module.exports = yaml.load(
  fs.readFileSync('./test/spectral/mockFiles/oas3/disabled-rules.yml', 'utf8')
);
