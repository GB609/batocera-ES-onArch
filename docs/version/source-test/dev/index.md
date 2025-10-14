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
* [/opt/batocera-emulationstation/btc-config](./files/opt/batocera-emulationstation/btc-config.md)
* [/opt/batocera-emulationstation/common-paths.lib](./files/opt/batocera-emulationstation/common-paths.lib.md)
* [/opt/batocera-emulationstation/config.libs/cmdline-api.js](./files/opt/batocera-emulationstation/config.libs/cmdline-api.js.md)
* [/opt/batocera-emulationstation/config.libs/cmdline-descriptions.js](./files/opt/batocera-emulationstation/config.libs/cmdline-descriptions.js.md)
* [/opt/batocera-emulationstation/config.libs/config-import.js](./files/opt/batocera-emulationstation/config.libs/config-import.js.md)
* [/opt/batocera-emulationstation/config.libs/data-utils.js](./files/opt/batocera-emulationstation/config.libs/data-utils.js.md)
* [/opt/batocera-emulationstation/config.libs/logger.js](./files/opt/batocera-emulationstation/config.libs/logger.js.md)
* [/opt/batocera-emulationstation/config.libs/output-formats.js](./files/opt/batocera-emulationstation/config.libs/output-formats.js.md)
* [/opt/batocera-emulationstation/config.libs/parsing.js](./files/opt/batocera-emulationstation/config.libs/parsing.js.md)
* [/opt/batocera-emulationstation/config.libs/path-utils.js](./files/opt/batocera-emulationstation/config.libs/path-utils.js.md)
* [/opt/batocera-emulationstation/interaction_helpers.lib](./files/opt/batocera-emulationstation/interaction_helpers.lib.md)
* [/opt/batocera-emulationstation/logging.lib](./files/opt/batocera-emulationstation/logging.lib.md)
* [/opt/emulatorlauncher/.controls.lib](./files/opt/emulatorlauncher/controls.lib.md)
* [/opt/emulatorlauncher/.operations.lib](./files/opt/emulatorlauncher/operations.lib.md)
* [/opt/emulatorlauncher/ports_sh_any.sh](./files/opt/emulatorlauncher/ports_sh_any.sh.md)
* [/opt/emulatorlauncher/ps2_pcsx2_any.sh](./files/opt/emulatorlauncher/ps2_pcsx2_any.sh.md)
* [/opt/emulatorlauncher/.value-transformations.lib](./files/opt/emulatorlauncher/value-transformations.lib.md)
* [/opt/emulatorlauncher/windows_installers_any_any.sh](./files/opt/emulatorlauncher/windows_installers_any_any.sh.md)
* [/opt/emulatorlauncher/wine_any.sh](./files/opt/emulatorlauncher/wine_any.sh.md)
* [/usr/bin/emulationstation-wine](./files/usr/bin/emulationstation-wine.md)
* [/usr/bin/emulationstation](./files/usr/bin/emulationstation.md)
* [/usr/bin/emulatorlauncher](./files/usr/bin/emulatorlauncher.md)