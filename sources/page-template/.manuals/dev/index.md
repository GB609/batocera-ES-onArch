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

### Editing

- indent: 2 spaces
- encoding: UTF-8, no BOM
- line length: <120

### File naming and placement

While file endings might not necessarily be needed for the code or its interpreters, they still provide info about
the file to IDEs in use. Moreover, file endings help to quickly transmit the intent of a file to developers reading 
browsing the sources.

The following sections describe the rules and intentions which are in place currently.

General rule:
- Any script file intended to be used from the command line should **not** have an ending.

<details>
<summary><strong>Bash executables</strong>

Script files meant to be launched directly.

1. Scripts providing `store` functionality for a system must end with `.store`.  
   `*.store` files go into `opt/batocera-emulationstation/stores`

</details>

<details>
<summary><strong>Bash script library files</strong></summary>

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

</details>

<details>
<summary><strong>Node scripts</strong></summary>

1. Library files go into `opt/batocera-emulationstation/node_modules`.
2. File ending: `.js`, plain javascript. No typescript, angular etc.

</details>

### Functions and variables

- General style: camelCase
- Global Constants: UPPER_WORDS

<details>
<summary><strong>Shell scripts libraries (*.shl)</strong></summary>

The rules here roughly go along the google recommendations, with a few exceptions.  
It is assumed that `.shl` files will be used for something similar to 'packages' most of the time.
Packages usually come with some kind of grouping and scoping mechanism or notation. Most of this does not exists in bash,
but it can partly be established by naming conventions.

There are 3 things that need to be differentiated based on name:

- A `public` API of a package which is meant to be used from the code loading the package
- `internal` utilities/helpers of a package which are not meant for direct use
- `public` constant values / variables
- `internal` variables holding state

Shell library files will have to comply to the following rules/conventions 
(with a few exceptions where they would be impractical):

- Every `.shl` file which represents a package, must consistently use a prefix for all functions and constants.  
  The prefix should be a short string in lower case letters `[a-z]` only. No `-` or `_`, preferably something close  
  or similar to the full file name.
- `public` function names: `prefix:functionName`
- `private` function names: `prefix#functionName`
- `public` variables like constants: `prefix_CONSTANT_NAME`
- `private` state variables: `prefix__privateVarName`
- variables should not be expected or intended to be changed directly,  
  it is better to provide setter or configurator functions (unless unavoidable and clearly documented, e.g. for array/assoc)
- A package may provide a function named `prefix` alone for special actions linked to the package.  
  The purpose must be documented.

These rules allow to clearly distinguish functions from variables. The idea is to define private members similar to 
how it is done for private javascript class members. However, as variable names are much stricter, using `#` or `:` 
is not possible there, so the pattern/convention is differen from functions.

Unless unavoidable because of code which is executed immediately, the following order shall be maintained:

- Variables first
- `public` functions, starting with the package function itself (if existing)
- `private` function
- the function sections must be enclosed by `@section`/`@endsection` shlib comment blocks.

**Note**
Due to tooling constraints with bash-language-server, shellcheck and/or the eclipse plugin 'eclipse-bash-editor',
private function names mess up parsing, outline and word completion in some situations.

For these, a slightly different code format must be used for now, or the source file will not have tooling support.

```bash
# Contrary to any other function, the block must start in the next line.
# shellcheck/bls will see this function as `prefix` only, but it will not produce syntax error
# 1. function names may not be quoted
# 2. the notation `prefix#name ()` without function keyword does not work for private functions
#    because of the parsing issues from shellcheck, which would lose the () and thus not recognize it
#    as a function, even when moving the opening { to a new line
function prefix#name
{
}

## using in ifs / test / process substitution
# quoting prevents evaluation of # as comment begin
if "prefix#name";

# in substition
var=$("prefix#name")
```

These workarounds are **not** limitations of bash and the code would parse correctly without them. They just help
make the usage of coding tools possible.
Another possible workaround would be to define a 'proxy' method which does nothing more than pass along the arguments
given to it, but there is no real benefit over just quoting the function name.

Regardless of these workarounds, the code completion provided by eclipse differs depending on the tool used:

- `bash-editor` provides word completion for private functions, but can't handle public prefixes (`prefix:`)
- Bash LS + shellcheck works in reverse. It doesn't even 'see' private functions, but can complete public function names.

</details>

<!-- generated-links -->