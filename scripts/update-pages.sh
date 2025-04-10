#!/bin/bash

# Creates a sub-directory under the directory root/pages/versions that is named after $1, if '--push' is supplied as $2, the local changes are commited to remote
# if no "$1" the current git branch name is expected to match 'pages/somever' and everything following the first / is taken
# The created directory will have the contents of root/tmp/docs, so make sure this has run before

source $(dirname $(realpath -s "$0"))/paths.sh

if [ -z "$1" ] || [ "$1" = "--push" ]; then
  branchName=$(git rev-parse --abbrev-ref HEAD || exit 1)
  version="${branchName#pages\/}"
else
  version="$1"
  shift
fi

if [ -z "$version" ]; then
  echo "version is empty - cancel action"
  exit 1
fi

DOC_TARGET="$ROOT_DIR"/pages/versions/"$version"

if [ "$1" = "--push" ]; then
  PUBLISH=true
fi

git fetch --all
git branch --remote

git checkout -B pages
git diff
git pull --rebase origin main

mkdir -p $(dirname "$DOC_TARGET")
rm -rf "$DOC_TARGET"
mv "$ROOT_DIR"/tmp/docs "$DOC_TARGET"

git add .
git status
git commit -m "'(re)publish docs for ${version}'"

git push origin pages:pages --dry-run
