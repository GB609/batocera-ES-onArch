#!/bin/bash

source $(dirname $(realpath -s "$0"))/paths.sh

shopt -s globstar nullglob

if isGithub; then
  _openGroup='::group::'
  _endGroup='::endgroup::'
else
  _openGroup=' --- '
  _endGroup=''
fi

SRC_DIRS=(
  "$SRC_DIR"
  "$TESTSRC_DIR"
  "$SUPPORTSRC_DIR"
)

let errors=0
for d in "${SRC_DIRS[@]}"; do
  echo -e "\n${_openGroup}Checking syntax of files in '$d'"
  echo "### Node scripts ###"
  for srcFile in "$d"/**/*.{js,mjs}; do
    echo "$srcFile:"
    node -c "$srcFile"
    let errors="$errors + $?"
  done

  echo -e "\n### Bash scripts (sh, lib) ###"
  for srcFile in "$d"/**/*.{sh,lib}; do
    echo "$srcFile:"
    bash -n "$srcFile"
    let errors="$errors + $?"
  done

  echo -e "\n### Bash scripts (no extension) ###"
  IFS=$'\n' noExt=($(find "$d" -not -name '*.*'))
  for srcFile in "${noExt[@]}"; do
    ! [ -f "$srcFile" ] && continue

    [ -z "$(file "$srcFile" | grep Bourne-Again)" ] && continue

    echo "$srcFile:"
    bash -n "$srcFile"
    let errors="$errors + $?"
  done
  echo "$_endGroup"
done

if [ "$errors" -gt 0 ]; then
  echo "SYNTAX CHECK FAILED"
  exit "$errors"
fi