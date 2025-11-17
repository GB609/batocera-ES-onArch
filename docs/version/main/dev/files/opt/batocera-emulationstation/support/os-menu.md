# /opt/batocera-emulationstation/support/os-menu

```
/home/runner/work/batocera-ES-onArch/batocera-ES-onArch/sources/fs-root/opt/batocera-emulationstation/support/os-menu: line 9: _hasFunc: command not found
/home/runner/work/batocera-ES-onArch/batocera-ES-onArch/sources/fs-root/opt/batocera-emulationstation/support/os-menu: line 26: _hasFunc: command not found
/home/runner/work/batocera-ES-onArch/batocera-ES-onArch/sources/fs-root/opt/batocera-emulationstation/support/os-menu: line 44: _hasFunc: command not found
/home/runner/work/batocera-ES-onArch/batocera-ES-onArch/sources/fs-root/opt/batocera-emulationstation/support/os-menu: line 65: _hasFunc: command not found
/home/runner/work/batocera-ES-onArch/batocera-ES-onArch/sources/fs-root/opt/batocera-emulationstation/support/os-menu: line 82: --help: command not found
/home/runner/work/batocera-ES-onArch/batocera-ES-onArch/sources/fs-root/opt/batocera-emulationstation/support/os-menu: line 82: _logAndOut: command not found
```
<sub>(Directly retrieved from the executable's help function)</sub>  

## Overview

Show/Hide images for the current profile mapping when 'Y' is pressed.


## Index

* [shutdown](#shutdown)
* [show](#show)
* [openMenu](#openmenu)

## shutdown

Shortcut function to directly open the shutdown submenu.  
Used when the 'GUIDE' button is pressed again while in 'navigation' mode. Has 2 modes of operation:
1. When the menu is open already, jump to the submenu 'shutdown'
2. Otherwise open the menu itself first.

The second mode is required to ensure consistent controlling, as the menu might somehow have been closed without
going back to 'set 1'. In that case the controls would be stuck because the 'GUIDE' button operates differently
in 'navigation' mode.

## show

Main entry point and function. Defines the menu itself and passes it to `[openMenu].

## openMenu

Encapsulates building and showing a pre-defined menu.  
This function just passed through the argument array on stdin to jgmenu and adds some command line arguments.  
If `$_PRE_SELECT` is set to the name of a valid submenu, `--checkout=$_PRE_SELECT` will be added to directy 
open the respective submenu.


<sub>Generated with shdoc from [/opt/batocera-emulationstation/support/os-menu](https://github.com/GB609/batocera-ES-onArch/blob/2fcdc6d5cce3a8de9711781c90aee9a9d66303c9
/sources/fs-root/opt/batocera-emulationstation/support/os-menu)</sub>