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
  absDirNames.forEach(dir => {
    fs.mkdirSync(dir, RECURSIVE)
  });
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

const HEADER_VAR = /(\w+):(.*)/;
function mdHeaderVars(lineArray) {
  if (typeof lineArray == "string") { lineArray = lineArray.trim().split(NL) }
  if (lineArray[0] != '---') {
    return {
      _set: () => true,
      _apply: (input) => input,
      _exists: false
    }
  }

  let result = {
    _exists: true,
    _set: function() { },
    /** returns copy of input with variables replaced */
    _apply: function(text = lineArray, vars = Object.keys(this)) {
      
      
      let wasArray = false;
      if (Array.isArray(text)) {
        text = text.join(NL);
        wasArray = true;
      }
      vars.forEach(name => {
        text = text.replaceAll(`{{ ${name} }}`, this[name])
      })
      return wasArray ? text.split(NL) : text;
    }
  };
  for (let i = 1; i < lineArray.length && lineArray[i] != '---'; i++) {
    let decl = HEADER_VAR.exec(lineArray[i]);
    if (decl != null && decl.length == 3) { result[decl[1]] = decl[2].trim() }
  }

  return result;
}

function processJsFiles() {
  let candidates = exec(`find '${SRC_ROOT}' -name '*.js'`, UTF8).trim().split(NL);
  console.log("found", candidates)
}

function processShellScripts() {

  let foundFiles = {}

  logGroup('Search source files', () => {
    let candidatesWithExtension = exec(`find '${SRC_ROOT}' -name '*.sh' -or -name '*.lib'`, UTF8).trim().split(NL);
    let executableCandidates = exec(`find '${SRC_ROOT}' -type f -executable`, UTF8).trim().split(NL);
    for (let c of candidatesWithExtension) { foundFiles[c] = true }

    for (let c of executableCandidates) {
      if (exec(`file '${c}'`, UTF8).includes('shell script')) { foundFiles[c] = true }
    }
    foundFiles[`${SRC_ROOT}/opt/batocera-emulationstation/common-paths.lib`] = "common-paths"
    console.log("found: *.sh", Object.keys(foundFiles));
  });

  let shdocBin = `${WORKSPACE_ROOT}/tmp/shdoc`;
  if (!fs.existsSync(shdocBin)) {
    logGroup('Installing shdoc', () => {
      exec(`curl -o '${shdocBin}' https://raw.githubusercontent.com/reconquest/shdoc/refs/heads/master/shdoc`, UTF8);
      exec(`chmod +x ${shdocBin}`, UTF8);
    });
  }

  let hasExtension = /\.[a-z]{1,3}$/;
  logGroup('Generate shdocs', () => {
    for (let file of Object.keys(foundFiles)) {
      let sourceRelative = relative(SRC_ROOT, file);
      let mdFileName = typeof foundFiles[file] == "string" ? foundFiles[file] : basename(file);

      let prefixLines = [];
      let targetDir = DEVDOC_DIR;
      let targetPath = `${targetDir}/${dirname(sourceRelative)}/${mdFileName}.md`;

      if (!hasExtension.test(file) || (file.endsWith('.lib') && typeof foundFiles[file] == "string")) {
        // shell scripts without any file ending go into bin/PATH -> meant to be used by the end user
        // exceptions only made for manually added files when a dedicated name is given
        targetDir = MANUAL_DIR;
        targetPath = `${targetDir}/${mdFileName}.md`;
        //generate an .md file into MANUAL_DIR that contains the output of 'binary --help' and shdoc
        let binaryHelp = exec(`[ -x "${file}" ] && "${file}" --help || exit 0`, UTF8)
        if (binaryHelp.trim().length > 0) {
          prefixLines = ['```', binaryHelp, '```']
        }
      }

      makeDirs(dirname(targetPath));
      console.log("Generating", targetPath, "from", file);
      fs.writeFileSync(targetPath, [
        ...prefixLines,
        exec(`cat '${file}' | ${shdocBin}`, UTF8)
      ].join(NL), UTF8)
    }
  });
}

function updateIndexFiles(targetVersion) {
  //let indexFile = `${TMP_DIR}/docs/index.md`
  exec(`cp -rf "${PAGES_TEMPLATES_DIR}"/* "${PAGES_TARGET_DIR}"`, UTF8);

  let allIndexFiles = exec(`find '${PAGES_TARGET_DIR}' -name index.md`, UTF8).trim().split(NL);

  //first pass to update/add VERSION property to headers
  allIndexFiles.forEach(indexFile => {
    let indexFileContent = fs.readFileSync(indexFile, UTF8).trim().split(NL);
    let header = mdHeaderVars(indexFileContent);
    if (header._exists && !header.VERSION) {
      indexFileContent[0] = `VERSION: ${targetVersion}`;
      indexFileContent.unshift('---');
      header = mdHeaderVars(indexFileContent);
      fs.writeFileSync(indexFile, indexFileContent.join(NL), options(UTF8, { flag: 'w' }));
    }
  });

  //build linking structure
  allIndexFiles.forEach(indexFile => {
    console.log('Adding links for subdirectories to', indexFile);
    let indexDir = dirname(indexFile);
    let links = []

    fs.readdirSync(indexDir, options(UTF8, { withFileTypes: true })).forEach(file => {
      if (file.isDirectory()) {
        let subindex = `${indexDir}/${file.name}/index.md`;
        if (fs.existsSync(subindex)) {
          let firstTitle = exec(`grep -E '^#.*' '${subindex}' | head -n 1 || echo ''`, UTF8) || file.name;
          let header = mdHeaderVars(exec(`head -n 10 ${subindex}`, UTF8))
          firstTitle = header._apply(firstTitle);
          /*links.push({
            title: firstTitle.trim(),
            subdir: file.name,
            filename: 'index'
          });*/
          links.push(`[#${firstTitle.trim()}](./${file.name})`)
        }
      }
    });
    if (links.length > 0) {
      let indexFileContent = fs.readFileSync(indexFile, UTF8).trim().split(NL);
      let linkHook = indexFileContent.indexOf('<!-- generated-links -->');
      if (linkHook > 0) {
        indexFileContent = indexFileContent.slice(0, linkHook);
        /*links = [
          '\n<script type="text/javascript">',
          `if(document.body.subPages) { document.body.subPages('${JSON.stringify(links)}') };`,
          '</script>'
        ];*/
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
