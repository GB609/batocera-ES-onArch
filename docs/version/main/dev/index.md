# Developer Documentation

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


## Subchapters
* [interaction_helpers.lib.md](./files/opt/batocera-emulationstation/interaction_helpers.lib.md)
* [logging.lib.md](./files/opt/batocera-emulationstation/logging.lib.md)
* [.controls.lib.md](./files/opt/emulatorlauncher/.controls.lib.md)
* [.value-transformations.lib.md](./files/opt/emulatorlauncher/.value-transformations.lib.md)
* [ports_sh_any.sh.md](./files/opt/emulatorlauncher/ports_sh_any.sh.md)
* [ps2_pcsx2_any.sh.md](./files/opt/emulatorlauncher/ps2_pcsx2_any.sh.md)
* [windows_installers_any_any.sh.md](./files/opt/emulatorlauncher/windows_installers_any_any.sh.md)
* [wine_any.sh.md](./files/opt/emulatorlauncher/wine_any.sh.md)