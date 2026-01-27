#!/bin/bash

# SPDX-FileCopyrightText: 2026 Karsten Teichmann
#
# SPDX-License-Identifier: MIT

AUTHOR="--copyright=Karsten Teichmann"
YEAR="--year=${YEAR:-$(date +%Y)}"
LICENSE="--license=${LICENSE:-MIT}"

# A simple proxy which is is meant to filter out files that shall not be annotated
function reuse {
  local otherArgs=()
  local realFileArgs=()
  local skipTag=""
  
  for arg in "$@"; do
    if ! [ -f "$arg" ]; then
      otherArgs+=("$arg")
      continue
    fi 

    skipTag=$(head -n 2 "$arg" | grep -o '#REUSE:SKIP#')
    if [ -n "$skipTag" ]; then
      echo "SKIP: $arg"
    else
      realFileArgs+=("$arg")
    fi
  done

  command reuse "${otherArgs[@]}" "${realFileArgs[@]}"
}

declare -A STYLES
STYLES[shl]="python"
STYLES[sh]="python"
STYLES[js]="cpp"
STYLES[mjs]="cpp"
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

YEAR=(--exclude-year)
for ext in "${!STYLES[@]}"; do
  echo "Adding SPDX-headers to '$ext'-files" >&2
  reuse annotate "$AUTHOR" "$YEAR" "$LICENSE" -s "${STYLES[$ext]}" @(scripts|sources|test)/**/*."$ext"
done

# scripts in /usr/bin
reuse annotate "$AUTHOR" "$YEAR" "$LICENSE" -s "${STYLES[sh]}" sources/fs-root/usr/bin/**