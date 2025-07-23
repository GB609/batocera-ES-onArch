#!/bin/bash

branchName=$(git rev-parse --abbrev-ref HEAD || exit 1)

source ./PKGBUILD

for sourceFile in "${source[@]}"; do
  localPath="${sourceFile%%::*}"
  localName="$(basename "$localPath")"
  [[ "$localName" =~ .*"."[a-z]{3,4}$ ]] || continue
  
  remoteUrl="${sourceFile#*::}"

  mkdir -p "$(dirname "$localPath")"
  curl "$remoteUrl" > $localPath
done

_generateConfig

rm -rf ./configs-generated
cp "$SRCDEST"/rootfs ./configs-generated
git add ./configs-generated

git commit -m 'auto-generate reference configuration'
git push -f origin "$branchName":"configs/$branchName"
