#!/usr/bin/node

const fs = require('node:fs');
const { basename, dirname, resolve, normalize, relative } = require('node:path');

const rootFile = resolve(process.argv[2]);

const parsedRequires = {}

function equalize(root, currentDir, path) {
  let abs = normalize(resolve(currentDir, path));
  return relative(root, abs);
}

const PATTERN_REQUIRE = /require\(["'](.*)["']\)/
const PATTERN_COMMENT = /^\s*(\/\/|\/\*|\*|.*\*\/)/
async function getRequires(file, rootDir) {
  console.error("Parsing", file)
  const currentDir = dirname(file);
  const currentFile = basename(file);

  let source = fs.readFileSync(file, { encoding: 'utf8' }).split('\n');

  let deps = [];
  let replaces = {};
  for (let i = 0; i < source.length; i++) {
    let line = source[i];
    let match = PATTERN_REQUIRE.exec(line);
    if (match != null) {
      let rootRel = equalize(rootDir, currentDir, match[1]);

      let fullFile = `${rootDir}/${rootRel}`;
      let exists = fs.existsSync(fullFile);
      if (exists && !parsedRequires[rootRel]) {
        console.error("found require():", match[1]);

        let wait = { [rootRel]: getRequires(fullFile, rootDir) };
        Object.assign(parsedRequires, wait)
      }

      if (exists) {
        deps.push({ [rootRel]: parsedRequires[rootRel] })
        replaces[match[1]] = rootRel;
        let replaceText = `requireLocal('${rootRel}')`;
        console.error("replace", match[0], "by", replaceText);
        source[i] = line.replace(match[0], replaceText);
      }
    }
  }

  return Promise.allSettled(Object.values(deps)).then(done => {
    let currentRel = equalize(rootDir, currentDir, file);
    console.error(currentRel, "DONE waiting for", Object.values(deps).map(v => Object.keys(v)[0]));
    let spec = {
      raw: source.filter(
        line => line.trim().length > 0 && !line.startsWith('#') && !PATTERN_COMMENT.test(line)
      ),
      get wrapped() {
        return `function(){
  let module = {};
  ${this.raw.join('\n  ')}
  return module.exports;
}`
      }
    }
    parsedRequires[currentRel] = spec;
  });
}

getRequires(rootFile, dirname(rootFile)).then(result => {
  let output = [
    '#!/usr/bin/node',
    `_MODULES = {}
function requireLocal(path){
  if(typeof _MODULES[path] == 'function' && _MODULES[path].unresolved){ _MODULES[path] = _MODULES[path]() }
  if(typeof _MODULES[path] != 'undefined'){ return _MODULES[path] }
  return require(path);
}`];

  Object.entries(parsedRequires).forEach(([name, source]) => {
    if (name == basename(rootFile)) { return }
    output.push(`
_MODULES['${name}'] = ${source.wrapped};
_MODULES['${name}'].unresolved = true;`);
  });

  output.push(...parsedRequires[basename(rootFile)].raw);

  fs.writeFileSync('./tmp/bundle.js', output.join('\n'), { encoding: 'utf8' });
});

//console.log(parsedRequires)