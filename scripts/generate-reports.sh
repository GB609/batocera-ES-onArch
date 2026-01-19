#!/bin/bash

# SPDX-FileCopyrightText: 2025 Karsten Teichmann
#
# SPDX-License-Identifier: MIT

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

echo '::group::Coverage file contents'
lcov -q -l "$COVERAGE_FILE"
echo '::endgroup::'

genhtml -p "$(pwd)" \
  --sort -f -q\
  --branch-coverage \
  --function-coverage \
  --output-directory "$REPORT_DIR"/coverage \
  --ignore-errors inconsistent,inconsistent \
  "$COVERAGE_FILE" || exit 1

echo "Coverage placed in $REPORT_DIR/coverage"
