#!/bin/bash

source "$(dirname "$(realpath -s "$0")")"/paths.sh

if ! which genhtml 2>/dev/null; then
  echo "genhtml not installed - skip coverage html report" >&2
  exit 0
fi

# force test run locally
if [ "$1" = "--local" ]; then
  export IS_GITHUB=true
  export TESTREPORTER_STYLE=stdout
  BRANCH_NAME="release/coverage" scripts/run-js-tests.sh
fi

genhtml -p "$(pwd)" \
  --sort -f -q\
  --branch-coverage \
  --function-coverage \
  --output-directory "$REPORT_DIR"/coverage \
  --ignore-errors inconsistent,inconsistent \
  "$COVERAGE_FILE"

echo "Coverage placed in $REPORT_DIR/coverage"