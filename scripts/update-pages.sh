#!/bin/bash

# Creates a sub-directory under the directory root/pages/versions that is named after $1, if '--push' is supplied as $2, the local changes are commited to remote
# if no "$1" the current git branch name is expected to match 'pages/somever' and everything following the first / is taken
# The created directory will have the contents of root/tmp/docs, so make sure this has run before

source $(dirname $(realpath -s "$0"))/paths.sh

exec 2>&1
set -Eeo pipefail

branchName=$(git rev-parse --abbrev-ref HEAD || exit 1)
if [ -z "$1" ] || [ "$1" = "--push" ]; then
  version="${branchName#pages\/}"
else
  version="$1"
  shift
fi

if [ -z "$version" ]; then
  echo "version is empty - cancel action"
  exit 1
fi

DOC_TARGET="$ROOT_DIR"/docs/version/"$version"

if [ "$1" != "--push" ]; then
  PUBLISH="--dry-run"
fi

echo -e "\n::group::get remote branches"
(
  set -x
  git fetch --all -f -p
  git branch --remote
)
echo '::endgroup::'

echo -e "\n::group::get & update 'pages'"
(
  set -x
  for b in main pages; do
    git checkout -b "$b" origin/"$b" --track
    echo
    git log -n 2 --decorate
    echo "$b:HEAD is: $(git rev-parse HEAD)"
  done

  git rebase --merge -X ours main pages || exit 1
  echo "commit:HEAD after rebase: $(git rev-parse HEAD)"
) || (
    echo -e "Rebase failed!\nWorkspace differences are:"
    git diff
    git status
    exit 1
)
echo '::endgroup::'

echo -e "\n::group::update pages source directory"
(
  set -x
  node "$ROOT_DIR"/scripts/create-docs.js --integrate-as-version "$version" || exit 1
)
echo '::endgroup::'

echo -e "\n::group::Publish updates 'pages' branch"
(
  set -x
  git add "$ROOT_DIR"/docs
  git status
  git commit -m "(re)publish docs for ${version}"

  git push -f $PUBLISH origin pages:pages

  echo "Merge finished - delete unneeded building branch"
  git push -d $PUBLISH origin "$branchName"
)
echo '::endgroup::'


