/**
 * @file
 * @brief This test verifies the correctness of `btc-config convert`.
 */

enableLogfile();

const parsing = require('io/parsers');
const writing = require('io/writers');

const TEST_RESOURCE_ROOT = ROOT_PATH + "/test/resource/fs_root";
const CONFIG_ROOT = TEST_RESOURCE_ROOT + '/configs'
const BTC_BIN_DIR = TEST_RESOURCE_ROOT + "/btcDir/bin";

process.env.BTC_BIN_DIR = BTC_BIN_DIR;
process.env.CONFIG_ROOT = CONFIG_ROOT;

//need import to get function defined on API into globalThis
require('btc-config');
const { ProcessOutput } = new require('js/utils/output-capturing');

const OUTPUT_TYPES = writing.FORMATS.REGULAR;
const UNPARSEABLE = ['plain', 'sh'];
const WRITE_TO_PARSE = {
  settings: 'cfg'
}

const CONVERTABLE_TYPES = OUTPUT_TYPES
  .filter(e => !UNPARSEABLE.includes(e))
  .map(e => [e, WRITE_TO_PARSE[e] || e]);

const assertLax = require('node:assert');
/**
 * Run the conversion test of sourceFile to `targetWriteFormat`:  
 * File will be converted and the output is parsed by in, then compared against the original.  
 * They must be identical.  
 * `parseFormat`: in some situations, the parser type/name for a format is different from the input writer format name.
 */
function assertConversion(sourceFile, targetWriteFormat, parseFormat) {
  let result = ProcessOutput.captureFor(() => API.convert(sourceFile, '--to', targetWriteFormat));
  let written = result.out.writtenToHandle;

  let backParsed = sanitizeDataObject(parsing.parseDict(written, parseFormat));
  let expected = sanitizeDataObject(parsing.parseDict(sourceFile));
  // use none-strict because some parsers/writers transport additional value type information
  // which gets lost in some translations.
  // This mostly concerns settings/cfg as source, which might enforce string type for numbers.
  // so, when data from settings is written to another format, the type is as coming from settings,
  // BUT when re-parsing the written file, the values are re-parsed with `handleValue`, which always
  // tries to find the real type of a value, so stringified numbers like '0', will be transformed back into numbers
  assertLax.deepEqual(backParsed, expected);
}

class PropConvTests {
  static INPUT_FILE_CONF = CONFIG_ROOT + '/system.conf';
  static INPUT_FILE_CFG = CONFIG_ROOT + '/dropins/properties/01-test-overrides.cfg';

  static convertConf = parameterized(
    CONVERTABLE_TYPES,
    function(writeFormat, parseFormat) {
      assertConversion(PropConvTests.INPUT_FILE_CONF, writeFormat, parseFormat);
    }
  );

  static convertCfg = parameterized(
    CONVERTABLE_TYPES,
    function(writeFormat, parseFormat) {
      assertConversion(PropConvTests.INPUT_FILE_CFG, writeFormat, parseFormat);
    }
  );
}

runTestClass(PropConvTests)