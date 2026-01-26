#/!bin/bash

# SPDX-FileCopyrightText: 2026 Karsten Teichmann
#
# SPDX-License-Identifier: MIT

# @file
# @brief collect/update `*.pot` files

source "$(dirname "$(realpath -s "$0")")"/paths.sh

declare -A STYLES
STYLES[shl]="shell"
STYLES[sh]="shell"
STYLES[js]="javascript"
STYLES[mjs]="javascript"

function is_sh {
  while read -r; do
    [ -d "$REPLY" ] && continue
    if [[ "$REPLY" =~ .*\.(sh|shl)$ ]]; then
      echo "$REPLY"
      continue
    fi

    if file "$REPLY" | grep 'shell script' >/dev/null; then
      echo "$REPLY"
      continue
    fi
  done
}

function is_js {
  while read -r; do
    [ -d "$REPLY" ] && continue
    if [[ "$REPLY" =~ .*\.(js|mjs)$ ]]; then
      echo "$REPLY"
      continue
    fi

    if file "$REPLY" | grep 'Node.js script' >/dev/null; then
      echo "$REPLY"
      continue
    fi
  done
}

declare -A FILTERS
FILTERS[sh]="is_sh"
FILTERS[js]="is_js"

declare -A KEYWORDS
KEYWORDS[shl]='lc _outOnly _logAndOut _logAndOutWhenDebug _interface:2'
KEYWORDS[sh]="${KEYWORDS[shl]}"


shopt -s globstar dotglob extglob nullglob

if [ "$1" = "--incremental" ]; then
  echo "running incremental update"
  changedFiles=($(git diff-tree -r --no-commit-id --name-only HEAD origin/main | grep -E 'fs-root/(opt|usr)'))
else
  echo "full rescan"
  changedFiles=(sources/fs-root/@(opt|usr)/**)
fi

echo "Candidate files to scan: $(printf '\n - %s' "${changedFiles[@]}")"

TARGET_DIR="$ROOT_DIR"/tmp/locale
rm -rf "$TARGET_DIR" 
mkdir -p "$TARGET_DIR"

for style in "${!FILTERS[@]}"; do
  echo
  filter="${FILTERS[$style]}"
  lang="${STYLES[$style]}"
  declare -a "kw=(${KEYWORDS[$style]})"
  for k in "${kw[@]}"; do
    kwArgs+=("--keyword=$k")
  done

  sources=($(printf '%s\n' "${changedFiles[@]}" | "$filter"))
  if [ "${#sources[@]}" = 0 ]; then
    echo "no relevant files for $filter in candidates" 
    continue
  else
    echo "extract messages to '$style.pot' from: $(printf '\n - %s' "${sources[@]}")"
  fi

  xgettext -L "$lang" -k "${kwArgs[@]}" \
    --from-code=UTF-8 --add-comments \
    -j -o "$ROOT_DIR"/sources/locale/parts/"$style".pot "${sources[@]}"
done

[ -z "$(git status -s "$ROOT_DIR"/sources/locale/parts)" ] && exit 0

POTFILE="$ROOT_DIR"/sources/locale/btc-es.pot

potFiles=("$ROOT_DIR"/sources/locale/parts/*.pot)
xgettext -o "$POTFILE" "${potFiles[@]}"

for langfile in "$ROOT_DIR"/sources/locale/*.po; do
  msgmerge -U "${langfile}" "${POTFILE}" -N
done
