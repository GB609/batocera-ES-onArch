import * as assert from 'node:assert/strict';

let pu = require("./config.libs/path-utils")

class PathUtilsTest {

  isValid() {
    assert.ok(true);
  }

  static testNumbers = parameterized(
    [4, 5, 6, 7, 8, 9],
    function(number) {
      assert.equal(0, number % 2);
    }
  );
}

runTestClass(PathUtilsTest)