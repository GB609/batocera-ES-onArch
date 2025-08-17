#!/bin/bash

set -e

[ -z "$ROOT_DIR" ] && source "$(dirname "$(realpath -s "$0")")"/paths.sh

if [ "$1" = "--force" ]; then
  FORCE=true
  echo "Force re-download of source files"
  shift
else
  echo "Use predownloaded source files (if any) - use --force to overwrite (or delete manually)"
fi

if [ "$1" = "--push" ]; then
  branchName=$(git rev-parse --abbrev-ref HEAD || exit 1)
  targetBranch="configs/$branchName"
  echo "Will push results to remote branch [$targetBranch]"
  shift
else
  echo "Generating configuration locally only - run [generate-config.sh --push targetDirectory] to create remove branch"
fi

targetDirectory="${1:-./configs-generated}"

export startdir
startdir="$ROOT_DIR"

(
  echo "running source build from startdir:[$startdir]"
  if isGithub && ! [ -x /usr/bin/node ]; then
    sudo ln -s "$(which node)" /usr/bin/node
  fi

  cd "$ROOT_DIR"
  source ./PKGBUILD

  # shellcheck disable=SC2154
  for sourceFile in "${source[@]}"; do
    localPath="$SRCDEST"/"${sourceFile%%::*}"
    localName="$(basename "$localPath")"
    [[ "$localName" =~ .*"."[a-z]{3,4}$ ]] || continue

    remoteUrl="${sourceFile#*::}"

    localRelative="$(realpath -m "$localPath" --relative-to="$ROOT_DIR")"
    if [ -f "$localPath" ] && [ -z "$FORCE" ]; then
      echo "skip download of existing file [$localRelative]"
      continue
    fi

    mkdir -p "$(dirname "$localPath")"
    echo "Downloading [$localRelative] from [$remoteUrl]"
    curl --no-progress-meter "$remoteUrl" > "$localPath" || exit $?
  done

  _generateConfig || exit $?

  [ -d "$targetDirectory" ] && rm -rf "$targetDirectory"
  cp -r "$SRCDEST"/rootfs "$targetDirectory"

  [ -z "$targetBranch" ] && exit 0

  echo "All contents of this directory are generated and provided for documentation purposes only." \
    > ./configs/generated.md
  git add "$targetDirectory"
  git commit -m 'auto-generate reference configuration'
  git push -f origin "$branchName":"$targetBranch"
)
