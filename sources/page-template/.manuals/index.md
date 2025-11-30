---
---

# batocera-es-onArch {{ page.VERSION }}

For brevity, btc-es will be used instead of the full title through this documentation.

## User Manual: Quickstart

### How to install

1. Check out repo
2. Select version by checking out the corresponding tag
3. run makepkg
4. Install the build package 'batocera-es-on-arch' with required dependencies
5. Install additional dependencies

As copy-paste solution (I'll omit the usual warnings from ArchLinux about user-provided software like the AUR):

```sh
git clone https://github.com/GB609/batocera-ES-onArch.git
cd batocera-es-on-arch/package
{% if page.VERSION_IS_TAG == true %}
git checkout tags/{{ page.VERSION }}
{% else %}
git checkout {{ page.VERSION }}
{% endif %}
makepkg -i -s --needed --asdeps
```

A pre-built package might be supplied in the future.

### Install games

This works similar to how it works in `batocera` (see [Batocera: Add games or roms](https://wiki.batocera.org/add_games_bios)).
**Note:** btc-es does not provide or expose a network share for the ROMs folder by itself.

1. Get some way to access the file system via ssh, scp, ftp or file-explorer (when directly at the machine)
2. Open the directory where Roms are located.  
   **Difference to batocera.linux**: The default location that btc-es uses is `~/ROMs`.  
   However, this can be controlled/configured via command line parameter OR environment variable.  
   There are also more advanced ways to configure different folders on a system-by-system level with custom `es_system.cfg` overrides.
3. Move/copy your games to the correct subfolders

**Notes:**

1. btc-es does not support the same number of emulators and - consequently - not necessarily the full list of file types within the systems.
2. For the full details of supported types for wine, refer to [emulationstation-wine](./user/files/emulationstation-wine.md)


### Start emulationstation

```sh
# points to /usr/bin/emulationstation
emulationstation [--home some/path] [--romdir some/path]
```

### Console Commands + arguments

Refer to the details in [Program documentation](./user/index.md)

## Developer Manual

**Note:**  
This package does not conform to the standard AUR way of packaging where the `PKGBUILD` repo should not contain any more sources (aside from patches).  
The current structure was chosen because batocera-emulationstation is not functional without any supporting files and/or binaries. It just does not make any sense to provide it without additions. Splitting stuff up here would just complicate development and versioning without any real benefits.

1. Checkout out sources
2. Install `depends` and `makedepends` found in `PKGBUILD` where required when planning to compile anything

This package uses the node test runner as framework for any kind of tests.

All 'real' sources, which will be added to the package, are in `sources/fs-root`.

For full details see [Source documentation](./dev/index.md)

<!-- generated-links -->