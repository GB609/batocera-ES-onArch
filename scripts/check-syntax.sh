#!/bin/bash

# SPDX-FileCopyrightText: 2025 Karsten Teichmann
#
# SPDX-License-Identifier: MIT

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

function checkBashFile {
  local result=0
  echo "$1":
  bash -n -O extglob "$1" || (( result+=1 ))

  # Special checks for very troublesome and nearly invisible problems
  # dangling \ for line-wrapping followed by any whitespace
  output=$(grep --color=always -E '\\ +$' "$1")
  if [ -n "$output" ]; then
    (( result+=1 ))
    xargs -d $'\n' printf '\e[31mDangling backslash:\e[0m [%s$]\n' << EOF 
$output 
EOF
  fi

  return "$result"
}

let errors=0
for d in "${SRC_DIRS[@]}"; do
  echo -e "\n${_openGroup}Checking syntax of files in '$d'"
  echo "### Node scripts ###"
  for srcFile in "$d"/**/*.{js,mjs}; do
    echo "$srcFile:"
    node -c "$srcFile" || (( errors+=1 ))
  done

  echo -e "\n### Bash scripts (sh, lib) ###"
  for srcFile in "$d"/**/*.{sh,lib}; do
    checkBashFile "$srcFile" || (( errors+=1 ))
  done

  echo -e "\n### Bash scripts (no extension) ###"
  IFS=$'\n' noExt=($(find "$d" -not -name '*.*'))
  for srcFile in "${noExt[@]}"; do
    ! [ -f "$srcFile" ] && continue
    [ -z "$(file "$srcFile" | grep Bourne-Again)" ] && continue

    checkBashFile "$srcFile" || (( errors+=1 ))
  done
  echo "$_endGroup"
done

if [ "$errors" -gt 0 ]; then
  echo "SYNTAX CHECK FAILED"
  exit "$errors"
fi