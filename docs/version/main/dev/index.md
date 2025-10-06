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
* [Common Paths](./files/opt/batocera-emulationstation/Common Paths.md)
* [/opt/batocera-emulationstation/interaction_helpers.lib](./files/opt/batocera-emulationstation/opt/batocera-emulationstation/interaction_helpers.lib.md)
* [/opt/batocera-emulationstation/logging.lib](./files/opt/batocera-emulationstation/opt/batocera-emulationstation/logging.lib.md)
* [Emulatorlauncher Operations](./files/opt/emulatorlauncher/Emulatorlauncher Operations.md)
* [/opt/emulatorlauncher/.controls.lib](./files/opt/emulatorlauncher/opt/emulatorlauncher/.controls.lib.md)
* [/opt/emulatorlauncher/.value-transformations.lib](./files/opt/emulatorlauncher/opt/emulatorlauncher/.value-transformations.lib.md)
* [/opt/emulatorlauncher/ports_sh_any.sh](./files/opt/emulatorlauncher/opt/emulatorlauncher/ports_sh_any.sh.md)
* [/opt/emulatorlauncher/ps2_pcsx2_any.sh](./files/opt/emulatorlauncher/opt/emulatorlauncher/ps2_pcsx2_any.sh.md)
* [/opt/emulatorlauncher/windows_installers_any_any.sh](./files/opt/emulatorlauncher/opt/emulatorlauncher/windows_installers_any_any.sh.md)
* [/opt/emulatorlauncher/wine_any.sh](./files/opt/emulatorlauncher/opt/emulatorlauncher/wine_any.sh.md)
* [/usr/bin/emulationstation-wine](./files/usr/bin/usr/bin/emulationstation-wine.md)
* [/usr/bin/emulationstation](./files/usr/bin/usr/bin/emulationstation.md)
* [/usr/bin/emulatorlauncher](./files/usr/bin/usr/bin/emulatorlauncher.md)