const { ShellTestRunner } = require('js/utils/shelltest.mjs');

enableLogfile();

const FILE_UNDER_TEST = 'opt/batocera-emulationstation/lib/generic-utils.lib';

class GenericUtilsTests extends ShellTestRunner {

  beforeEach(ctx) {
    super.beforeEach(ctx);
    this.testFile(FILE_UNDER_TEST);
  }

  static _explode = parameterized([
    [`a b c d`, ['a', 'b', 'c', 'd']],
    [`23 'nospace_but_quoted'`, [23, 'nospace_but_quoted']],
    [`'with blank single' "blanks double"`, ['with blank single', 'blanks double']]
  ], function(input, expected) {
    this.environment({ INPUT: input });
    this.postActions(`_explode RESULT "$INPUT"`);
    this.verifyVariable('RESULT', expected);

    this.execute();
  })

  _join() {
    let testArr = [1, 2, 3, 4, 5, 6];
    let testArgs = testArr.join(' ');
    this.postActions(
      `CONCATTED=$(_join '' ${testArgs})`,
      `COMMA=$(_join , ${testArgs})`,
      `NEWLINE=$(_join $'\\n' ${testArgs})`,
      `MULTICHAR=$(_join mc ${testArgs})`
    );
    this.verifyVariables({
      CONCATTED: testArr.join(''),
      COMMA: testArr.join(','),
      NEWLINE: testArr.join('\n'),
      MULTICHAR: testArr.join('m')
    });
    this.execute();
  }

}

runTestClasses(FILE_UNDER_TEST, GenericUtilsTests)
