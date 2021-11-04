const { program } = require('./modified-commander');
const { runCli } = require('./cli-runner');

// set up the command line options
/* prettier-ignore */
program
  .name('lint-openapi')
  .description('Run the validator on a specified file')
  .arguments('[<file>]')
  .option();

program.parse(process.argv);

await runCli(program)
  .then(exitCode => {
    process.exitCode = exitCode;
    return exitCode;
  })
  .catch(err => {
    // if err is 2, it is because the message was caught
    // and printed already
    if (err !== 2) {
      console.log(err);
    }
    process.exitCode = 2;
    return 2;
  });

//
// exitCode/err guide:
//
// exitCode
// 0: the validator finished and passed with no errors/warnings
// 1: the validator finished but there were errors or warnings
//    in the Swagger file
//
// err
// 2: the program encountered an error that prevented
//    the validator from running on all the files
