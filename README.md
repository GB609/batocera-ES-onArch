# Batocera-emulationstation on Arch Linux

❗❗ This is still a work in progress. Emulationstation will compile and start, but none of the emulators/systems works yet. I'm still working at core parts of the concept. ❗❗

This repo attempts to build an ArchLinux pacman package for batocera-emulationstation that is actually working in a **multi-user desktop environment** as one would expect while retaining most of its features and integration with the OS.
For this reason, it also contains additional config files and scripts to replicate a part of what ES expects to have been provided by the OS (batocera.linux):
* Batocera hardcodes certain application resource paths into ES via compilation switch but ES also can be configured via config file, which is what this package supplies via a delegate startup script.
* ES interfaces with (and modifies) a lot of system and emulator settings. Most of it is done by calling some scripts named 'batocera-*' or settings properties which in turn are read by scripts during OS or game start. Some of that can be replicated. Other parts will be left to the host os.

This is actually similar to what RetroBat does for windows.  
But i'm neither planning nor intending to replace `batocera.linux`, i simply place my focus on something different while still loving the richness and power of `batocera-emulationstation`.  
I'm not affiliated with `batocera.linux`, nor `batocera-emulationstation` in any way, nor is this project related to them. So please, no complaining in their channels about this project. It's not on them to support it. All credits for anything related to `batocera` belong to their owners, i'm not claiming anything. I'm only packaging `batocera-emulationstation` as is with some code of my own to make it work under ArchLinux.  
However, if there will ever be any way or topic for me to contribute back code or know-how, i will try to do so.

## Who's it for?
- Anyone who uses Arch Linux and wants to have a multi-user capable version of batocera-emulationstation as UI for a gaming pc, but more focussed on 'modern' systems like PC, Xbox, PS.
- Also if you want to keep the possibility for multi-purpose use and a traditional desktop sessions open.
- If you like to customize systems, the PC, or generally want to have the option to use additional utilities

