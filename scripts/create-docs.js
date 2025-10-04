#!/usr/bin/node

const { dirname, basename, relative } = require('path');
const fs = require('node:fs');
const exec = require('node:child_process').execSync;
//const execAsync = require('node:child_process').exec;

const NL = '\n';
const UTF8 = { encoding: 'utf8' };
const RECURSIVE = { recursive: true };

const WORKSPACE_ROOT = fs.realpathSync(__dirname + "/..");
const SRC_ROOT = `${WORKSPACE_ROOT}/sources/fs-root`;

const TMP_DIR = `${WORKSPACE_ROOT}/tmp`;
const DOC_ROOT = `${TMP_DIR}/docs`;
const MANUAL_DIR = `${TMP_DIR}/docs/user/files`;
const DEVDOC_DIR = `${TMP_DIR}/docs/dev/files`;
const PAGES_TEMPLATES_DIR = `${WORKSPACE_ROOT}/sources/page-template`;
const PAGES_TARGET_DIR = `${WORKSPACE_ROOT}/docs`;
const PAGES_TARGET_VERSION_DIR = `${WORKSPACE_ROOT}/docs/version`

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

function makeDirs(...absDirNames) {
  absDirNames.forEach(dir => { fs.mkdirSync(dir, RECURSIVE) });
}

function options(...objects) { return Object.assign({}, ...objects) }

function logGroup(title, runnable) {
  console.log(`::group::${title}`);
  try {
    runnable();
  } catch (e) {
    console.error(e);
  } finally {
    console.log('::endgroup::')
  }
}

class MdLinkIndex {
  
}

/**
 * The documentation template directory adds more nesting layers to the original file hierarchy.
 * These should not appear in sub path names of files which are linked automatically.
 * This function does not create valid links, it only attempts to clean the 'tmp/doc/../files' part from any given filename.
 * Should only be called, when the 
 */
function cleanSubPathName(path, includeDotSlash = false){
  if (path.startsWith(DEVDOC_DIR)){ return '/' + relative(DEVDOC_DIR, path) }
  else if(path.startsWith(MANUAL_DIR)){ return '/' + relative(MANUAL_DIR, path) }
  else if(path.startsWith(SRC_ROOT)){ return '/' + relative(SRC_ROOT, path) }
  else { return basename(path) }
}

