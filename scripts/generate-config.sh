#!/bin/bash

# @file
# @brief Create configuration files from batocera + local sources for tests
# @description
# This script creates all configuration files the same way when the package would be installed to a system.  
# It is possible to optionally push the result to another branch for inspection.  
# To do so, the argument '--push' must be supplied

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
  echo "Generating configuration locally only - run [generate-config.sh --push targetDirectory] to create remote branch"
fi

targetDirectory="${1:-./configs-generated}"

export startdir
startdir="$ROOT_DIR"

(
  echo "running source build from startdir:[$startdir]"
  if isGithub && ! [ -x /usr/bin/node ]; then
    sudo ln -s "$(which node)" /usr/bin/node
  fi

  if ! python -c "import yq" 2>/dev/null; then
    echo "install missing dependency python yq/xq"
    sudo python -m pip install yq
  fi

  cd "$ROOT_DIR"
  
  configArgs=()
  [ -n "$FORCE" ] && configArgs+=('--force')
  configArgs+=(--file "$ROOT_DIR"/sources/revision.conf)
  scripts/package configs-dl "${configArgs[@]}"

  cp -rf --preserve=timestamps "$TMP_CACHE"/configs/fs-root/* "$targetDirectory"
  
  dropinDir="$targetDirectory/etc/batocera-emulationstation/conf.d"
  [ -d "$dropinDir" ] && rm -rf "$dropinDir"
  rsync -a "$SRC_DIR"/etc/batocera-emulationstation "$targetDirectory/etc"

  FS_ROOT="$targetDirectory" "$BTC_CONFIG_DIR"/btc-config generateGlobalConfig -v \
    --comment "Created by '[scripts/generate-config.sh]" \
    || exit $?
  
  [ -z "$targetBranch" ] && exit 0

  echo "All contents of this directory are generated and provided for documentation purposes only." \
    > ./configs/generated.md
  git add "$targetDirectory"
  git commit -m 'auto-generate reference configuration'
  git push -f origin "$branchName":"$targetBranch"
)
