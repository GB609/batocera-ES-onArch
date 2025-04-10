# Developer Documentation

## Repository structure

- `scripts`: Contains scripts used for building and/or testing only. Will not be included in package.
    - `fs-root`: This is the actual code this package adds to the built package of batocera-emulationstation
    - `page-template`: Source code used in the generation of this documentation
- `docs`: Where github pages will be located. Changing anything here is pointless, the documentation is auto-generated and maintained by a github workflow.
- `node_modules`: Modules used by `scripts` and `workflows`. Local copy to have reproducible builds on github without having to use npm for dependency installation all the time.
- `test`: Test runner and test reporter implementations
    - `js`: The actual test js files. Requires naming convention `*.test.js` to be picked up
    - `resources`: For tests which read files, or require a file system directory hierarchy
* `src`, `pkg`, `tmp`: Auto-created by tests and builds as needed.