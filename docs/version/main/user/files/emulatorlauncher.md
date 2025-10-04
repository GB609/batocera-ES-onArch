```
--- Usage: ---
emulatorlauncher -rom <path/to/rom> [[-<propertyName> propertyOveride] ...] [[--<additionalOperation>] ...]

Starts the given game. Reads and merges all properties and configurations from batocera.conf, folder-based overrides and user overrides.
This is mainly called from 'emulationstation', but can also be used from the console for debugging and testing purposes.

Any simple property that appears in a system's configuration can be force-overriden by passing it the to emulatorlauncher.
Properties given this way with a value != 'AUTO|auto' will not be taken from any configuration file.
'Simple' properties are those with the form 'systemName.propertyName' or those that do not contain a dot at all.
'emulationstation' uses 'system', 'emulator', 'core'.

'additionalOperations' are special actions that can be used to enhance or control the output and behavior of emulatorlauncher.
They are mostly intended for debugging or internal purposes when interacting with some other launcher scripts.
Additional operations will be executed in the order given after emulatorlauncher has finished all preparation steps.
They are the last actions to be run before the actual any real action (modifying properties, notifiying listeners, launching) is taken.
Current operations are:
 * 'effectiveProperties': Prints the result of merging all property source files in shell-style.  
   For debugging only. emulatorlauncher normally sources this as code as one step of property calculation
 * 'launchConfiguration': Prints the launch command and all properties and configuration file (changes) that will be used to start the game
 * 'noRun': Just stop and exit. This is only useful in combination with 'effectiveProperties' or 'launchConfiguration'

```

