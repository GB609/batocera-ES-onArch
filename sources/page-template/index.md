# ArkStation: Batocera Emulationstation for ArchLinux
  
Welcome to the homepage of my project 'Batocera Emulationstation for ArchLinux'. Since this is a very long and verbose name, i'll just use **ArkStation** in the future.

ArkStation is one piece of a bigger effort to get a console-like gaming PC and the first package that can also be used individually. My final goal is to use ArkStation as main UI of a controller-based couch gaming pc while being able to handle most basic OS settings without having to go to the console or another (regular) desktop environment.  
However, i don't want to lose the capabilities a full-blown desktop pc has in terms of software availability and configurability.

The goal of this specific package is to 'rip out' batocera-emulationstation of the heavily customized, none-default operating system structure that is `batocera.linux` and make it run under a regular linux user, all with configuration and save data saved for each user individually.  
Something like this has been done before for Windows, see RetroBat for details. However, aside from basing my work on `batocera-emulationstation` i'm not affiliated in any way with Batocera nor RetroBat.  
The main advantage of this is the access to much more drivers, kernel modules and utilities achieved by tapping into a large and well maintained mainstream linux distribution.

More packages will follow in the future which add deeper integration into the OS, the possibility of shared game libraries and basic access right management.

For now, you can check out more details about the rationale, my reasons and motivation in the repository's [README](https://github.com/GB609/batocera-ES-onArch?tab=readme-ov-file#readme-ov-file).

<details>
  <summary><strong>Why this effort, aren't there other variants and forks of emulationstation or stuff like Lakka?</strong></summary>
  <blockquote>
I thought about this and evaluated ES-DE (version 3.0.3):<br>
It is a great piece of software in and of itself, but it lacks the external hooks and configuration capabilities i need for a deeper integration with the OS at the end.<br>
Moreover, i think batocera-emulationstation's support for custom systems, custom collections and system grouping is much better.<br>
And its media file management is less hardcoded, but depending on gamelist.xml data which makes it more suitable to a shared-library setup.
<br><br>
Lakka is too similar to batocera for my taste. Its UI is also based on RetroArch, which i personally don't like.
  </blockquote>
</details>

This page will contain manuals, developer documentation (maybe test + coverage results) and installation instructions in the future.

There will be one sub-section for each release and the master branch.

## Quickstart

### Installation

```sh
git clone https://github.com/GB609/batocera-ES-onArch.git
cd batocera-es-on-arch
git checkout tags/LATEST
makepkg -i -s --needed --asdeps
```

### Adding games
Copy/move files to `~/ROMs/<system>` as you would do for batocera.  
**Note:** There is no `SHARE` or `/userdata`!

### Starting
Run

```sh
emulationstation
```

### Configuration

It depends on what shall be configured:
1. Global keys ([G]), not directly related to systems/emulators. There is only partial support for this at the moment.  
   Only those keys which also serve as global defaults for system-based configuration are supported and only when launching games.  
   Properties that control OS behavior or integration are not yet supported.
2. Settings for systems ([S]), either default or specific to games

Configuration files and locations:

1. **[S]** Use the emulationstation UI - user specific properties for roms/systems/emulators are written to `$ES_CONFIG_HOME/es_settings.cfg` by emulationstation.  
   Default for `ES_CONFIG_HOME` is `$XDG_CONFIG_HOME/emulationstation`  
   This allows to configure everything defined in any system-wide or user-specific `es_features.cfg` file.
2. **[G][S]** Edit files directly located in `/etc/batocera-emulationstation/conf.d`  
   **Note:** This is not a permanent solution. These files are auto-generated and will be recreated on the next pacman update  
   or whenever `btc-config generateGlobalConfig` is used.
3. **[G][S]** Place a custom drop-in file one of the subdirectories of `/etc/batocera-emulationstation/conf.d/`,  
   followed by the command `sudo /opt/batocera-emulationstation/btc-config generateGlobalConfig`  
   This is useful to change global defaults and add custom systems for all users.
4. **[S]** Place a file named `folder.conf` in one of the `~ROMs/system/` root directories.  
   Can change any property, but these files will only be read when `emulatorlauncher` starts a game, so placing OS-related global properties will not have any effect.

## [Documentation of releases](./version/index.md)

