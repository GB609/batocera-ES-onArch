#!/usr/bin/node

/**
 * @file
 * @brief This script parses all source files and generates documentation out of them in md style, based on `shdoc`.  
 * @description 
 * The generation process can also support different types of source files and comment styles by using adapter executables.  
 * Adapters will simply be inserted as an intermediate step into a shell pipeline before `shdoc`. So they can parse + transform whatever
 * source to output shell-style comments at the end. The adapters don't need to convert every line. It's sufficient to just print the
 * comment lines with the occasional blank line or function definition in between.
 *
 * @see [JS adapter](./js-to-shdoc.sh)
 * @see [shdoc](https://github.com/GB609/shdoc)
 */

if (process.env.DEBUG) { console.debug = console.log }
else { console.debug = () => { } }

const { dirname, basename, relative, extname } = require('path');
const fs = require('node:fs');
const exec = require('node:child_process').execSync;

const NL = '\n';
const UTF8 = { encoding: 'utf8' };
const RECURSIVE = { recursive: true };

const WORKSPACE_ROOT = fs.realpathSync(__dirname + "/..");
const SHDOC = `${WORKSPACE_ROOT}/tmp/shdoc`;
const JSDOC_ADAPTER = `${WORKSPACE_ROOT}/scripts/js-to-shdoc.sh`

const SRC_ROOT = `${WORKSPACE_ROOT}/sources/fs-root`;
const TMP_DIR = `${WORKSPACE_ROOT}/tmp`;

const DOC_ROOT = `${TMP_DIR}/docs`;
let MANUAL_DIR = undefined;
let DEVDOC_DIR = undefined;
let REPORT_DIR = `${TMP_DIR}/reports`;

const PAGES_TEMPLATES_DIR = `${WORKSPACE_ROOT}/sources/page-template`;
const PAGES_TARGET_DIR = `${WORKSPACE_ROOT}/docs`;
const PAGES_TARGET_VERSION_DIR = `${WORKSPACE_ROOT}/docs/version`;

let CURRENT_REVISION;

const LINK_TABLE_CSS = `
<style type="text/css">
#sidemenu {
  width: 350px; height: 100%;
  position: fixed; top: 0px; right: 0px;
  border-left: 1px solid black;
  padding-left: 25px;
  line-height: 1.4em;
  box-sizing: border-box;
  overflow-y: auto;
  display: block;
}
#sidemenu ul {
  margin-bottom: 0px;
  padding-left: 25px;
}
body {
  width: calc(100% - 350px);
  box-sizing: border-box;
  padding-right: 30px;
}
</style>
`

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

class LinkDef {
  nesting = 0;
  order = '00';
  title = ""
  target = ""

