// SPDX-FileCopyrightText: 2025 Karsten Teichmann
//
// SPDX-License-Identifier: MIT

const { ShellTestRunner } = require('js/utils/shelltest.mjs');

enableLogfile();

const FILE_UNDER_TEST = 'etc/batocera-paths.conf';

const DEFAULT_ENVS = {
  FS_ROOT: '/',
  CONFIG_ROOT: '/etc/batocera-emulationstation',
  DROPIN_DIR: '/etc/batocera-emulationstation/conf.d',
  BTC_PKG_DIR: '/opt/batocera-emulationstation',
  BTC_BIN_DIR: '/opt/batocera-emulationstation/bin',
  BTC_SYSRES_DIR: '/usr/share/batocera-emulationstation',
  EL_PKG_DIR: '/opt/emulatorlauncher',
  SH_LIB_DIR: '/opt/batocera-emulationstation/lib'
}

const REQUIRED_PATH_PATCHES = {
  FS_ROOT: [Object.keys(DEFAULT_ENVS).slice(1)],
  CONFIG_ROOT: [['DROPIN_DIR'], 'CONFIG_ROOT'],
  BTC_PKG_DIR: [['BTC_BIN_DIR', 'SH_LIB_DIR'], 'BTC_PKG_DIR']
}
/**
 * Some variables are built by adding to another base.
 * When the base is changed, the expectation of the sub-path must adjusted.
 */
function patchPaths(obj, prefix, names, replaceKey) {
  for (let n of names) {
    if (replaceKey) {
      obj[n] = obj[n].replace(obj[replaceKey], prefix)
    } else { obj[n] = prefix + obj[n] }
  }
  return obj;
}

class BatoceraPathsTest extends ShellTestRunner {

  beforeEach(ctx) {
    super.beforeEach(ctx);
    this.testFile(FILE_UNDER_TEST);
    this.environment({
      // shelltest.js initialised the lib dir to default to simplify other tests
      SH_LIB_DIR: '', 
      HOME: process.env.ES_HOME 
    });
  }

  verifyConfigRootFromOutside() {
    this.environment({ CONFIG_ROOT: this.TMP_DIR });
    this.verifyVariable('CONFIG_ROOT', this.TMP_DIR);
    this.execute();
  }

  checkDefaultPathValues() {
    this.environment({ FS_ROOT: '/' });
    this.verifyVariables(DEFAULT_ENVS);
    this.execute();
  }

  static testPathConfigurable = parameterized(
    Object.keys(DEFAULT_ENVS),
    function(varName) {
      this.environment({ FS_ROOT: '/' });

      let expected = Object.assign({}, DEFAULT_ENVS);
      if (REQUIRED_PATH_PATCHES[varName]) {
        expected = patchPaths(expected, '/some/long/test/path', ...REQUIRED_PATH_PATCHES[varName]);
      }

      let testChange = { [varName]: '/some/long/test/path' };

      this.environment(testChange);
      this.verifyVariables(Object.assign(expected, testChange));
      this.execute();
    },
    (dict, fun, varName) => {
      if (!REQUIRED_PATH_PATCHES[varName]) { return varName }

      let str = ` (patches: ${REQUIRED_PATH_PATCHES[varName][0].join(', ')})`;
      return varName + str;
    }
  );

}

runTestClass(BatoceraPathsTest, FILE_UNDER_TEST)