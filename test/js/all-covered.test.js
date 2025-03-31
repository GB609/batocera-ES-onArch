const { resolve } = require('path');
const { execSync } = require('node:child_process');

// require each file once to get it added to coverage

let searchPath = resolve(`${SRC_PATH}`);
console.log("Searching source files for coverage in path:", searchPath);
let found = execSync(`find '${searchPath}' -name '*.js'`, { encoding: 'utf8' });
found.trim().split('\n').forEach(file => {
  console.log("Loading", file);
  require(file);
});