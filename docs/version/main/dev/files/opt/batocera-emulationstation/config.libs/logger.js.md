# /opt/batocera-emulationstation/config.libs/logger.js

## Overview

This package contains generic console/file printing utilities.
All output must go over this module to ensure it can be configured and captured in tests correctly.
There should be no raw access to console anywhere else in the productive code, with very few exceptions
if it can absolutely not be avoided, e.g. because of dependency order issues etc.


## Index

* [class Logger](#class-logger)
  * [Logger.configureGlobal](#loggerconfigureglobal)
  * [Logger.for](#loggerfor)
  * [Logger.userOnly](#loggeruseronly)
  * [Logger.apiOut](#loggerapiout)
  * [Logger.setTargetConsole](#loggersettargetconsole)

## class Logger

Handles everything related to logging and output on console. Wherever possible, output should be produced by using
one of the methods defined on `Logger`. This allows to uniformly control it and also capture it in tests.

### Logger.configureGlobal

Change the default logging configuration for all module loggers that don't give more specific configuration during creation.

#### See also

* [Logger.#writers for details on channels](#loggerwriters-for-details-on-channels)

### Logger.for

[**@return** {Logger} logger instance]

### Logger.userOnly

force output on stderr to print message not obstructing api output, visible to the user only

### Logger.apiOut

Force string to output on console stdout

### Logger.setTargetConsole

Allows to overwrite the Console instance used for stdout and stderr


<sub>Generated with shdoc from [/opt/batocera-emulationstation/config.libs/logger.js](https://github.com/GB609/batocera-ES-onArch/blob/2fcdc6d5cce3a8de9711781c90aee9a9d66303c9
/sources/fs-root/opt/batocera-emulationstation/config.libs/logger.js)</sub>