## Who's it **not** for
If ...
- ... your goal is to quickly and easily get a box for retro-gaming without having to configure anything
- ... you want to use Mame, Retrobat (outside of my focus)
- ... or the customized/integrated version of KODI as in `batocera.linux`.
- ... you care about bezels or retroachievements
- ... you expect this to replace `batocera.linux` and implement full support for all of their systems. See [Planned Support](#planned-emulator-support)
- ... your hardware is not a x86_64 desktop
- ... you want to run it on a distro that is not based on Arch Linux/pacman because i simply don't have the time nor knowhow to support half a dozen of package managers and formats. It should still be possible to run it because i'm mostly using linux standard software, but you'd manually have to take care of building and installation.

Then this project won't likely suit your needs. Please use the original `batocera.linux` or any other similar project in that case. I can't and won't support any architecture for which Arch Linux isn't available and which i'm not using myself.

## Current state
See the project's milestones for more details.
| What | Works? | Notes |
| --- | --- | --- |
| version | 41 | current focus is creating surrounding pieces |
| PKGBUILD | (✔️) | compile and install should work, but not tested in a clean environment recently, so info might be outdated |
| Compatibility with batocera | (✔️) | Generally, features related to emulationstation itself should be compatible (if they already existed in the underlying version), provided that they are installed to the right location:<br>- config files (fully supports btc syntax)<br>- themes<br>- game system definitions/features, but launching games from any system requires code and doesnt work ootb. |
| config file generation for ES | ✔️ | - generation itself works<br>- it is possible to drop, inherit OR redefine entire property sub-trees or just singular property values |
| emulatorlauncher | (✔️) | - basic property reading/retrieval strategy done<br>- missing implementations for system handlers |
| launch games | ✖️ | no fully working system launcher yet |
| Controller GUIDE button for application menu | ✔️ | guide button should work in every game, system and application |
| Controller support | ✔️ | It's Arch Linux! Get your drivers up and running. es_input.cfg from `batocera.linx` is imported to create SDL mappings, so this might take care some of the more exotic controllers.<br>It's also possible to supply custom sdl settings with an external executable.<br>But I'm expecting to have at least ONE controller with a `GUIDE` button connected all the time. Otherwise the OS integration menu won't work and it's keyboard time. |
| Light guns | (✖️) | This project focusses on mainstream SDL based controllers. Anything you can manage to get running with a valid driver under ArchLinux is fair game, but i'm not going to focus on controller-specific quirks. Should still work if you get the driver set up correctly and the game supports light guns. |
| OS Menu | (✔️) | - basic menu exists<br>- currently only with power/shutdown options and a way to display images for the active controller->keyboard mapping |
| AntimicroX as pad2key replacement | (✔️) | - feature handling and creation of profiles done<br>- Will launch AMX when enabled (in fact, it is always active because of the GUIDE button handling, just in a different profile)<br>- editing profiles only with external tools atm. |
| Emulationstation feature/system configuration | ✖️ | incomplete + untested |
| batocera store | ✖️ | Although based on pacman, most packages use an entirely different file system structure and therefore are not compatible to Arch Linux without some kind of remapping. It is unlikely that this project will ever implement support. Even if it does, it's low prio and will be partial support at best. Aside from that, i don't think it would be nice to mooch of the original batocera store as long as i don't contribute anything back to them. | 
| ES Themes | (✔️) | Any theme compatible to `batocera-emulationstation` should work out of the box (minus API problems caused by version differences), but there is no coded way yet to retrieve and install themes. |
| Games from batocera store | ✖️ | a lot of the games are implemented as 'systems', supporting this is difficult. But should also not be necessary, because a lot of those games can also be installed on arch linux regularly and then just be linked into the 'ports' system |
| OS integration | ✖️ | it is not possible to modify OS configuration like general resolution, wifi etc. - the scripting layer of `batocera.linux` does not exist yet. |
| documentation | (✔️) | - can be auto-created locally<br>- github page currently outdated<br>- incomplete but growing<br>- mostly dev docs |
| The integrated webserver/remote control | ✖️ | Far off into the future. No point in starting this when nothing of the basics works stable right now. |
| localization | ✖️ | Missing completely, not even on the prio list. Any text not already contained in batocera-emulationstation itself will not be localized. |

## Additional features
| What | Works? | Notes |
| --- | --- | --- |
| Modularity | (✔️) | Uses a dropin.conf dir concept, so additional features/tweaks/systems can be supplied by third parties. For generic features of emulatorlauncher itself, there is no plug-in hook yet. |
| Game configuration management | ✔️ | Additional option to use `folder.conf` files to manage properties for groups of games |
| Improved wine game installation | (✔️) | The install function asks a few questions to generate meta-files needed for launching the game. Currently console-based only. |

## Details
I'm doing this as part of a greater effort to get a linux-based Xbox- or PS-like couch gaming machine with a primary focus on desktop gaming with controllers instead of retro emulation. Thus, i will not add in support myself for the same number of emulators batocera does. However, this package supports a drop-in configuration approach that allows to seamlessly integrate custom additions or even modding of inbuilt defaults.

I've initially tried batocera.linux itself, but the way it is designed and built has some shortcomings that make it unsuitable for my purpose. Roughly, the issues i see are:
* batocera mostly runs under root only (there is no real concept of users) and does a few user changes/chmods to get flatpak and steam running under root which is an unstable solution.
* The OS uses a read-only filesystem and uses a customized linux build-root to self-compile basically anything. A lot of stuff even with additional patches to hard-code application paths.
* If anything, batocera is more like a smartphone firmware. 
* No proper desktop sessions with user dbus-sessions etc.
* No standard linux FSH usage: no user homes, no multi-user. This actually makes a lot of GOG installations fail, even for native linux games. Because they try to install desktop shortcuts in `~/.local/share/applications` which doesn't exist.
* batocera.linux actively warns in its wiki that it is not a 'secure system' and should not be exposed to the internet
* Lack of utility packages. Batocera has its own store for themes, music and some free games. But one is stuck with flatpak and appimages in case any system tool, driver or other software is missing. Because the root filesystem is - like a smartphone - read only and guarded by an overlayfs, it is not easy to make extensive changes. Small patches (e.g. to config files) are possible, batocera itself has a concept for that. But any more than that is out of focus and intended purpose.

## Most notable changes and/or improvements:
 * The filesystem structure is different from `batocera`. There is no global `/userdata/[saves|ROMs]` directory.  
   All notable directories are based on `HOME` and some more env vars. In theory, the code can support a shared game library, but there are some limitations with wine based games and library management in general for now. This will be handled later on in another work i've not yet published.
 * `batocera-wine` is renamed to `emulationstation-wine`
 * Not running as root. Everything i did up until now assumes that emulationstation will be run as a regular user.  
   The code in `emulatorlauncher` and `emulationstation-wine` makes heavy use of fuse filesystems to prevent needing root.  
   As I'm progressing, i might encounter features where the code can't avoid asking for elated privileges, but i'll try to make that optional.
 * The command `emulationstation-wine install` includes a guided installer with a few questions to automate and auto-configure installation from setups, zips or CDs
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
I'm not planning to support all possible alternative emulators per system. It's enough to have one sufficiently stable emulator per system. The rest can basically be provided as optional additional packages/plugins by third parties if needed.
Selection criteria for the first set of emulators:
1. Prefer multi-system emulators to reduce the sheer amount of different config file syntaxes, structures, flavors and variants as well as dependencies. Excluding RetroArch because of personal preference.
2. Prefer emulators that provide some kind of command line argument to dynamically change the configuration file that is read
3. Prefer emulators with a well-documented configuration structure
4. Native before appimage, if native is maintained and up-to-date. Appimage otherwise.
5. appimage before flatpak. Avoid flatpaks provided by third parties (not maintained by emulator devs themselves). The flatpak isolation is just too troublesome.

**Initial support planned for (order roughly corresponds to priority)**
1. Wine vanilla native: anything related to windows. Support for umu with GE-Proton might be added in the future.
   Umu is prepared in configurations as core, but ignored by emulationstation-wine for now
2. Xenia-Canary: xbox360
3. Xemu: xbox
4. PCSX2: PS2
5. Mesen2: NES / SNES / GB(C) / GBA
6. DuckStation: PS1
7. melonDS: DS/DSi
8. Dolphin: GameCube / Wii
9. RMG: nintendo64

I'm also considering to add adapters/emulators for steam and gog (utilizing exising projects), but they will most likely be optional additional packages that will follow once the basics are done.

## Thanks
- Thanks to everyone involved in the development of `batocera.linux` and `batocera-emulationstation`.
- Also thanks to the developers of `Emulationstation Desktop Edition` from which i also pulled a few ideas and inspirations (as well as a certain config file)
