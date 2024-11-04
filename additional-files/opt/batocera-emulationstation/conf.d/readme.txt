The files in this directory are not read by batocera-emulationstation directly. 
They are source files used during PKGBUILD in the command 'config.js importBatoceraConfig' 
to generate a set of merged system-wide default configuration files for the package.

These files are included in the resulting package for the sake of completeness and debugging, but should
not be needed as the imported property files are placed in /etc/batocera-emulationstation and
can be changed if required. However, every property can also be overridden on a per-user basis.