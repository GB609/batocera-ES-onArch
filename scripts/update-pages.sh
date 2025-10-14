#!/bin/bash

# This script maintains the pages branch. 
# **Note:** This script will perform branch change and rebase operations, so the current working state must be clean.
#
# The pages branch for this repository contains a set of 'static', version-independent files and a history of release version specific manuals.
# When run, only the static files and a specified version subdirectory will be updated.
#
# **Structure:**
# /docs
#  - index.md*
#  - /version
#    - index.md*
#    - [version-name]/
#      - ...
# 
# Usage:
# * It can be used/started from any branch locally.
# * Runs automatically for branches prefixed with `page-update/`, via workflow `update_pages.yml`.
#
# **Preconditions**
# - clean repo state
# - a directory `tmp/docs` which will contain the version-specific documentation, created with `create-docs.js --generate-version`
#
# **Final result**
# - the new/re-created subdirectory `docs/version/[version-name]`
# - pages branch rebased onto main, with all previous and current changes to `doc` only on top of the pages branch
#
# **How it works:**
# 1. `create-docs.js --generate-version` must have generated `tmp/docs` (tmp must be in `.gitignore`)
#     This must happen on the branch that contains the sources /changes to document
# 2. The branches main and pages will be fetched and updated, upstream configured accordingly
# 3. pages is rebased onto main
# 4. `create.docs.js --integrate-as-version [version-name]` is used to integrate the changes in `tmp/docs`
#    in `docs/version/[version-name]`. This happens while on the pages branch. This is done in 3 steps:
#    4.1. move/overwrite `docs/version/[version-name]` with the new input from `tmp/doc`
#    4.2. Overwrite the static, version independent files with their templated counterparts from `sources/page-template`
#    4.3. Go over all index files and re-write the list of linked sub-pages for all index files which contain a certain control tag.
#         This is a recursive depth-first filesystem search. Links in the index will be generated for:
#         * Any `*.md` in the same directory as the index
#         * `index.md` files in subdirectories of the current index file's parent OR
#         * Any `*.md` in such subdirectories, but only if that directory does not itself contain an index file.
#
# OPEN POINT: 
# The content of [version-name] comes from the initial source branch 
# and is generated with the version of `create-docs.js` from that branch.
# But the `sources/page-template` directory and `create-docs.js --integrate-as-version` will be from main.
# If the `page-update/` branch has not initially been created from main, any changes related to the page template 
# or the logic of `create-docs.js --integrate-as-version` will NOT be reflected on `pages/docs`.
# Such changes would have to be merged to master first, before any `page-update/` branch can take advantage of them.

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


