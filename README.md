# Batocera-emulationstation on Arch Linux

❗ This is still a very early draft. It will compile and start, but none of the emulators/systems works yet. I'm still thinking about some core parts of the configuration concept. ❗

This repo attempts to build an arch linux pacman package for batocera-emulationstation that is actually working in a multi-user desktop environment as one would expect while retaining most of its features and integration with the OS.
For this reason, it also contains additional config files and scripts to replicate a part of what ES expects to have been provided by the OS (batocera.linux):
* Batocera hardcodes certain application resource paths into ES via compilation switch but ES also can be configured via config file, which is what this package supplies via a delegate startup script.
* ES interfaces with and modifies a lot of system and emulator settings. Most of it is done by calling some scripts named 'batocera-*' or settings properties which in turn are read by scripts during OS or game start. Some of that can be replicated. Other parts will be left to the host os.

This is actually similar to what RetroBat does for/on windows.

I'm doing this as part of a greater effort to get a linux-based Xbox- or PS-like couch gaming machine with a primary focus on desktop gaming with controllers instead of retro emulation. Thus, i will not add in support myself for the same number of emulators batocera does. However, this package supports a drop-in configuration approach that allows to seamlessly integrate custom additions or even modding of inbuilt defaults.

I've initially tried batocera.linux itself, but the way it is designed and built has some shortcomings that make it very unsuitable for this purpose. I'm not going into full detail, but roughly these are:
* batocera mostly runs under root only (there is no real concept of users) and does a few very hacky user changes/chmods to get flatpak and steam running under root which breaks them all the time.
* The OS uses a read-only filesystem and uses a customized linux build-root to self-compile basically anything. A lot of stuff even with additional patches to hard-code application paths.
* If anything, batocera is more like a smartphone firmware. 
* No proper desktop sessions with user dbus-sessions etc.
* No standard linux FSH, no user homes, no multi-user. This actually makes a lot of GOG installations fail, even for native linux games. Because they try to install desktop shortcuts in `~/.local/share/applications` which doesn't exist.
* batocera.linux actively warns in its wiki that it is not a 'secure system' and should not be exposed to the internet
* Lack of utility packages. Batocera has its own store for themes, music and some free games. But one is stuck with flatpak and appimages in case any system tool, driver or other software is missing unless willing to go through the complicated procedure of setting up a compilation/building machine as the running batocera instance itself is not fit for this purpose.

## Most notable changes and/or improvements:
 * The filesystem structure is different from `batocera`. There is no global `/userdata/[saves|ROMs]` directory.  
   All notable directories are based on `HOME` and some more env vars. In theory, the code can support a shared game library, but there are some limitations with wine based games and library management in general for now. This will be handled later on in another work i've not yet published.
 * batocera-wine is renamed to emulationstation-wine
 * Not running as root. Everything i did up until now assumes that emulationstation will be run as a regular user.  
   The code in `emulatorlauncher` and `emulationstation-wine` makes heavy use of fuse filesystems to prevent needing root.  
   As I'm progression, i might encounter features where the code can't avoid asking for elated privileges, but i'll try to make that optional.
 * emulationstation-wine install includes a guided installer with a few questions to automate and auto-configure installation from setups, zips or cds
 * reworked known/used config files and file formats including a conf.d-style drop-in concept. This opens a way to add support for new systems and/or emulators with dedicated (optional) pacman packages
 * Introduced several environment variables that can be used to configure and change the locations of the directories which emulationstation uses:  
    - `HOME`: Controls how `~` is resolved. Most other path resolve as subdirectories of HOME by default if not specified differently.
    - `ES_HOME`: Root directory where user-based configuration is placed and read from
    - `ROMS_ROOT_DIR`: If not defined/hard coded by a system configuration, this path is used to resolve relative paths to roms
    - `SAVES_ROOT_DIR`: Root directory for all save files. The relative sub-directory structure will be a  identical to the rom's system-relative sub-directory structure  
   By default, most of these directories will be placed somewhere under one of the `XDG_...` directories.
 * expanded game configuration options: The 'new' emulatorlauncher searches files named `folder.conf` in the directory hierarchy of a game when launching it and merges them to the global configuration.  
   This allows to override properties and defaults for entire folders full of roms. Not supported by the UI (yet). This is basically an upgrade of the original `batocera.conf` syntax variant `systemName.folder["some/path"].propertyName`.  
   The search only picks up `folder.conf` files, if they are in a parent directory of the rom that was started. Sibling folders or their subfolders are **NOT** parsed.  
   Merge order is from least specific (`ROMs/system/folder.conf`) to most specific:  
    - `ROMs/system/subdir1/folder.conf`
    - `ROMs/system/subdir2/...`
    - `ROMs/system/subdir1/subdir2/fullpath/romfile/folder.conf` - for roms that are not files but directories, e.g. `ROMs/windows/somegame.wine`. Ignored on others.
    - `ROMs/system/subdir1/subdir2/fullpath/romfile.conf` - can be used as a replacement for game specific settings in the ui when multiple roms share one directory
    - `$HOME/es_settings.cfg` - for game specific settings set in the UI  
 * The executable 'emulatorlauncher' provided by this package is a completely new, rewritten application and not related to the equally named program from `batocera.linux`.  
   Configgen was dropped as well, as it is an internal part of the batocera `emulatorlauncher`.  
   Reason: `emulatorlauncher` and `configgen` are integrated into the build process of `batocera.linux` too tightly. Moreover, they are expecting the file system structure of batocera.linux. I figured it'd be less work and easier to maintain the code in the long run if it's something new rather than partial stuff ripped out of `batocera.linux`'s build process (which would need a lot of patches afterwards). There's also a bit of a personal preference in terms of programming languages at play here.

## Planned emulator support:
I'm not planning to support all possible alternative emulators per system. It's enough to have one sufficiently stable emulator per system.
Selection criteria for the first set of emulators:
1. Prefer multi-system emulators to reduce the sheer amount of different config file syntaxes, structures, flavors and variants as well as dependencies. Excluding RetroArch because of personal preference.
2. Prefer emulators that provide some kind of command line argument to dynamically change the configuration file that is read
3. Prefer emulators with a well-documented configuration structure
4. Native before appimage, if native is maintained and up-to-date. Appimage otherwise.
5. appimage before flatpak. Avoid flatpaks provided by third parties (not maintained by emulator devs themselves)

**Initial support planned for (order roughly corresponds to priority)**
1. Wine vanilla native: anything related to windows. Support for umu with GE-Proton might be added in the future
2. Xenia-Canary: xbox360
3. Xemu: xbox
4. PCSX2: PS2
5. Mesen2: NES / SNES / GB(C) / GBA
6. DuckStation: PS1
7. melonDS: DS/DSi
8. Dolphin: GameCube / Wii
9. RMG: nintendo64
