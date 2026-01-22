// SPDX-FileCopyrightText: 2025 Karsten Teichmann
//
// SPDX-License-Identifier: MIT

const { ShellTestRunner } = require('js/utils/shelltest.mjs');

enableLogfile();

const FILE_UNDER_TEST = 'opt/batocera-emulationstation/support/os-menu'

const BTC_CONFIG_ROOT = process.env.TEST_FS + '/configs'
const BTC_BIN_DIR = process.env.TEST_FS + "/btcDir/bin";

process.env.BTC_BIN_DIR = BTC_BIN_DIR;
process.env.BTC_CONFIG_ROOT = BTC_CONFIG_ROOT;
process.env.DROPIN_PATH = BTC_CONFIG_ROOT + '/dropins';

class MenuTest extends ShellTestRunner {

  beforeEach(ctx) {
    super.beforeEach(ctx);
    this.testFile(FILE_UNDER_TEST);
    this.environment({
      PATH: `${SRC_PATH}/support:${process.env.PATH}`
    })
  }

  showForNoArgs() {
    this.verifyFunction('show')
    this.verifyVariable('ACTION', 'show');
    this.execute();
  }

  defaultMenu() {
    let expected = [
      '^sep(Y: Show Controller mapping)',
      'Change user,systemctl exit',
      'Shut down,systemctl poweroff',
      'Guide: Power Menu,^root(shutdown)',
      '^tag(shutdown)',
      'Close EmulationStation,pkill emulationstation',
      'Lock screen',
      'Standby',
      'Change user,systemctl exit',
      'Restart,systemctl reboot'
    ];
    this.verifyFunction('openMenu', ...expected);
    this.execute();
  }

  showImages() {
    this.verifyFunction('pkill', 'jgmenu');
    this.verifyFunction('feh', '-^', 'Controller Mapping');

    this.testArgs = ['showImages'];
    this.execute();
  }

  hideImages() {
    this.verifyFunction('pgrep', { out: 4563 })
    this.verifyFunction('os-menu');
    this.verifyFunction('pkill', 'feh');

    this.testArgs = ['showImages'];
    this.execute();
  }

  shutdownMenuShortcut() {
    this.verifyFunction('pgrep', { out: 4563 }, 'jgmenu');
    this.verifyFunction('show')
    this.verifyVariable('_PRE_SELECT', 'shutdown');

    this.testArgs = ['shutdown'];
    this.execute();
  }

  shutdownMenuNotOpen() {
    this.verifyFunction('pgrep', { out: '' }, 'jgmenu');
    this.verifyFunction('show')
    this.verifyVariable('_PRE_SELECT', '');

    this.testArgs = ['shutdown'];
    this.execute();
  }

  openMenu() {
    let menuItems = [1, 2, 3, 4]
    this.verifyFunction('printf', { out: menuItems.join('\n') }, '%s\\n', 1, 2, 3, 4)
    this.verifyFunction('jgmenu', '--vsimple', '--center', '--checkout=some-tag');
    this.environment({ _PRE_SELECT: 'some-tag' })

    this.testArgs = [':'];
    this.postActions(`openMenu ${menuItems.join(' ')}`);
    this.execute()
  }
}

runTestClass(MenuTest, FILE_UNDER_TEST);