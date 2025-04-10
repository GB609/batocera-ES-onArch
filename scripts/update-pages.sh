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

echo -e "\n::group::get remote branches"
(
  set -v
  git fetch --all -f -p
  git branch --remote
)
echo '::endgroup::'

echo -e "\n::group::get & update 'pages'"
(
  set -v
  git switch pages
  git pull --rebase origin main || (
    echo "Rebase failed!\nWorkspace differences are:"
    git diff
    git status
    exit 1
  )
)
echo '::endgroup::'

echo -e "\n::group::update pages source directory"
(
  set -x
  mkdir -p $(dirname "$DOC_TARGET")
  rm -rf "$DOC_TARGET"
  mv "$ROOT_DIR"/tmp/docs "$DOC_TARGET"
)
echo '::endgroup::'

echo -e "\n::group::Publish updates 'pages' branch"
(
  set -x
  git add .
  git status
  git commit -m "'(re)publish docs for ${version}'"
  
  git push --dry-run origin pages:pages
)
echo '::endgroup::'
