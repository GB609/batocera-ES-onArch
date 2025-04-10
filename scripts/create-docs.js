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

function processJsFiles() {
  let candidates = exec(`find '${SRC_ROOT}' -name '*.js'`, UTF8).trim().split(NL);
  console.log("found", candidates)
}

function processShellScripts() {

  let foundFiles = {}

  logGroup('Search source files', () => {
    let candidatesWithExtension = exec(`find '${SRC_ROOT}' -name '*.sh'`, UTF8).trim().split(NL);
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

  logGroup('Generate shdocs', () => {
    for (let file of Object.keys(foundFiles)) {
      let sourceRelative = relative(SRC_ROOT, file);
      let mdFileName = typeof foundFiles[file] == "string" ? foundFiles[file] : basename(file);

      let prefixLines = [];
      let targetDir = DEVDOC_DIR;
      let targetPath = `${targetDir}/${dirname(sourceRelative)}/${mdFileName}.md`;

      if (!file.endsWith('.sh') && !file.endsWith('.js')) {
        // shell scripts without any file ending go into bin/PATH -> meant to be used by the end user
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

  exec(`find '${PAGES_TARGET_DIR}' -name index.md`, UTF8).trim().split(NL).forEach(indexFile => {
    console.log('Adding links for subdirectories to', indexFile);
    let indexDir = dirname(indexFile);
    let links = []

    let indexFileStart = exec(`head -n 1 ${indexFile}`, UTF8).trim();
    fs.readdirSync(indexDir, options(UTF8, { withFileTypes: true })).forEach(file => {
      if (file.isDirectory()) {
        let subindex = `${indexDir}/${file.name}/index.md`;
        if (fs.existsSync(subindex)) {
          let firstTitle = exec(`grep -E '^#.*' '${subindex}' | head -n 1 || echo ''`, UTF8) || file.name;
          links.push({
            title: firstTitle.trim(),
            subdir: file.name,
            filename: 'index'
          });
        }
      }
    });
    if (indexFileStart == '---') {
      fs.writeFileSync(indexFile, [
        '---',
        `VERSION: ${targetVersion}`,
        fs.readFileSync(indexFile, UTF8).trim().split('\n').slice(1)
      ].join('\n'), UTF8)
    }
    if (links.length > 0) {
      links = [
        '\n<script type="text/javascript">',
        `if(document.body.subPages) { document.body.subPages('${JSON.stringify(links)}') };`,
        '</script>'
      ];
      fs.writeFileSync(indexFile, links.join(NL), options(UTF8, { flag: 'a' }));
    }
  });

  let relativeReplace = new RegExp("\\]\\(\\.\\/", 'g');
  let findResult = exec(`find '${PAGES_TARGET_DIR}' -name .join.md`, UTF8)
  if (findResult.trim().length == 0) {
    console.log("Nothing more to do.");
    return;
  }
  findResult.trim().split(NL).forEach(joinFile => {
    console.log("found", joinFile);
    let indexDir = dirname(joinFile);
    let merged = [];
    fs.readdirSync(indexDir, options(UTF8, { withFileTypes: true })).forEach(file => {
      let indexFile = `${indexDir}/${file.name}/index.md`;
      if (file.isDirectory() && fs.existsSync(indexFile)) {
        let subdir = file.name;
        let content = fs.readFileSync(indexFile, UTF8);
        let replacement = `}(./${subdir}/`;
        content = content.trim().replace(relativeReplace, replacement);
        if (content.length > 0) { merged.push(content) }
      }
    });
    if (merged.length > 0) {
      fs.writeFileSync(`${indexDir}/index.md`, [
        '---',
        `VERSION: ${targetVersion}`,
        '---\n',
        fs.readFileSync(joinFile, UTF8),
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
