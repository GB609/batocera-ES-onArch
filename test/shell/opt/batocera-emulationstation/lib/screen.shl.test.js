// SPDX-FileCopyrightText: 2026 Karsten Teichmann
//
// SPDX-License-Identifier: MIT

const { ShellTestRunner } = require('js/utils/shelltest.mjs');

enableLogfile();

const FILE_UNDER_TEST = 'opt/batocera-emulationstation/lib/screen.shl';

const XRANDR_OUTPUT =
`Screen 0: minimum 320 x 200, current 3840 x 1200, maximum 16384 x 16384
DisplayPort-0 connected primary 1920x1200+0+0 (normal left inverted right x axis y axis) 518mm x 324mm
   1920x1200     59.95*+
   1920x1080     60.00    50.00    59.94  
   1680x1050     59.95  
HDMI-A-0 connected 800x600+1920+0 (normal left inverted right x axis y axis) 518mm x 324mm
   1920x1200     59.95*+
   1920x1080     60.00    50.00    59.94  
   1680x1050     59.88  
`;

class ScreenHelperTests extends ShellTestRunner {

  beforeEach(ctx) {
    super.beforeEach(ctx);
    this.testFile(FILE_UNDER_TEST);
    this.postActions(`source "$SH_LIB_DIR"/generic-utils.shl`);
    this.verifyFunction('xrandr', { out: XRANDR_OUTPUT });
  }

  screen_MONITORS_initialised() {
    this.verifyVariable('screen_MONITORS', [
      'DisplayPort-0 1920 1200 0 0',
      'HDMI-A-0 800 600 1920 0'
    ]);
    this.execute();
  }

  static positionWindow = parameterized([
    ['fullscreen', '1920x1200+0+0'], // primary monitor
    ['1 fullscreen', '800x600+1920+0'],
    // various complex size calculations
    ['--size 50%', '960x600+0+0'],
    ['--size 400', '400x400+0+0'],
    ['--size 50%x-', '960x1200+0+0'],
    ['1 --size 10%x20%', '80x120+1920+0'],
    ['--size 300x25%', '300x300+0+0'],
    // various sizes with positional keywords, sometimes mixing in screen 1 as target
    ['--size 200 center', '200x200+860+500'],
    ['1 --size 200x200 center', '200x200+2220+200'],
    ['--size 200x200 top', '200x200+0+0'],
    ['--size 200x200 bottom', '200x200+0+1000'],
    ['1 --size 200 left', '200x200+1920+0'],
    ['--size 200x200 right', '200x200+1720+0'],
    // offset of screen 1 + offset to align right at that screen
    ['1 --size 200x200 right', '200x200+2520+0'],
    // the most interesting case: use `dimension`s for positioning
    ['--size 100 --pos 10%', '100x100+192+120'],
    ['1 --size 100 --pos 10%', '100x100+2000+60'],
    ['--size 50 --pos 10%x20%', '50x50+192+240'],
    ['1 --size 50 --pos -x10%', '50x50+1920+60'],
    ['--size 100 --pos 10%x100', '100x100+192+100'],
    ['1 --size 100 --pos 100x10%', '100x100+2020+60']
  ], function(args, expected) {
    this.postActions(`RESULT=$(screen:positionWindow ${args})`);
    this.verifyVariable('RESULT', expected);
    this.execute();
  })

  static isGeoString = parameterized([
    ['10x10+34+55', true],
    ['10x10-34+55', false],
    ['10x+34+55', false],
    ['10x10+0+0', true],
    ['10x90x55+55', false]
  ], function(str, isGeo) {
    this.verifyExitCode(`screen#isGeoString '${str}'`, isGeo);
    this.execute();
  })

  screenToPosInfo() {
    this.postActions(`
      declare -A TEST_ASSOC
      screen#createPosInfo TEST_ASSOC "\${screen_MONITORS[0]}"
    `);
    this.verifyVariable('TEST_ASSOC', { x: 1920, y: 1200, ox: 0, oy: 0, geo: '1920x1200+0+0' });
    this.execute();
  }

}

runTestClasses(FILE_UNDER_TEST, ScreenHelperTests)
