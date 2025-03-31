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
)

let errors=0
for d in "${SRC_DIRS[@]}"; do
  echo -e "\n${_openGroup}Checking syntax of files in '$d'"
  for srcFile in "$d"/**/*.{js,mjs}; do
    echo "$srcFile:"
    node -c "$srcFile"
    let errors="$errors + $?"
  done
  echo "$_endGroup"
done

if [ "$errors" -gt 0 ]; then
  echo "SYNTAX CHECK FAILED"
  exit "$errors"
fi