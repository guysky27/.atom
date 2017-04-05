'use babel';

export default {
  config: {
    terraformExecutablePath: {
      title: 'Terraform Executable Path',
      type: 'string',
      description: 'Path to Terraform executable (e.g. /usr/local/terraform/bin/terraform) if not in shell env path.',
      default: 'terraform',
    },
    useTerraformPlan: {
      title: 'Use Terraform Plan',
      description: 'Use \'terraform plan\' instead of \'validate\' for linting (will also display plan errors for directory of current file)',
      type: 'boolean',
      default: false,
    }
  },

  // activate linter
  activate() {
    require('atom-package-deps').install('linter-terraform-syntax');
  },

  provideLinter() {
    return {
      name: 'Terraform',
      grammarScopes: ['source.terraform'],
      scope: 'file',
      lintOnFly: false,
      lint: (activeEditor) => {
        // establish const vars
        const helpers = require('atom-linter');
        const path = require('path');
        const file = activeEditor.getPath();
        // regexps for matching on output
        const regex_syntax = /Error.*\/(.*):\sAt\s(\d+):(\d+):\s(.*)/;
        const correct_file = new RegExp(file);
        const dir_error = /\* (.*)/;
        const regex_warning = /Deprecation warning: (.*)/

        // establish args
        var args = atom.config.get('linter-terraform-syntax.useTerraformPlan') ? ['plan'] : ['validate'];
        args = args.concat(['-no-color', path.dirname(file)]);

        return helpers.exec(atom.config.get('linter-terraform-syntax.terraformExecutablePath'), args, {stream: 'stderr', allowEmptyStderr: true}).then(output => {
          var toReturn = [];
          output.split(/\r?\n/).forEach(function (line) {
            // matchers for output parsing and capturing
            const matches_syntax = regex_syntax.exec(line);
            const matches_file = correct_file.exec(line);
            const matches_dir = dir_error.exec(line);
            const matches_warning = regex_warning.exec(line);

            // check for deprecation warnings
            if (matches_warning != null) {
              toReturn.push({
                type: 'Warning',
                severity: 'warning',
                text: matches_warning[1],
              });
            }

            // check for syntax errors in current file
            if (matches_syntax != null && matches_file != null) {
              toReturn.push({
                type: 'Error',
                severity: 'error',
                text: matches_syntax[4],
                range: [[Number.parseInt(matches_syntax[2]) - 1, Number.parseInt(matches_syntax[3]) - 1], [Number.parseInt(matches_syntax[2]) - 1, Number.parseInt(matches_syntax[3])]],
                filePath: file,
              });
            }
            // check for syntax errors in directory
            else if (matches_syntax != null) {
              toReturn.push({
                type: 'Error',
                severity: 'error',
                text: matches_syntax[4],
                range: [[Number.parseInt(matches_syntax[2]) - 1, Number.parseInt(matches_syntax[3]) - 1], [Number.parseInt(matches_syntax[2]) - 1, Number.parseInt(matches_syntax[3])]],
                filePath: path.dirname(file) + '/' + matches_syntax[1],
              });
            }
            // check for non-syntax errors in directory
            else if (matches_dir != null) {
              toReturn.push({
                type: 'Error',
                severity: 'error',
                text: 'Non-syntax error in directory: ' + matches_dir[1] + '.',
              });
            }
          });
          return toReturn;
        });
      }
    };
  }
};
