# /package

Helper to create the actual source folder containing PKGBUILD.

## Overview

This repository contains a lot of auxiliary files, configuration and scripts. On the long run,
none of those are needed for the real package. Therefore, the actual source of the arch linux 
package to build are maintained in a dedicated sub-directory.  
This script contains a few utilities to help make the 'package' sub-directory a valid and 
self-sufficient arch linux package, which could also go into a dedicated repository.

## Index

* [_generateArchive](#_generatearchive)
* [configs-dl](#configs-dl)
* [configs](#configs)
* [sources](#sources)
* [release](#release)
* [check](#check)

## _generateArchive

This is a utility function used by multiple of the steps/functions defined in this file.  
It creates an archive for the given parameters for use with PKGBUILD.  
Also creates a `*.conf` file with the necessary `sources` and `md5sum` specs.

**Outputs**
1. Archive: `package/$1.tar.gz`
2. Conf-file: `package/sources-$1.conf`

### Arguments

* **$1** (string): targetArchive name without extension
* **$2** (string): rootDir base directory to make paths relative
* **$3** (string*): files/directories to package, relative to rootDir

### Output on stdout

* progress report

## configs-dl

Download config files from several batocera and/or emulationstation related repositories.  
The entire behaviour of this function is described at [configs](#configs), this helper only 
exists to allow downloading the files without automatically producing zip files and updating the `package` 
directory.  
Will exit with code 5 when files were taken from a local archive instead

**Reason:**
The configs are also needed during tests when developing. In that case, there is no need to create and maintain the archive.

### Options

* **--force**

  when the same shall be downloaded again. must be given first.

* **--prefer-local**

  use pre-packaged files if existing

* **--file**

  to supply a revision file instead of the default cached one

### Arguments

* **$1** (string): batocera.linux revision or tag
* **$2** (string): ES-DE revision or tag
* **$3** (string): (optional) batocera-emulationstation revision or tag. Also understands 'auto' to force getting from batocera.

## configs

Given a list of revisions, this function produces a zip file containing auxiliary configuration files
which are pulled from multiple repositories.
As some of the information/revisions supplied are also relevant to PKGBUILD, the function will also produce
a sourcable script file containing some variables. This allows to avoid patching/generating PKGBUILD itself
because the PKGBUILD script can then just pull in the variables and use a constant config file name instead.  

All files produced go into the `package` sub-directory (or sub-directories therein).

Minimum required are the revisions for batocera and ES-DE. The revision of batocera-emulationstation is
normally pulled from a makefile in batocera, to ensure it matches to what the batocera config files would except.  
`-` can be used as placeholder to skip this part, this means the respective files will be used from cache.  
When there is no file in the cache and no cached revision value, the function exits with error.

This function caches downloaded files and will only re-download them if the revision supplied changes.

### Options

* **--force**

  when the same shall be downloaded again. must be given first.

* **--prefer-local**

  use pre-packaged files if existing

* **--file**

  to supply a revision file instead of the default cached one

### Arguments

* **$1** (string): batocera.linux revision or tag
* **$2** (string): ES-DE revision or tag
* **$3** (string): (optional) batocera-emulationstation revision or tag. Also understands 'auto' to force getting from batocera.

## sources

To make batocera-emulationstation fully functional, some additional executables and files are required.
Some of them don't come from batocera.linux, but instead are part of this repository:
- Regular sources are maintained in the `<repo-root>/sources/fs-root folder`.
- Tests for the package and the auxiliary applications are placed at `<repo-root>/test`.

This function generates another zip file for those sources, and a sourceable script file containing 
a source and md5sum definition for the PKGBUILD.

### Arguments

* **$1** (string): '--full' for sources and tests (default), '--so'/'--to' for sources/tests only

## release

Do whatever is necessary to make a new package version release.  
This is basically `configs` + `sources` with some more steps afterwards

## check

use various tools like namcap to verify the package


<sub>Generated with shdoc from [/package](https://github.com/GB609/batocera-ES-onArch/blob/befd01c3618b2e08a4da21972df39f296b9774b0
/scripts/package)</sub>