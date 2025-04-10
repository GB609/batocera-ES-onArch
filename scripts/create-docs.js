#!/usr/bin/node

const { resolve, basename } = require('path');
const fs = require('node:fs');
const exec = require('node:child_process').execSync;
const execAsync = require('node:child_process').exec;

const UTF8 = { encoding: 'utf8' };
const WORKSPACE_ROOT = fs.realpathSync(__dirname + "/..");
const TMP_DIR = `${WORKSPACE_ROOT}/tmp`

class DocNode {
  textLines = []
  children = []

  constructor(title, text) {
    this.title = title;
    if (!Array.isArray(text)) { text = [text] }
    this.addText(text);
  }
  addText(lines) { return this.textLines.push(...lines), this; }
  addChildNode(title, text) {
    let child = new DocNode(title, text);
    return this.children.push(child), child;
  }

}

function processJsFiles() {
  let candidates = exec(`find '${WORKSPACE_ROOT}/sources/fs-root' -name '*.js'`, UTF8).trim().split('\n');
  console.log("found", candidates)
}

function processShellScripts() {
  let candidatesWithExtension = exec(`find '${WORKSPACE_ROOT}/sources/fs-root' -name '*.sh'`, UTF8).trim().split('\n');
  let executableCandidates = exec(`find '${WORKSPACE_ROOT}/sources/fs-root' -type f -executable`, UTF8).trim().split('\n');

  let foundFiles = {}
  for (let c of candidatesWithExtension) { foundFiles[c] = true }

  for (let c of executableCandidates) {
    if (exec(`file '${c}'`, UTF8).includes('shell script')) { foundFiles[c] = true }
  }
  foundFiles[`${WORKSPACE_ROOT}/sources/fs-root/opt/batocera-emulationstation/common-paths.lib`] = "common-paths"

  let shdocBin = `${WORKSPACE_ROOT}/tmp/shdoc`;
  if (!fs.existsSync(shdocBin)) {
    exec(`curl -o '${shdocBin}' https://raw.githubusercontent.com/reconquest/shdoc/refs/heads/master/shdoc`, UTF8);
    exec(`chmod +x ${shdocBin}`, UTF8);
  }

  let userManualDir = `${TMP_DIR}/docs/user/files`;
  fs.mkdirSync(userManualDir, { recursive: true });
  console.log("found: *.sh", Object.keys(foundFiles))
  for (let file of Object.keys(foundFiles)) {
    if (!file.endsWith('.sh')) {
      let mdFileName = typeof foundFiles[file] == "string" ? foundFiles[file] : basename(file);
      let targetPath = `${userManualDir}/${mdFileName}.md`;
      console.log("Generating", targetPath, "from", file)
      let binaryHelp = exec(`[ -x "${file}" ] && "${file}" --help || exit 0`, UTF8)
      if (binaryHelp.trim().length > 0){
        binaryHelp = [
          '```',
          binaryHelp,
          '```',
        ]
      } else {
        binaryHelp = []
      }
      fs.writeFileSync(targetPath, [
        ...binaryHelp,
        exec(`cat '${file}' | ${shdocBin}`, UTF8)
      ].join('\n'), UTF8)
    }
  }

}

function updateIndexFiles(){
  let indexFile = `${TMP_DIR}/docs/index.md`
  exec(`cp ${WORKSPACE_ROOT}/docs/index.md ${TMP_DIR}/docs`, UTF8);
  let links = []
  fs.readdirSync(`${TMP_DIR}/docs`, Object.assign({}, UTF8, {withFileTypes:true})).forEach(file => {
    if(file.isDirectory()){
      let dirname = basename(file.name);
      links.push(` - [${dirname}](./${dirname}/index)`);
    }
  });
  fs.writeFileSync(indexFile, links.join('\n'), Object.assign({}, UTF8, {flags:'a'}));
}

fs.mkdirSync(TMP_DIR, { recursive: true });
processJsFiles();
processShellScripts();
updateIndexFiles();
