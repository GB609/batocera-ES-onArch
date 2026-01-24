#!/bin/bash

# SPDX-FileCopyrightText: 2026 Karsten Teichmann
#
# SPDX-License-Identifier: MIT

AUTHOR="--copyright=Karsten Teichmann"
YEAR="--year=${YEAR:-$(date +%Y)}"
LICENSE="--license=${LICENSE:-MIT}"

declare -A STYLES
STYLES[lib]="python"
STYLES[js]="cpp"
STYLES[mjs]="cpp"
STYLES[sh]="python"
STYLES[md]="html"

shopt -s globstar
shopt -s extglob
shopt -s dotglob

if [ "$1" = "--contributor" ]; then
  shift
  CONTRIBUTOR="--contributor=$1"
  shift
  for f in "$@"; do
    filename="${f%.*}"
    ext="${f##*.}"
    echo "EXT: $ext"
    reuse annotate "$CONTRIBUTOR" "$YEAR" -s "${STYLES[$ext]:-$ext}" "$f"
  done
  exit 0
elif [ "$#" -gt 0 ]; then
  echo "Unrecognized option: $1" >&2
  exit 1
fi

for ext in "${!STYLES[@]}"; do
  echo "Adding SPDX-headers to '$ext'-files" >&2
  reuse annotate "$AUTHOR" "$YEAR" "$LICENSE" -s "${STYLES[$ext]}" @(scripts|sources|test)/**/*."$ext"
done

# scripts in /usr/bin
reuse annotate "$AUTHOR" "$YEAR" "$LICENSE" -s "${STYLES[sh]}" sources/fs-root/usr/bin/**