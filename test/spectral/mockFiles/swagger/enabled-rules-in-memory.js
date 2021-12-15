const yaml = require('js-yaml');
const fs = require('fs');

module.exports = yaml.load(
  fs.readFileSync('./test/spectral/mockFiles/swagger/enabled-rules.yml', 'utf8')
);
