<!--
SPDX-FileCopyrightText: 2025 Karsten Teichmann

SPDX-License-Identifier: MIT
-->

# Developer Documentation

This documentation explains all source files and the general structure of the repository.

## Repository structure

- `scripts`: Contains scripts used for building and/or testing only. Will not be included in package.
- `sources`: Parent directory of all source files
    - `fs-root`: This is the actual code this package adds to the built package of batocera-emulationstation
    - `page-template`: Source code used in the generation of this documentation
- `docs`: Where github pages will be located. Changing anything here is pointless, the documentation is auto-generated and maintained by a github workflow.
- `configs-generated`: Created with `scripts/generate-configs.sh`. Automatically on branches prefixed with `config/` via workflow. Only serves documentation and debugging purposes.
- `test`: Test runner and test reporter implementations
    - `js`: The actual test js files. Requires naming convention `*.test.js` to be picked up
    - `resources`: For tests which read files, or require a file system directory hierarchy
- `src`, `pkg`, `tmp`: Auto-created by tests and builds as needed.

## Conventions and rules

### File naming and placement

While file endings might not necessarily be needed for the code or its interpreters, they still provide info about
the file to IDEs in use. Moreover, file endings help to quickly transmit the intent of a file to developers reading 
browsing the sources.

The following sections describe the rules and intentions which are in place currently.

General rule:
- Any script file intended to be used from the command line should **not** have an ending.

<p>

**Bash executables**

Script files meant to be launched directly.

1. Scripts providing `store` functionality for a system must end with `.store`.  
   `*.store` files go into `opt/batocera-emulationstation/stores`

</p>

<p>

**Bash script libraries**

'Script libraries' are scripts which are meant to be sourced into a greater context **only**. The may very well not be
fully functional on their own.

1. File ending: `.shl`.
2. `*.shl` file names should only consist of `([a-z]-)+`.
3. Depending on the purpose/intended users `*.shl` files are to be placed in one of 2 directories:
    - Helper which only make sense for `emulatorlauncher` go into `opt/emulatorlauncher/lib`
    - General purpose libraries needed by several scripts in `usr/bin` or `opt/batocera-emulationstation/**`
      go into `opt/batocera-emulationstation/lib`
4. System/emulator adapters used by `emulatorlauncher` go into `opt/emulatorlauncher` and must end with `.sh`.  
   This is an exception to the rules above for historical reasons and might change in the future.

</p>

<p>

**Node scripts**

1. Library files go into `opt/batocera-emulationstation/node_modules`.
2. File ending: `.js`, plain javascript. No typescript, angular etc.

</p>

<!-- generated-links -->