const chalk = require('chalk');
const { Spectral } = require('@stoplight/spectral-core');

const buildSwaggerObject = require('../cli-validator/utils/build-swagger-object');
const config = require('../cli-validator/utils/process-configuration');
const dedupFunction = require('../cli-validator/utils/no-deduplication');
const {
  formatResultsAsObject
} = require('../cli-validator/utils/json-results');
const spectralValidator = require('../spectral/spectral-validator');
const validator = require('../cli-validator/utils/validator');

module.exports = async function(
  input,
  defaultMode = false,
  configFileOverride = null
) {
  // process the config file for the validations &
  // create an instance of spectral & load the spectral ruleset, either a user's
  // or the default ruleset
  let configObject;
  let spectralResults;
  const spectral = new Spectral();
  spectral._computeFingerprint = dedupFunction;

  try {
    configObject = await config.get(defaultMode, chalk, configFileOverride);
    await spectralValidator.setup(spectral, null, configObject);
  } catch (err) {
    return Promise.reject(err);
  }

  const swagger = await buildSwaggerObject(input);

  try {
    spectralResults = await spectral.run(input);
  } catch (err) {
    return Promise.reject(err);
  }
  const results = validator(swagger, configObject, spectralResults);

  // return a json object containing the errors/warnings
  return formatResultsAsObject(results);
};
