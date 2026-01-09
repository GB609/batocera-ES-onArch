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

  static _contains = parameterized([
    [[1, 2, 3, 4, 5], 4, true],
    [[1, 2, 3, 4, 5], 34, false],
    [['a', 'B', 'acB'], 'c', false],
    [['a', 'B', 'acB'], 'b', false],
    [['a', 'B', 'acB'], 'a', true],
    [[true, false, "'$something'"], '\\$something', true],
    [[true, false, "'$something'"], false, true]
  ], function(inputVar, searchValue, isContained) {
    this.environment({
      something: 'Should not appear in array',
    });
    this.postActions(`declare -a TEST_VAR=(${inputVar.join(' ')})`);
    this.verifyExitCode(`_contains TEST_VAR '${searchValue}'`, isContained);
    this.execute();
  })

  static _containsKey = parameterized([
    [{ a: false, B: true }, 'a', true],
    [{ a: false, B: true }, 'b', false],
    [{ a: false, B: true }, 'c', false],
    [{ a: false, aBc: true }, 'B', false],
    // key with literal $, $ masked in regex
    [{ '\\$something': 'content' }, '\\$something', true],
    //this resolves $something to key, but masked regex
    [{ '$something': 'content' }, '\\$something', false],
    // $ in search string carries over to regex, leading to an illegal statement '^$something$'
    [{ '\\$something': 'content' }, '$something', false],
    [{ '$something': 'content' }, '$something', false]
  ], function(inputVar, searchValue, isContained) {
    this.environment({
      something: 'Should not appear in array',
    });
    this.postActions(
      'declare -A TEST_VAR',
      ...(Object.keys(inputVar).map(k => `TEST_VAR[${k}]='${inputVar[k]}'`))
    );
    this.verifyExitCode(`_containsKey TEST_VAR '${searchValue}'`, isContained);
    this.execute(true);
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