  static #strCmp(a, b) {
    if (a < b) { return -1 }
    else if (b > a) { return 1 }
    else { return 0 }
  }

  static extractTitle(filename) {
    let title;
    switch (extname(filename)) {
      case '.md':
        title = exec(`grep -E '^# .*' '${filename}' | head -n 1 || echo ''`, UTF8)
        break;
      case '.html':
        title = exec(`grep -E '<title>.*' '${filename}' | head -n 1 || echo ''`, UTF8)
          .replace(/<(\/){0,1}\s*title\s*>/g, '').trim();
        break;
    }

    return title || cleanSubPathName(filename);
  }

  constructor(root, filename) {
    this.absPath = filename;
    this.title = LinkDef.extractTitle(filename);
    let header = new MdHeaderVars(exec(`head -n 10 '${filename}'`, UTF8))
    let relativeLink = relative(root, filename);
    this.nesting = dirname(relativeLink).split('/').length;

    if (header.exists("ORDER")) { this.order = header.getValue("ORDER") }

    this.title = header.apply(this.title).trim().replace(/^#\s*/, '');
    this.target = `./${relativeLink}`;
  }

  isFileTitle() { return this.title.startsWith('/') ? 1 : -1 }
  compareTo(other) {
    if (this.order != other.order) { return LinkDef.#strCmp(this.order, other.order) }
    if (this.isFileTitle() == other.isFileTitle()) { return LinkDef.#strCmp(this.title, other.title) }
    return this.isFileTitle();
  }
  toString(typeHint = 'md', linkStyle = 'md') {
    if(typeHint == 'html'){
      linkStyle = '.' + linkStyle.replace(/^\./, '');
      if (!this.target.endsWith(linkStyle)) { this.target = this.target.replace(/\.md$/, linkStyle) }
      return `<li><a href="${this.target}">${this.title}</a></li>`;
    } 
    return `${''.padStart(this.nesting * 2)}* [${this.title}](${this.target})` 
  }
}

class MdLinkIndex {
  #links = {};
  #lowestDepth = { '-1': 99, 1: 99 };

  add(...links) {
    links.forEach(l => {
      if (l instanceof LinkDef) {
        let fileTitleHint = l.isFileTitle()
        this.#links[l.absPath] = l;
        this.#lowestDepth[fileTitleHint] = Math.min(this.#lowestDepth[fileTitleHint], l.nesting);
      }
      else if (l instanceof MdLinkIndex) { this.add(...l.getAll()) }
    })
  }
  empty() { return Object.keys(this.#links).length == 0 }
  getAll() { return Object.values(this.#links) }
  recursiveAdd(targetArray, data) {
    Object.keys(data).forEach(key => {
      if (data[key] instanceof LinkDef) {
        targetArray.push(data[key].toString());
      } else {
        targetArray.push(key);
        this.recursiveAdd(targetArray, data[key]);
      }
    })
  }
  recursiveAddHtml(targetArray, data, linkStyle) {
    Object.keys(data).forEach(key => {
      if (data[key] instanceof LinkDef) {
        targetArray.push(data[key].toString('html', linkStyle));
      } else {
        targetArray.push(`<li>${key.replace(/\s*\* /, '')}</li>`, '<ul>');
        this.recursiveAddHtml(targetArray, data[key], linkStyle);
        targetArray.push('</ul>');
      }
    })
  }
  #generateTreeStructure() {
    if (this.#lowestDepth != null) {
      this.getAll().forEach(l => l.nesting -= this.#lowestDepth[l.isFileTitle()]);
      this.#lowestDepth = null;
    }
    let treeStructure = {}
    let currentPath = treeStructure;
    for (let link of this.getAll()) {
      currentPath = treeStructure;
      if (link.isFileTitle() == 1) {
        let sections = link.title.substring(1).split('/');
        link.nesting = sections.length - 1;
        link.title = sections[sections.length - 1];
        let depth = -link.nesting;
        while (sections.length > 0) {
          let currentKey = sections.shift();
          currentKey = `${''.padStart((depth + link.nesting) * 2, ' ')}* /${currentKey}`;
          depth++;
          if (sections.length > 0) {
            currentPath[currentKey] ||= {};
            currentPath = currentPath[currentKey];
          } else {
            currentPath[currentKey] = link;
          }
        }
      } else {
        // files containing manual titles shouldn't be automatically nested
        link.nesting = 0;
        treeStructure[link.title] = link;
      }
    }
    return treeStructure;
  }
  toMdLines() {
    let resultLines = [];
    let treeStructure = this.#generateTreeStructure();
    this.recursiveAdd(resultLines, treeStructure);
    return resultLines.join(NL);
  }

  toHtmlLines(linkStyle = 'html') {
    let resultLines = ['<ul>'];
    let treeStructure = this.#generateTreeStructure();
    this.recursiveAddHtml(resultLines, treeStructure, linkStyle);
    resultLines.push('</ul>');
    return resultLines.join(NL);
  }

  sort() {
    let sorted = [...this.getAll()];
    sorted.sort((a, b) => a.compareTo(b));
    this.#links = {};
    this.add(...sorted);
  }
  toJSON() {
    return {
      _links: this.#links,
      _lowestDepth: this.#lowestDepth
    }
  }
}

/**
 * The documentation template directory adds more nesting layers to the original file hierarchy.
 * These should not appear in sub path names of files which are linked automatically.
 * This function does not create valid links, it only attempts to clean the 'tmp/doc/../files' part from any given filename.
 */
function cleanSubPathName(path, includeDotSlash = false) {
  if (path.startsWith(DEVDOC_DIR)) { return '/' + relative(DEVDOC_DIR, path) }
  else if (path.startsWith(MANUAL_DIR)) { return '/' + relative(MANUAL_DIR, path) }
  else if (path.startsWith(SRC_ROOT)) { return '/' + relative(SRC_ROOT, path) }
  else { return '/' + basename(path) }
}

/**
 * This class handles Jekyll Front Matter in md files. It is capable of reading and writing variables to it.  
 * However, it does not by itself re-write the source file, but maintains a in-memory copy/buffer of it.
 */
class MdHeaderVars {
  static HEADER_VAR = /(\w+):(.*)/;
  #varDefs = null;
  #hasHeader = false;
  fullSource = []
  contentStartsAt = 0;
  constructor(lineArray = []) {
    if (typeof lineArray == "string") { lineArray = lineArray.trim().split(NL) }
    if (lineArray[0] == '---') { this.#parseHeader(lineArray) }
    this.fullSource = lineArray;
  }

  #parseHeader(lineArray) {
    this.#varDefs = {}
    let i = 1;
    for (i = 1; i < lineArray.length && lineArray[i] != '---'; i++) {
      let decl = MdHeaderVars.HEADER_VAR.exec(lineArray[i]);
      if (decl != null && decl.length == 3) { this.#varDefs[decl[1]] = { idx: i, value: decl[2].trim() } }
    }
    this.#hasHeader = lineArray[i] == '---';
    if (this.#hasHeader) { this.contentStartsAt = i + 1 }
    else { this.#varDefs = null }
  }

  exists(varname = null) {
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
    if (dirty) { this.#parseHeader(this.fullSource) }
    return dirty;
  }
  getValue(varname) { return this.exists() ? this.#varDefs[varname].value : undefined }

  apply(text = lineArray, vars = Object.keys(this.#varDefs || {})) {
    if (!this.exists()) { return text }
    let resultType = Array.isArray(text) ? (input) => input.split(NL) : (input) => input;
    text = Array.isArray(text) ? text.join(NL) : text;
    vars.forEach(name => { text = text.replaceAll(`{{ page.${name} }}`, this.getValue(name)) });
    return resultType(text);
  }
}

/**
 * Used internally to download a compatible version of shdoc.
 */
function prepareShDoc() {
  if (!fs.existsSync(SHDOC)) {
    logGroup('Installing shdoc', () => {
      exec(`curl -o '${SHDOC}' https://raw.githubusercontent.com/GB609/shdoc/refs/heads/master/shdoc`, UTF8);
      exec(`chmod +x ${SHDOC}`, UTF8);
    });
  }
}

function findSourceFiles(root, extensions, fileType = null) {
  let foundFiles = {};

  let doc_root = `${WORKSPACE_ROOT}/${root}`
  let findString = extensions.map(ext => `-name '*.${ext}'`).join(' -or ');
  let candidatesWithExtension = exec(`find '${doc_root}' ${findString}`, UTF8).trim().split(NL);
  let executableCandidates = exec(`find '${doc_root}' -type f -executable`, UTF8).trim().split(NL);

  for (let c of candidatesWithExtension) { foundFiles[c] = true }

  if (fileType != null) {
    for (let c of executableCandidates) {
      if (exec(`file '${c}'`, UTF8).includes(fileType)) { foundFiles[c] = true }
    }
  }

  console.log("found:", Object.keys(foundFiles));
  return foundFiles;
}

function handleOverrides(root, manTarget, overrides) {
  if (typeof manTarget == 'undefined') { return {} }

  let additionalFiles = {}
  Object.entries(overrides).forEach(([file, title]) => {
    let absPath = `${WORKSPACE_ROOT}/${root}/${file}`;
    additionalFiles[absPath] = title;
  });

  console.log("Adding/overwriting files", additionalFiles);
  return additionalFiles;
}

function processJsFiles(root, docTarget, manTarget, overrides) {
  let foundFiles = {};
  logGroup(`Search js source files under [${root}]`, () => {
    foundFiles = findSourceFiles(root, ['js', 'mjs'], 'Node.js script');

    let additionalFiles = handleOverrides(root, manTarget, overrides);
    Object.assign(foundFiles, additionalFiles);
  });

  generateMdFiles(foundFiles, docTarget, manTarget, JSDOC_ADAPTER);
}

function processShellScripts(root, docTarget, manTarget, overrides) {
  let foundFiles = {};
  logGroup(`Search shell source files under [${root}]`, () => {
    foundFiles = findSourceFiles(root, ['sh', 'lib'], 'shell script');

    let additionalFiles = handleOverrides(root, manTarget, overrides);
    Object.assign(foundFiles, additionalFiles);
  });

  generateMdFiles(foundFiles, docTarget, manTarget);
}

/**
 * This function is responsible for the actual generation of .md-files out of all passed in sources.  
 * The actual creation of md files is handled by `shdoc` internally, the source file contents are piped into it.  
 * This function generates up to 2 files:
 * 1. One goes into the developer manual. This will show all functions, even those marked with `@internal` (lines containing `@internal` are filtered out).
 * 2. Executables meant to be called by the end user additionally go into a dedicated folder for user manuals.  
 * 
 * The creation of a user manual file is optional. It only happens when the file
 *  - does not have an extension OR
 *  - was added manually to a hard-coded list of files for the 'user' manual
 * As the no-extension check is inaccurate in some situations, it is possible to override and force-disable user manual generation.  
 * To do so, the special comment `#NOUSERMAN#` must be used in the first 2 lines of the file.
 *  
 * The generation of user manual files follows slightly different rules:
 * 1. As a first step, it is attempted to call `<sourceFile> --help` to get what the executable would produce on the command line for help.  
 *    If that command executes without errors and produces any output, a first section in the document will be generated for that.
 * 2. The file is piped into `shdoc` next. Contrary to the generation of developer docs, `@internal` is not filtered away here.
 *
 * **Usage of `shdoc`**
 * This function calls `[runShDoc]` and just passes through the optional `shdocAdapter` which can be used to transform files with different comment
 * styles into shell-style comments on the fly.
 */
function generateMdFiles(fileDict, docTarget, manTarget, shdocAdapter) {
  let hasExtension = /\.[a-z]{1,3}$/;

  logGroup('Generate shdocs', () => {
    for (let file of Object.keys(fileDict)) {
      let fsSubPath = cleanSubPathName(file);

      let mdFileName = basename(file).replace(/^\./, '');
      let title = `# ${fsSubPath}\n`;
      let prefixLines = [];

      let generateManual = typeof manTarget != 'undefined'
        && (!hasExtension.test(file) || typeof fileDict[file] == "string");
      if (generateManual) {
        try {
          let cmd = `head -n 2 '${file}' | grep -o '#NOUSERMAN#' || exit 0`;
          generateManual = exec(cmd, UTF8).trim().length == 0
        }
        catch { generateManual = false }
      }
      if (generateManual) {
        /* 
        some files generate 2 different documents - user manual and dev manual
        this mostly applies to executables in /usr/bin without file extension        
        additional user manual files can be assigned manually by overriding the value of foundFiles[path] with a string instead of a boolean
        generate an .md file into MANUAL_DIR that contains the output of 'binary --help' and shdoc
        */
        let binaryHelp = '';
        try { binaryHelp = exec(`[ -x "${file}" ] && "${file}" --help 2>&1`, UTF8).trim() }
        catch (e) { 
          console.log(fsSubPath, 'has no valid --help option - skip'); 
          console.error(e);
          binaryHelp = '';
        }
        if (binaryHelp.length > 0) {
          prefixLines.push(
            '```', binaryHelp, '```',
            "<sub>(Directly retrieved from the executable's help function)</sub>  \n"
          );
        }

        runShDoc(file, `${manTarget}/${mdFileName}.md`, [
          typeof fileDict[file] == "string"
            ? `# ${fileDict[file]}\n` : title,
          ...prefixLines
        ], shdocAdapter);
      }

      fsSubPath = dirname(fsSubPath);
      if (!fsSubPath.endsWith('/')) { fsSubPath += '/' }
      let targetPath = `${docTarget}${fsSubPath}${mdFileName}.md`;
      runShDoc(file, targetPath, [title, ...prefixLines], shdocAdapter);
    }
  });
}

let invalidShdocIndexLinks = /^\* \[_(.*?)\]\(#(\w.*?)\)/;
function runShDoc(sourceFile, targetPath, prefixLines, adapter = null, rootDir = DOC_ROOT) {
  makeDirs(dirname(targetPath));
  console.log("Generating", targetPath, "\n- source:", sourceFile);

  // define path to doc version root  
  let versionRoot = { DOC_ROOT: relative(dirname(targetPath), rootDir) };

  let printInternal = targetPath.startsWith(DEVDOC_DIR) ? "| grep -v -e '#\\s*@internal\\s*' " : '';
  console.debug("- show internal:", printInternal.length > 0);

  if (adapter != null) {
    console.debug("- use adapter:", adapter);
    printInternal = `| ${adapter} ` + printInternal;
  }

  let fullCommand = `cat '${sourceFile}' ${printInternal}| ${SHDOC}`;
  console.debug(fullCommand)
  let shDocResult = exec(fullCommand, Object.assign({ env: versionRoot }, UTF8)).trim().split(NL);
  //shDoc can't handle function names starting with _. Links in index will start without _, but the chapter caption has the _
  for (let idx = 0; idx < shDocResult.length; idx++) {
    let linkSpec = invalidShdocIndexLinks.exec(shDocResult[idx]);
    if (linkSpec != null && linkSpec.length == 3 && !linkSpec[2].startsWith('_')) {
      shDocResult[idx] = `* [_${linkSpec[1]} (internal)](#_${linkSpec[2]})`;
    }
  }
  let realSourcePath = `https://github.com/GB609/batocera-ES-onArch/blob/${CURRENT_REVISION}/${relative(WORKSPACE_ROOT, sourceFile)}`;
  fs.writeFileSync(targetPath, [
    ...prefixLines,
    ...shDocResult,
    shDocResult.length > 0 ? `\n\n<sub>Generated with shdoc from [${cleanSubPathName(sourceFile)}](${realSourcePath})</sub>` : ''
  ].join(NL), options(UTF8, { flag: 'a' }))
}

function getLinksRecursive(root, indexDir) {
  let links = new MdLinkIndex();

  let stopper = [`${indexDir}/index.md`, `${indexDir}/index.html`].filter(f => {
    return !(root == dirname(f)) && fs.existsSync(f)
  });
  if (stopper.length > 0) {
    stopper.forEach(s => links.add(new LinkDef(root, s)));
    return links;
  }

  fs.readdirSync(indexDir, options(UTF8, { withFileTypes: true })).forEach(file => {
    // 'hidden' files for jekyll
    if (file.name.startsWith('_')) { return }
    if (file.isDirectory()) {
      let subindex = `${indexDir}/${file.name}/index.md`;
      if (fs.existsSync(subindex)) {
        links.add(new LinkDef(root, subindex));
      } else {
        links.add(getLinksRecursive(root, `${indexDir}/${file.name}`))
      }
    } else if (file.name != "index.md" && /\.(md|html)$/.test(file.name)) {
      links.add(new LinkDef(root, `${indexDir}/${file.name}`))
    }
  });

  return links;
}

function updateIndexFiles(targetVersion, isTag = null, linkStyle = 'html', indexFileSupplier = null) {

  if (indexFileSupplier == null){
    indexFileSupplier = () => { 
      exec(`cp -rf "${PAGES_TEMPLATES_DIR}"/* "${PAGES_TARGET_DIR}"`, UTF8);
      let allIndexFiles = exec(`find '${PAGES_TARGET_DIR}/version/${targetVersion}' -name index.md`, UTF8).trim().split(NL);
      allIndexFiles.unshift(`${PAGES_TARGET_DIR}/index.md`);
      allIndexFiles.unshift(`${PAGES_TARGET_DIR}/version/index.md`);
      return allIndexFiles;
    }
  }

  let allIndexFiles = indexFileSupplier();

  //first pass to update/add VERSION property to headers
  allIndexFiles.forEach(indexFile => {
    let indexFileContent = fs.readFileSync(indexFile, UTF8).trim().split(NL);
    let header = new MdHeaderVars(indexFileContent);
    if (header.exists() && !header.exists("VERSION")) {
      header.setValue("VERSION", targetVersion);
      if (isTag != null && typeof isTag == 'boolean') { header.setValue("VERSION_IS_TAG", isTag) }
      fs.writeFileSync(indexFile, header.fullSource.join(NL), options(UTF8, { flag: 'w' }));
    }
  });

  //build linking structure
  allIndexFiles.forEach(indexFile => {
    console.log('Adding links for subdirectories to', indexFile);

    let indexFileContent = fs.readFileSync(indexFile, UTF8).trim().split(NL);
    let linkHook = indexFileContent.indexOf('<!-- generated-links -->');
    if (linkHook < 0){
      console.info(`Skip link indexing [${indexFile}] because it is missing a line with [<!-- generated-links -->]`);
      return;
    }
    
    let indexDir = dirname(indexFile);
    let links = getLinksRecursive(indexDir, indexDir);

    if (links.empty()){
      console.debug(' - No sub-pages found.');
      return;
    }
  
    let contentAfterLinks = indexFileContent.slice(linkHook + 1);
    indexFileContent = indexFileContent.slice(0, linkHook);
    links.sort();

    //console.log('Generate links from:', JSON.stringify(links, null, 2))
    indexFileContent.push(
      LINK_TABLE_CSS,
      '\n<div id="sidemenu">',
      '<h2>Subchapters</h2>',
      links.toHtmlLines(linkStyle),
      '</div>\n',
      ...contentAfterLinks
    );
    fs.writeFileSync(indexFile, indexFileContent.join(NL), options(UTF8, { flag: 'w' }));
  });

  /*
  let relativeReplace = new RegExp("\\]\\(\\.\\/", 'g');
  // FIXME: is there really a need for the '.join.md' syntax?
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
        let replacement = `](./${subdir}/`;
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

  })*/
}

if (process.argv.includes('--help')
  || (!process.argv.includes('--generate-version') && !process.argv.includes('--integrate-as-version'))
) {
  console.log(`Usage:
 * create-docs.js --generate-version [--config path/to/config]
 : Generates md files as specified in the source configuration file into tmp/docs.
   Default config file is 'sources/page-template/page_sources.json' if not given.

 * create-docs.js --integration-as-version <versionName> [--is-tag]
 : Short alias for 'create-docs.js --integrate-as-version <versionName> [--is-tag] --integrate-docs'.

 * create-docs.js --integration-as-version <versionName> [--is-tag] <[--integrate-...]+>
 : Used to integrate documentation files of certain type(s) into specific subfolder(s) of <versionName> in the data
   of the pages branch.
   Source files are expected in type-dependent source directories and will be moved to their respective targets.

   At least one subtype of the following must be given. However, several can be passed at once if the necessary source files
   have already been created:
   --integrate-docs - Moves 'tmp/docs' to 'docs/version/<versionName>'. Must be run after 'create-docs.js --generate-version'.
   --integrate-reports - Moves 'tmp/reports' to docs/version/<versionName>/build/reports'. Requires 'scripts/generate-reports.sh'.
   --integrate-all - Shortcut to use all of the '--integrate' types above (except --integrate-as-version, which enables this step).
   --is-tag - boolan flag passed to the Jekyll templates used to create correct checkout/install instructions

   After all files have been integrated, all index.md files of the target version and all parent directories up to 'docs'
   will have their sub-page link lists recreated. This step of the process effectively recreates the static files in 'docs'
   from their template sources in 'sources/page-template', thus it also implicitely updates the base documentation.`);
  process.exit(0);
}

if (process.argv.includes('--generate-version')) {
  console.log(process.argv)
  CURRENT_REVISION = exec('git rev-parse HEAD');
  let configFile = process.argv.includes('--config')
    ? process.argv[process.argv.indexOf('--config') + 1]
    : undefined;
  if (typeof configFile == 'undefined' || !fs.existsSync(configFile)) {
    configFile = PAGES_TEMPLATES_DIR + '/page_sources.json';
  }
  console.log("sourcing", configFile)
  let config = require(configFile);

  if (fs.existsSync(DOC_ROOT)) {
    fs.rmSync(DOC_ROOT, options(UTF8, RECURSIVE, { force: true }));
  }
  makeDirs(TMP_DIR, DOC_ROOT);
  exec(`cp -rf "${PAGES_TEMPLATES_DIR}/.manuals"/* "${DOC_ROOT}"`, UTF8);
  prepareShDoc();

  Object.values(config).forEach(cfg => {
    let docTarget = `${DOC_ROOT}/${cfg.docTarget}`;
    makeDirs(docTarget);
    let manTarget = cfg.manTarget;
    if (typeof manTarget != 'undefined') {
      manTarget = `${DOC_ROOT}/${manTarget}`
      makeDirs(manTarget);
    }
    DEVDOC_DIR = docTarget;
    MANUAL_DIR = manTarget;

    processJsFiles(cfg.root, docTarget, manTarget, cfg.manualAdds.js);
    processShellScripts(cfg.root, docTarget, manTarget, cfg.manualAdds.sh);
  })
}

let version;
let isTag = false;
let integrationTypes = [];
if (process.argv.includes('--integrate-as-version')) {
  let argPos = process.argv.indexOf('--integrate-as-version');
  if (argPos + 1 >= process.argv.length) { throw 'need a <version> specifier after --integrate-as-version' }
  version = process.argv[argPos + 1];
  isTag = process.argv.includes('--is-tag');
}

if (process.argv.includes('--integrate-all')) { integrationTypes = ['docs', 'reports'] }

if (process.argv.includes('--integrate-docs')) { integrationTypes.push('docs') }
if (process.argv.includes('--integrate-reports')) { integrationTypes.push('reports') }

if (version && integrationTypes.length == 0) { integrationTypes.push('docs') }
if (version && integrationTypes.length > 0) { makeDirs(PAGES_TARGET_DIR, PAGES_TARGET_VERSION_DIR); }
let documentVersionDir = `${PAGES_TARGET_VERSION_DIR}/${version}`;

if (integrationTypes.includes('docs')) {
  // FIXME: recreating docs will wipe coverage info as well, there is no clever sync/compare
  if (fs.existsSync(documentVersionDir)) { fs.rmSync(documentVersionDir, options(UTF8, RECURSIVE, { force: true })) }
  fs.renameSync(DOC_ROOT, documentVersionDir);
}
if (integrationTypes.length > 0) {
  // Index file templates have to be re-rendered in any case
  exec(`cp -rf "${PAGES_TEMPLATES_DIR}/.manuals"/* "${documentVersionDir}"`, UTF8);
}

if (integrationTypes.includes('reports')) {
  let reportsDir = `${documentVersionDir}/build/reports`;
  if (fs.existsSync(reportsDir)) { fs.rmSync(reportsDir, options(UTF8, RECURSIVE, { force: true })) }
  makeDirs(`${documentVersionDir}/build`);
  fs.renameSync(REPORT_DIR, reportsDir);
}

if (integrationTypes.length > 0) { 
  updateIndexFiles(version, isTag) 
} else if (process.argv.includes('--generate-version')) { 
  // running without any integration means that only the raw md files for one version went to tmp
  let indexSupplier = () => {
    return exec(`find '${DOC_ROOT}' -name index.md`, UTF8).trim().split(NL);
  }
  updateIndexFiles('LATEST', isTag, 'md', indexSupplier);
}
