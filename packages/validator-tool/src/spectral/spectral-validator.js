const {
  getRuleset
} = require('@stoplight/spectral-cli/dist/services/linter/utils/getRuleset');
const ibmRuleset = require('@dpopp07/test-ibm-oas-ruleset');
const MessageCarrier = require('../plugins/utils/message-carrier');
// const config = require('../../cli-validator/utils/processConfiguration');

const parseResults = function(results, debug) {
  const messages = new MessageCarrier();

  if (results) {
    for (const validationResult of results) {
      if (validationResult) {
        const code = validationResult['code'];
        const severity = validationResult['severity'];
        const message = validationResult['message'];
        const path = validationResult['path'];

        if (code === 'parser') {
          // Spectral doesn't allow disabling parser rules, so don't include them
          // in the output (for now)
          continue;
        }

        if (typeof severity === 'number' && code && message && path) {
          if (severity === 0) {
            // error
            messages.addMessage(path, message, 'error', code);
          } else if (severity === 1) {
            // warning
            messages.addMessage(path, message, 'warning', code);
          } else if (severity === 2) {
            // info
            messages.addMessage(path, message, 'info', code);
          } else if (severity === 3) {
            // hint
            messages.addMessage(path, message, 'hint', code);
          }
        } else {
          if (debug) {
            console.log(
              'There was an error while parsing the spectral results: ',
              JSON.stringify(validationResult)
            );
          }
        }
      }
    }
  }
  return messages;
};

// setup: registers the oas2/oas3 formats, and attempts to load the ruleset file

// !!! spectal is the instance of our own spectral validator object
// !!! rulesetFileOverride is a string - the path to a ruleset as given by an argument
// !!! configObject is the whole config object

// const setup = async function(spectral, rulesetFileOverride, configObject) {
const setup = async function(spectral, rulesetFileOverride) {
  if (!spectral) {
    const message =
      'Error (spectral-validator): An instance of spectral has not been initialized.';
    return Promise.reject(message);
  }

  let userRuleset;
  try {
    userRuleset = await getRuleset(rulesetFileOverride);
  } catch (e) {
    // do nothing - the user doesn't have to specify a ruleset because we have a default
    // !!! probably need a good warning here to let people know that the default ruleset is being used
    // could base our warning off of the console statement too
    // console.log(e);
  }

  if (userRuleset) {
    // console.log('Using user ruleset!'); // !!!
    spectral.setRuleset(userRuleset);
  } else {
    // console.log('Using default ruleset!'); // !!!
    spectral.setRuleset(ibmRuleset);
  }

  // !!! is it possible to pull in validaterc spectral rules and use them?
  // not sure how that would work - it may be different now
  // Combine default/user ruleset with the validaterc spectral rules
  // The validaterc rules will take precendence in the case of duplicate rules
  // const userRules = Object.assign({}, spectral.rules); // Clone rules
  // try {
  //   return await spectral.setRules(
  //     mergeRules(userRules, configObject.spectral.rules)
  //   );
  // } catch (err) {
  //   return Promise.reject(err);
  // }
};

module.exports = {
  parseResults,
  setup
};