class MdHeaderVars {
  static HEADER_VAR = /(\w+):(.*)/;
  #varDefs = null;
  #hasHeader = false;
  fullSource = []
  contentStartsAt = 0;
  constructor(lineArray = []){
    if (typeof lineArray == "string") { lineArray = lineArray.trim().split(NL) }
    if (lineArray[0] == '---') { this.#parseHeader(lineArray) }
    this.fullSource = lineArray;
  }

  #parseHeader(lineArray){
    this.#varDefs = {}
    let i = 1;
    for (i = 1; i < lineArray.length && lineArray[i] != '---'; i++) {
      let decl = MdHeaderVars.HEADER_VAR.exec(lineArray[i]);
      if (decl != null && decl.length == 3) { this.#varDefs[decl[1]] = {idx: i, value: decl[2].trim()} }
    }
    this.#hasHeader = lineArray[i] == '---';
    if (this.#hasHeader) { this.contentStartsAt = i + 1 }
    else { this.#varDefs = null }
  }

  exists(varname = null){
    return (varname == null) 
      ? this.#varDefs != null
      : this.exists() && typeof this.#varDefs[varname] != "undefined";
  }

  /** 
   * Set header value, update source array.
   * Return true if anything was changed.
   */
  setValue(varname, value) { 
    let dirty = false;
    if (this.exists(varname)) {
      let def = this.#varDefs[varname];
      dirty = def.value != value;
      this.fullSource[def.idx] = `${varname}: ${value}`;
    } else {
      this.fullSource[0] = `${varname}: ${value}`;
      this.fullSource.unshift('---');
      dirty = true
    }
    if(dirty) { this.#parseHeader(this.fullSource) }
    return dirty;
  }
  getValue(varname){ return this.exists() ? this.#varDefs[varname].value : undefined }

  apply(text = lineArray, vars = Object.keys(this.#varDefs || {})){
    if(!this.exists()) { return text }
    let resultType = Array.isArray(text) ? (input) => input.split(NL) : (input) => input;
    text = Array.isArray(text) ? text.join(NL) : text;
    vars.forEach(name => { text = text.replaceAll(`{{ page.${name} }}`, this.getValue(name)) });
    return resultType(text);
  }
}

function processJsFiles() {
  logGroup('Search js source files', () => {
    let candidates = exec(`find '${SRC_ROOT}' -name '*.js'`, UTF8).trim().split(NL);
    console.log("found", candidates)
  });
}

function processShellScripts() {
  let shdocBin = `${WORKSPACE_ROOT}/tmp/shdoc`;
  if (!fs.existsSync(shdocBin)) {
    logGroup('Installing shdoc', () => {
      exec(`curl -o '${shdocBin}' https://raw.githubusercontent.com/reconquest/shdoc/refs/heads/master/shdoc`, UTF8);
      exec(`chmod +x ${shdocBin}`, UTF8);
    });
  }
  
  let foundFiles = {}
  logGroup('Search shell source files', () => {
    let candidatesWithExtension = exec(`find '${SRC_ROOT}' -name '*.sh' -or -name '*.lib'`, UTF8).trim().split(NL);
    let executableCandidates = exec(`find '${SRC_ROOT}' -type f -executable`, UTF8).trim().split(NL);
    for (let c of candidatesWithExtension) { foundFiles[c] = true }

    for (let c of executableCandidates) {
      if (exec(`file '${c}'`, UTF8).includes('shell script')) { foundFiles[c] = true }
    }
    foundFiles[`${SRC_ROOT}/opt/batocera-emulationstation/common-paths.lib`] = "Common Paths"
    foundFiles[`${SRC_ROOT}/opt/emulatorlauncher/.operations.lib`] = "Emulatorlauncher Operations"
    console.log("found:", Object.keys(foundFiles));
  });

  let hasExtension = /\.[a-z]{1,3}$/;
  logGroup('Generate shdocs', () => {
    for (let file of Object.keys(foundFiles)) {
      let sourceRelative = relative(SRC_ROOT, file);
      let mdFileName = typeof foundFiles[file] == "string" ? foundFiles[file] : cleanSubPathName(file);

      let prefixLines = [ `# ${mdFileName}\n` ];
      if (mdFileName.startsWith('.')) { mdFileName = mdFileName.substring(1) }
      let targetDir = DEVDOC_DIR;
      let targetPath = `${targetDir}/${dirname(sourceRelative)}/${mdFileName}.md`;

      if (!hasExtension.test(file) || (file.endsWith('.lib') && typeof foundFiles[file] == "string")) {
        /* 
        some files generate 2 different documents - user manual and dev manual
        this mostly applies to executables in /usr/bin without file extension        
        additional user manual files can be assigned manually by overriding the value of foundFiles[path] with a string instead of a boolean
        generate an .md file into MANUAL_DIR that contains the output of 'binary --help' and shdoc
        */
        let binaryHelp = exec(`[ -x "${file}" ] && "${file}" --help || exit 0`, UTF8).trim();
        if (binaryHelp.length > 0) {
          prefixLines.push(
            '```', binaryHelp, '```', 
            "<sub>(Directly retrieved from the executable's help function)</sub>  \n"
          );
        }
        runShDoc(shdocBin, file, `${MANUAL_DIR}/${basename(mdFileName)}.md`, prefixLines);
      }

      runShDoc(shdocBin, file, targetPath, prefixLines);
    }
  });
}

let invalidShdocIndexLinks = /^\* \[_(.*?)\]\(#(\w.*?)\)/;
function runShDoc(shdocBin, sourceFile, targetPath, prefixLines){
  makeDirs(dirname(targetPath));
  console.log("Generating", targetPath, "from", sourceFile);
  let printInternal = targetPath.startsWith(DEVDOC_DIR) ? "| grep -v -e '#\s*@internal\s*' " : '';
  let shDocResult = exec(`cat '${sourceFile}' ${printInternal}| ${shdocBin}`, UTF8).trim().split(NL);
  //shDoc can't handle function names starting with _. Links in index will start without _, but the chapter caption has the _
  for (let idx = 0; idx < shDocResult.length; idx++) {
    let linkSpec = invalidShdocIndexLinks.exec(shDocResult[idx]);
    if (linkSpec != null && linkSpec.length == 3) {
      shDocResult[idx] = `* [_${linkSpec[1]} (internal)](#_${linkSpec[2]})`;
    }
  }
  fs.writeFileSync(targetPath, [
    ...prefixLines,
    ...shDocResult,
    shDocResult.length > 0 ? '\n\n<sub>Generated with shdoc</sub>' : ''
  ].join(NL), UTF8)
}

function fileToLink(root, filename) {
  let firstTitle = exec(`grep -E '^# .*' '${filename}' | head -n 1 || echo ''`, UTF8) || cleanSubPathName(filename);
  let header = new MdHeaderVars(exec(`head -n 10 '${filename}'`, UTF8))
  firstTitle = header.apply(firstTitle);
  //TODO: if sorting is required, this method should not return strings, but link objects
  return `* [${firstTitle.trim().replace(/^#\s*/, '')}](./${relative(root, filename)})`;
}

function getLinksRecursive(root, indexDir) {
  let links = [];

  let currentIndex = `${indexDir}/index.md`
  if (fs.existsSync(currentIndex)) { return [fileToLink(root, currentIndex)] }

  fs.readdirSync(indexDir, options(UTF8, { withFileTypes: true })).forEach(file => {
    if (file.isDirectory()) {
      let subindex = `${indexDir}/${file.name}/index.md`;
      if (fs.existsSync(subindex)) {
        links.push(fileToLink(root, subindex));
      } else {
        links.push(...getLinksRecursive(root, `${indexDir}/${file.name}`))
      }
    } else {
      links.push(fileToLink(root, `${indexDir}/${file.name}`))
    }
  });

  return links;
}

function updateIndexFiles(targetVersion) {
  exec(`cp -rf "${PAGES_TEMPLATES_DIR}"/* "${PAGES_TARGET_DIR}"`, UTF8);

  let allIndexFiles = exec(`find '${PAGES_TARGET_DIR}' -name index.md`, UTF8).trim().split(NL);

  //first pass to update/add VERSION property to headers
  allIndexFiles.forEach(indexFile => {
    let indexFileContent = fs.readFileSync(indexFile, UTF8).trim().split(NL);
    let header = new MdHeaderVars(indexFileContent);
    if (header.exists() && !header.exists("VERSION")) {
      header.setValue("VERSION", targetVersion);
      fs.writeFileSync(indexFile, header.fullSource.join(NL), options(UTF8, { flag: 'w' }));
    }
  });

  //build linking structure
  allIndexFiles.forEach(indexFile => {
    console.log('Adding links for subdirectories to', indexFile);
    let indexDir = dirname(indexFile);
    let links = [];

    fs.readdirSync(indexDir, options(UTF8, { withFileTypes: true })).forEach(file => {
      if (file.isDirectory()) {
        let subindex = `${indexDir}/${file.name}`;
        links.push(...getLinksRecursive(indexDir, subindex));
      }
    });
    if (links.length > 0) {
      let indexFileContent = fs.readFileSync(indexFile, UTF8).trim().split(NL);
      let linkHook = indexFileContent.indexOf('<!-- generated-links -->');
      if (linkHook > 0) {
        indexFileContent = indexFileContent.slice(0, linkHook);
        links.unshift('## Subchapters')
        indexFileContent.push(...links);
        fs.writeFileSync(indexFile, indexFileContent.join(NL), options(UTF8, { flag: 'w' }));
      }
    }
  });

  let relativeReplace = new RegExp("\\]\\(\\.\\/", 'g');
  let findResult = exec(`find '${PAGES_TARGET_DIR}' -name .join.md`, UTF8)
  if (findResult.trim().length == 0) {
    console.log("Nothing more to do.");
    return;
  }
  findResult.trim().split(NL).forEach(joinFile => {
    //TODO: test/fix??
    let indexDir = dirname(joinFile);
    let merged = [];
    fs.readdirSync(indexDir, options(UTF8, { withFileTypes: true })).forEach(file => {
      let indexFile = `${indexDir}/${file.name}/index.md`;
      if (file.isDirectory() && fs.existsSync(indexFile)) {
        let subdir = file.name;
        let content = fs.readFileSync(indexFile, UTF8);
        let replacement = `}(./${subdir}/`;
        content = content.replace(relativeReplace, replacement);
        if (content.length > 0) { merged.push(content) }
      }
    });
    if (merged.length > 0) {
      fs.writeFileSync(`${indexDir}/index.md`, [
        '---',
        `VERSION: ${targetVersion}`,
        '---\n',
        ...fs.readFileSync(joinFile, UTF8).split('\n'),
        ...merged
      ].join(NL), UTF8);
    }

  })
}

if (process.argv.includes('--generate-version')) {
  makeDirs(TMP_DIR, MANUAL_DIR, DEVDOC_DIR);
  exec(`cp -rf "${PAGES_TEMPLATES_DIR}/.manuals"/* "${DOC_ROOT}"`, UTF8);
  processJsFiles();
  processShellScripts();
  /*fs.writeFileSync(`${DOC_ROOT}/.join.md`, [
    `# {{ VERSION }}: Documentation`
  ].join(NL), UTF8);*/

} else if (process.argv.includes('--integrate-as-version')) {
  let version = process.argv[process.argv.indexOf('--integrate-as-version') + 1];
  let documentVersionDir = `${PAGES_TARGET_VERSION_DIR}/${version}`
  makeDirs(PAGES_TARGET_DIR, PAGES_TARGET_VERSION_DIR);

  if (fs.existsSync(documentVersionDir)) {
    fs.rmdirSync(documentVersionDir, options(UTF8, RECURSIVE));
  }
  fs.renameSync(DOC_ROOT, documentVersionDir);

  updateIndexFiles(version);
}
