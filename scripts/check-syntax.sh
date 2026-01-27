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

function projectRelativePath {
  printf '%s' "${1#"$ROOT_DIR/"}"
}

function assertSyntaxResult {
  if [ "$?" -gt 0 ]; then
    (( result+=1 ))
    [ -n "$checkResult" ] && errorOut+=("$checkResult")
  fi
}

function printResult {
  if [ "$result" -gt 0 ]; then
    echo -e ' [\e[31mFAIL\e[0m]'
    echo -e '\e[31m-->\e[0m'
    printf '%b\n' "${errorOut[@]}"
    echo -e '\e[31m<--\e[0m\n'
  else
    echo -e ' [\e[32mOK\e[0m]'
  fi

  return "$result"
}

function checkNodeFile {
  local errorOut=()
  local result=0
  projectRelativePath "$1":
  checkResult=$(LC_ALL=C node -c "$1" 2>&1)
  assertSyntaxResult
  
  printResult
}

function checkBashFile {
  local errorOut=()
  local result=0
  projectRelativePath "$1":
  checkResult=$(LC_ALL=C bash -n -O extglob "$1" 2>&1)
  assertSyntaxResult

  # Special checks for very troublesome and nearly invisible problems
  # dangling \ for line-wrapping followed by any whitespace
  output=$(grep -n --color=always -E '\\ +$' "$1")
  if [ -n "$output" ]; then
    (( result+=1 ))
    errorOut+=('\e[31mDangling backslash:\e[0m')
    while read -r; do
      errorOut+=("$REPLY\$")
    done <<< "$output"
  fi
  
  printResult
}

let errors=0
for d in "${SRC_DIRS[@]}"; do
  echo -e "\n${_openGroup}Checking syntax of files in '$d'"
  echo "### Node scripts ###"
  for srcFile in "$d"/**/*.{js,mjs}; do
    checkNodeFile "$srcFile" || (( errors+=1 ))
  done

  echo -e "\n### Bash scripts (sh, shl) ###"
  for srcFile in "$d"/**/*.{sh,shl}; do
    checkBashFile "$srcFile" || (( errors+=1 ))
  done

  echo -e "\n### Bash scripts (no extension) ###"
  IFS=$'\n' noExt=($(find "$d" -not -name '*.*'))
  for srcFile in "${noExt[@]}"; do
    ! [ -f "$srcFile" ] && continue
    [ -z "$(file "$srcFile" | grep -i 'shell script')" ] && continue

    checkBashFile "$srcFile" || (( errors+=1 ))
  done
  echo "$_endGroup"
done

if [ "$errors" -gt 0 ]; then
  echo "SYNTAX CHECK FAILED"
  exit "$errors"
fi