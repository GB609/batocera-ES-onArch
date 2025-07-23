#!/bin/bash

set -e

if [ "$1" = "--push" ]; then
  PUSH_BRANCH=true
  shift
else
  echo "Generating configuration locally only - run [generate-config.sh --push targetDirectory] to create remove branch"
fi

branchName=$(git rev-parse --abbrev-ref HEAD || exit 1)
targetDirectory="${1:./configs-generated}"

export startdir
startdir=$(pwd)

echo "running source build from startdir:[$startdir]"
ls -la

echo "using node: $(which node)"
source ./PKGBUILD
${source:?}

for sourceFile in "${source[@]}"; do
  localPath="${sourceFile%%::*}"
  localName="$(basename "$localPath")"
  [[ "$localName" =~ .*"."[a-z]{3,4}$ ]] || continue
  
  remoteUrl="${sourceFile#*::}"

  mkdir -p "$(dirname "$localPath")"
  echo "Downloading [$localPath] from [$remoteUrl]"
  curl "$remoteUrl" > "$localPath"
done

_generateConfig

[ -d "$targetDirectory" ] && rm -rf "$targetDirectory"
cp -r "$SRCDEST"/rootfs "$targetDirectory"

echo "All contents of this directory are generated and provided for documentation purposes only." \
  > ./configs/generated.md
git add "$targetDirectory"

[ -z "$PUSH_BRANCH" ] && exit 0

git commit -m 'auto-generate reference configuration'
git push -f origin "$branchName":"configs/$branchName"