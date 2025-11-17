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

* /opt
  * /batocera-emulationstation
    * [amx.lib](./files/opt/batocera-emulationstation/amx.lib.md)
    * [btc-config](./files/opt/batocera-emulationstation/btc-config.md)
    * [common-paths.lib](./files/opt/batocera-emulationstation/common-paths.lib.md)
    * /config.libs
      * [cmdline-api.js](./files/opt/batocera-emulationstation/config.libs/cmdline-api.js.md)
      * [cmdline-descriptions.js](./files/opt/batocera-emulationstation/config.libs/cmdline-descriptions.js.md)
      * [config-import.js](./files/opt/batocera-emulationstation/config.libs/config-import.js.md)
      * [controllers.js](./files/opt/batocera-emulationstation/config.libs/controllers.js.md)
      * [data-utils.js](./files/opt/batocera-emulationstation/config.libs/data-utils.js.md)
      * [logger.js](./files/opt/batocera-emulationstation/config.libs/logger.js.md)
      * [output-formats.js](./files/opt/batocera-emulationstation/config.libs/output-formats.js.md)
      * [parsing.js](./files/opt/batocera-emulationstation/config.libs/parsing.js.md)
      * [path-utils.js](./files/opt/batocera-emulationstation/config.libs/path-utils.js.md)
      * [qt-keys.js](./files/opt/batocera-emulationstation/config.libs/qt-keys.js.md)
    * [interaction_helpers.lib](./files/opt/batocera-emulationstation/interaction_helpers.lib.md)
    * [logging.lib](./files/opt/batocera-emulationstation/logging.lib.md)
    * /support
      * [global-settings](./files/opt/batocera-emulationstation/support/global-settings.md)
      * [os-menu](./files/opt/batocera-emulationstation/support/os-menu.md)
  * /emulatorlauncher
    * [.operations.lib](./files/opt/emulatorlauncher/operations.lib.md)
    * /lib
      * [.controls.lib](./files/opt/emulatorlauncher/lib/controls.lib.md)
      * [.operations.lib](./files/opt/emulatorlauncher/lib/operations.lib.md)
      * [.value-transformations.lib](./files/opt/emulatorlauncher/lib/value-transformations.lib.md)
    * [ports_sh_any.sh](./files/opt/emulatorlauncher/ports_sh_any.sh.md)
    * [ps2_pcsx2_any.sh](./files/opt/emulatorlauncher/ps2_pcsx2_any.sh.md)
    * [windows_installers_any_any.sh](./files/opt/emulatorlauncher/windows_installers_any_any.sh.md)
    * [wine_any.sh](./files/opt/emulatorlauncher/wine_any.sh.md)
* /usr
  * /bin
    * [emulationstation](./files/usr/bin/emulationstation.md)
    * [emulationstation-wine](./files/usr/bin/emulationstation-wine.md)
    * [emulatorlauncher](./files/usr/bin/emulatorlauncher.md)