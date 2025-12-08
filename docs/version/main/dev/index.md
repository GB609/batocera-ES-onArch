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


<div id="sidemenu">
<h2>Subchapters</h2>
<ul>
<li><a href="./tools/index.html">Developer Tools</a></li>
<li>/opt</li>
<ul>
<li>/batocera-emulationstation</li>
<ul>
<li><a href="./files/opt/batocera-emulationstation/btc-config.html">btc-config</a></li>
<li><a href="./files/opt/batocera-emulationstation/cfg.js.html">cfg.js</a></li>
<li>/lib</li>
<ul>
<li><a href="./files/opt/batocera-emulationstation/lib/amx.lib.html">amx.lib</a></li>
<li><a href="./files/opt/batocera-emulationstation/lib/interaction_helpers.lib.html">interaction_helpers.lib</a></li>
<li><a href="./files/opt/batocera-emulationstation/lib/logging.lib.html">logging.lib</a></li>
<li><a href="./files/opt/batocera-emulationstation/lib/user-paths.lib.html">user-paths.lib</a></li>
</ul>
<li>/node_modules</li>
<ul>
<li><a href="./files/opt/batocera-emulationstation/node_modules/batocera-paths.js.html">batocera-paths.js</a></li>
<li>/cmdline</li>
<ul>
<li><a href="./files/opt/batocera-emulationstation/node_modules/cmdline/api.js.html">api.js</a></li>
<li><a href="./files/opt/batocera-emulationstation/node_modules/cmdline/help.js.html">help.js</a></li>
</ul>
<li><a href="./files/opt/batocera-emulationstation/node_modules/config-import.js.html">config-import.js</a></li>
<li><a href="./files/opt/batocera-emulationstation/node_modules/controllers.js.html">controllers.js</a></li>
<li><a href="./files/opt/batocera-emulationstation/node_modules/effective-values.js.html">effective-values.js</a></li>
<li>/io</li>
<ul>
<li><a href="./files/opt/batocera-emulationstation/node_modules/io/parsers.js.html">parsers.js</a></li>
<li><a href="./files/opt/batocera-emulationstation/node_modules/io/writers.js.html">writers.js</a></li>
</ul>
<li><a href="./files/opt/batocera-emulationstation/node_modules/logger.js.html">logger.js</a></li>
<li><a href="./files/opt/batocera-emulationstation/node_modules/qt-keys.js.html">qt-keys.js</a></li>
<li>/utils</li>
<ul>
<li><a href="./files/opt/batocera-emulationstation/node_modules/utils/data.js.html">data.js</a></li>
<li><a href="./files/opt/batocera-emulationstation/node_modules/utils/path.js.html">path.js</a></li>
</ul>
</ul>
<li>/support</li>
<ul>
<li><a href="./files/opt/batocera-emulationstation/support/global-settings.html">global-settings</a></li>
<li><a href="./files/opt/batocera-emulationstation/support/os-menu.html">os-menu</a></li>
</ul>
<li><a href="./files/opt/batocera-emulationstation/user-paths.lib.html">user-paths.lib</a></li>
</ul>
<li>/emulatorlauncher</li>
<ul>
<li>/lib</li>
<ul>
<li><a href="./files/opt/emulatorlauncher/lib/controls.lib.html">.controls.lib</a></li>
<li><a href="./files/opt/emulatorlauncher/lib/operations.lib.html">.operations.lib</a></li>
<li><a href="./files/opt/emulatorlauncher/lib/value-transformations.lib.html">.value-transformations.lib</a></li>
</ul>
<li><a href="./files/opt/emulatorlauncher/ports_sh_any.sh.html">ports_sh_any.sh</a></li>
<li><a href="./files/opt/emulatorlauncher/ps2_pcsx2_any.sh.html">ps2_pcsx2_any.sh</a></li>
<li><a href="./files/opt/emulatorlauncher/windows_installers_any_any.sh.html">windows_installers_any_any.sh</a></li>
<li><a href="./files/opt/emulatorlauncher/wine_any.sh.html">wine_any.sh</a></li>
</ul>
</ul>
<li>/usr</li>
<ul>
<li>/bin</li>
<ul>
<li><a href="./files/usr/bin/emulationstation.html">emulationstation</a></li>
<li><a href="./files/usr/bin/emulationstation-wine.html">emulationstation-wine</a></li>
<li><a href="./files/usr/bin/emulatorlauncher.html">emulatorlauncher</a></li>
</ul>
</ul>
</ul>
</div>
