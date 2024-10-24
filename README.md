# Batocera-emulationstation on Arch Linux

! This is still a very early draft. It will compile and start, but none of the emulators/systems works yet. I'm still thinking about some core parts of the configuration concept. !

This repo attempts to build an arch linux pacman package for batocera-emulationstation that is actually working in a multi-user desktop environment as one would expect while retaining most of its features and integration with the OS.
For this reason, it also contains additional config files and scripts to replicate a part of what ES expects to have been provided by the OS (batocera.linux):
* Batocera hardcodes certain application resource paths into ES via compilation switch but ES also can be configured via config file, which is what this package supplies via a delegate startup script.
* ES interfaces with and modifies a lot of system and emulator settings. Most of it is done by calling some scripts named 'batocera-*' or settings properties which in turn are read by scripts during OS or game start. Some of that can be replicated.

I'm doing this as part of a greater effort to get a linux-based Xbox- or PS-like couch gaming machine with a primary focus on desktop gaming with controllers instead of retro emulation. 
I've initially tried batocera.linux itself, but the way it is designed and built has some shortcomings that make it very unsuitable for this purpose. I'm not going into full detail, but roughly these are:
* batocera mostly runs under root only (there is no real concept of users) and does a few very hacky user changes/chmods to get flatpak and steam running under root which breaks them all the time.
* The OS uses a read-only filesystem and uses a customized linux build-root to self-compile basically anything. A lot of stuff even with additional patches to hard-code application paths. Also missing a few very basic linux console tools and binaries.
* If anything, batocera is more like a smartphone firmware. 
* No proper desktop sessions with user dbus-sessions etc.
* No standard linux FSH, no user homes, no multi-user. This actually makes a lot of GOG installations fail, even for native linux games.
* batocera.linux actively warns in its wiki that it is not a 'secure system' and should not be exposed to the internet
* Lack of packages. Batocera has its own store for themes, music and some free games. But one is stuck with flatpak and appimages in case any system tool, driver or other software is missing unless willing to go through the complicated procedure of setting up a compilation/building machine as the running batocera instance itself is not fit for this purpose.
