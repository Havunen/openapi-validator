const yaml = require('js-yaml');
const fs = require('fs');

module.exports = yaml.load(
  fs.readFileSync(
    './test/spectral/mockFiles/swagger/disabled-rules.yml',
    'utf8'
  )
);
