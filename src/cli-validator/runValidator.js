#!/usr/bin/env node
const util          = require('util');
const fs            = require('fs');
const readYaml      = require('js-yaml');
const last          = require('lodash/last');
const SwaggerParser = require('swagger-parser');
const chalkPackage  = require('chalk');
const jsonValidator = require('json-dup-key-validator');
const globby        = require('globby');

const ext = require('./utils/fileExtensionValidator');
const config = require('./utils/processConfiguration');
const handleCircularReferences = require('./utils/handleCircularReferences');
const validator = require('./utils/validator');
const print = require('./utils/printResults');

// get the api schema to perform structural validation against
const apiSchema = require(__dirname + '/../plugins/validation/apis/schema').default;

// import the init module for creating a .validaterc file
const init = require('./utils/init.js');

// this function processes the input, does the error handling,
//  and acts as the main function for the program
const processInput = async function (program) {

  let args = program.args;

  // require that arguments are passed in
  if (args.length === 0) {
    program.help();
    return Promise.reject(2);
  }

  // interpret the options
  const printValidators = !! program.print_validator_modules;
  const reportingStats = !! program.report_statistics;
  
  const turnOffColoring = !! program.no_colors;
  const defaultMode = !! program.default_mode;

  // turn on coloring by default
  let colors = true;

  if (turnOffColoring) {
    colors = false;
  }

  const chalk = new chalkPackage.constructor({enabled: colors});

  // if the 'init' command is given, run the module
  // and exit the program
  if (args[0] === 'init') {
    try {
      await init(chalk);
      return Promise.resolve(0);
    } catch (err) {
      return Promise.reject(2);
    }
  }

  // otherwise, run the validator on the passed in files
  // first, process the given files to handle bad input
  const supportedFileTypes = ['json', 'yml', 'yaml'];
  const properExtensions = [];
  let unsupportedExtensionsFound = false;
  args.forEach(match => {
    const filename = last(match.split('/'));
    if (ext.supportedFileExtension(filename, supportedFileTypes)) {
      properExtensions.push(match);
    } else {
      if (!unsupportedExtensionsFound) console.log();
      unsupportedExtensionsFound = true;
      console.log(
        chalk.yellow('Warning') + 
        ` Skipping file with unsupported file type: ${filename}`
      );
    }
  });

  if (unsupportedExtensionsFound) {
    console.log(
      chalk.magenta(
        'Supported file types are JSON (.json) and YAML (.yml, .yaml)\n'
      )
    );
  }

  // globby looks in the file system and matches existing 
  // files with the names in properExtensions
  const filesToValidate = await globby(properExtensions);
  const nonExistentFiles = properExtensions.filter(
    file => !filesToValidate.includes(file)
  );
  if (nonExistentFiles.length) console.log();
  nonExistentFiles.forEach(file => {
    console.log(
      chalk.yellow('Warning') + 
      ` Skipping non-existent file: ${file}`
    );
  });

  // if no passed in files are valid, exit the program
  if (filesToValidate.length === 0) {
    console.log(
      '\n' + chalk.red('Error') + 
      ' None of the given arguments are valid files.\n'
    );
    return Promise.reject(2);
  }

  // process the config file for the validations
  let configObject;
  try {
    configObject = await config(defaultMode, chalk);
  } catch (err) {
    return Promise.reject(err);
  }

  // define an exit code to return. this will tell the parent program whether
  // the validator passed or not
  let exitCode = 0;

  // fs module does not return promises by default
  // create a version of the 'readFile' function that does
  const readFile = util.promisify(fs.readFile);
  let originalFile;
  let input;

  for (let validFile of filesToValidate) {
    if (filesToValidate.length > 1) {
      console.log(
        '\n    ' + chalk.underline(`Validation Results for ${validFile}:`)
      );
    }
    try {
      originalFile = await readFile(validFile, 'utf8');

      const fileExtension = ext.getFileExtension(validFile);
      if (fileExtension === 'json') {
        input = JSON.parse(originalFile);
      }
      else if (fileExtension === 'yaml' || fileExtension === "yml") {
        input = readYaml.safeLoad(originalFile);
      }

      if (typeof input !== 'object') {
        throw `The given input in ${validFile} is not a valid object.`;
      }

      // jsonValidator looks through the originalFile string for duplicate JSON keys
      //   this is checked for by default in readYaml
      let duplicateKeysError = jsonValidator.validate(originalFile)
      if (fileExtension === 'json' && duplicateKeysError) {
        throw duplicateKeysError;
      }
    }
    catch (err) {
      console.log(
        '\n' + chalk.red('Error') + 
        ' Invalid input file: ' + chalk.red(validFile) + 
        '. See below for details.\n'
      );
      console.log(chalk.magenta(err) + '\n');
      exitCode = 1;
      continue;
    }

    // initialize an object to be passed through all the validators
    const swagger = {};

    // the structural validation expects a `settings` object
    //  describing which schemas to validate against
    swagger.settings = {
      schemas: [apiSchema],
      testSchema: apiSchema
    };

    // ### all validations expect an object with three properties: ###
    // ###          jsSpec, resolvedSpec, and specStr              ###

    // formatting the JSON string with indentations is necessary for the 
    //   validations that use it with regular expressions (e.g. refs.js)
    const indentationSpaces = 2;

    swagger.specStr = JSON.stringify(input, null, indentationSpaces);
    
    // deep copy input to a jsSpec by parsing the spec string.
    // just setting it equal to 'input' and then calling 'dereference'
    //   replaces 'input' with the dereferenced object, which is bad
    swagger.jsSpec = JSON.parse(swagger.specStr);

    // dereference() resolves all references. it esentially returns the resolvedSpec,
    //   but without the $$ref tags (which are not used in the validations)
    let parser = new SwaggerParser();
    parser.dereference.circular = false;
    swagger.resolvedSpec = await parser.dereference(input);

    if (parser.$refs.circular) {
      // there are circular references, find them and return an error
      handleCircularReferences(swagger.jsSpec, originalFile, chalk);
      exitCode = 1;
      continue;
    }

    // run validator, print the results, and determine if validator passed
    const results = validator(swagger, configObject);
    if (!results.cleanSwagger) {
      print(results, chalk, printValidators, reportingStats, originalFile);
      exitCode = 1;
    } else {
      console.log(chalk.green(`\n${validFile} passed the validator`));
      if (validFile === last(filesToValidate)) console.log();
    }
  }

  return exitCode;
}

// this exports the entire program so it can be used or tested
module.exports = processInput;
