# /usr/bin/emulationstation

```
--- usage: ---
emulationstation [--home path/to/home] [--romdir path/to/romdir]

This is a configuration wrapper around the real executable '/opt/batocera-emulationstation/bin/emulationstation'.
It is used to create and supply the custom configuration needed to make it multi-user capable.
This wrapper supports and uses all paths defined in 'common-paths'
--home and --romdir allow to override the paths used for ES_HOME and ROMS_ROOT_DIR respectively.
All (other) paths can be customized by supplying the corresponding environment variable.
```
<sub>(Directly retrieved from the executable's help function)</sub>  

Configuration wrapper around the 'real' executable of batocera-emulationstation (/opt/batocera-emulationstation/bin/emulationstation).

## Overview

This script attempts to pre-configure emulationstation to roughly conform to XDG specifications.

How:
1. This script takes and passes through all arguments given to it. 
It behaves like an invisible proxy for the real executable that applies a bit of preconfiguration.

2. The call to the real executable will always be run with '--home homepath' to get more control over the path.
If '--home homedir' is not given as argument to this script, it will be set to default /home/user.
ES automatically assumes and creates a directory named '.emulationstation' under homedir.
The homedir given to ES is also used for ~ expansion in es_systems.cfg. If it was located under XDG_CONFIG_HOME, 
any path in es_systems.cfg using ~ would be resolved relative to XDG_CONFIG_HOME, which is not desirable and not
the correct location for Roms. Thus, the default home must remain, but the subdir .emulationstation will instead
by created as a link to XDG_CONFIG_HOME/emulationstation.     

3. ES knows and uses several additional paths/folders for music, themes etc which are normally all resolved relative to homedir
or, when compiled with BATOCERA switch, hardcoded to certain subdirectories of /userdata. 
The none-BATOCERA lookup works like following:
a) First a file named "emulationstation.ini" is searched for in 3 places and in the order given:
- In the same directory as the executable
- In homedir/.emulationstation
- In homedir/.emulationstation/..
b) The first directory found this way is taken as base for relative paths to other resource dirs.
Any such path that resolves to an existing directory is taken.
c) The emulationstation.ini found during a) is parsed as property file. Almost all system and user-specific resource dirs
can be overridden here by adding the correct property.   

4. This script will now generate a customized path config file at homedir/.emulationstation/emulationstation.ini.
With this, the paths detected during step 3.b) are manually corrected after dynamic lookup.
This is required because emulationstation resolves all directories relative to emulationstation.ini in a broken way:
It uses parentDirOf(emulationstation.ini)/../folderName for various resource folders, which is 
illogical/wrong in almost all cases. 

Broken examples of folder autodetect:
a) /opt/batocera-emulationstation/emulationstation + /opt/batocera-emulationstation/emulationstation.ini 
expects folders named {log,music,saves,themes,decorations,shaders} and some more in either
- homedir/foldername (for user overrides to system resources) 
(note: NOT in .emulationstation subdir, it deliberately goes up one directory from there) OR
- /opt/batocera-emulationstation/../foldername
- /opt/batocera-emulationstation/../system/foldername
b) /home/user/.emulationstation/emulationstation.ini
expects folders named {log,music,saves,themes,decorations,shaders} and some more in either
- /home/user/.emulationstation/foldername
- /home/user/system/foldername
- /home/user/foldername

5. This script generates the file emulationstation.ini only if it does not exist,  
OR when it exists and it does NOT contain a line `autocreate=false`.  
This is done to allow user modifications if desired, although nothing can then be done about misconfigurations.  
That's the users responsibility.

Apart from the ini file and (optional) home adjustment, all arguments are passed to the real emulationstation binary as given to this script.

Please note that this script only works correctly under the assumption that there is no 'default' emulationstation.ini
directly next to the binary in /opt/batocera-emulationstation because ES checks this location first.
As it is a property file, paths containing ~ are possible, but no variables are expanded. Thus, no XDG env var would work here.
And changing the system-owned read-only property file whenever a user starts ES is a bad idea.


<sub>Generated with shdoc from [/usr/bin/emulationstation](https://github.com/GB609/batocera-ES-onArch/blob/befd01c3618b2e08a4da21972df39f296b9774b0
/sources/fs-root/usr/bin/emulationstation)</sub>