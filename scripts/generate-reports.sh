#!/bin/bash

source $(dirname $(realpath -s "$0"))/paths.sh

if ! which genhtml 2>/dev/null; then
  echo "genhtml not installed - skip coverage html report" >&2
  exit 0
fi

genhtml -p $(pwd) \
  --sort -f \
  --function-coverage \
  --output-directory "$REPORT_DIR"/coverage \
  --ignore-errors inconsistent \
  "$COVERAGE_FILE"