#!/bin/bash

source $(dirname $(realpath -s "$0"))/paths.sh

mkdir -p "$RESULT_DIR"

shopt -s globstar nullglob

TESTS=()
if [ "$#" = 0 ]; then
  TESTS=("$ROOT_DIR"/test/js/**/*.test.js)
else
  while [ "$#" -gt 0 ]; do
    if [ -d "$1" ]; then
      TESTS+=("$1/**/*.js")
    elif [ -e "$1" ]; then
      TESTS+=("$1")
    else
      TESTS+=("$ROOT_DIR/test/js/$1")
    fi
    shift
  done
fi

if isGithub; then
  echo "Running on Github - use node-test-github-reporter"
  STDOUT_REPORTER="--test-reporter=node-test-github-reporter --test-reporter-destination=stdout"
  export COVERAGE_LINE_MIN=80 COVERAGE_BRANCH_MIN=90
else
  echo "Running locally - use inbuild test reporter 'spec'"
  STDOUT_REPORTER="--test-reporter=spec --test-reporter-destination=stdout"
  #COVERAGE_ARGS="--test-coverage-lines=80 --test-coverage-branches=90 --test-coverage-functions=80"
fi

node --import "$ROOT_DIR"/test/setup.unit.mjs \
  --experimental-test-coverage \
  $STDOUT_REPORTER \
  --test-reporter="$ROOT_DIR/test/coverage-out.mjs" --test-reporter-destination="$RESULT_DIR"/coverage_short.log \
  $COVERAGE_ARGS \
  --trace-exit --trace-uncaught \
  --test "${TESTS[@]}"
result=$?

function printCoverageSummary {
  echo -e "\n\n## Coverage summary:\n"
  cat "$RESULT_DIR"/coverage_short.log
  echo
}

if isGithub; then
  printCoverageSummary >> $GITHUB_STEP_SUMMARY
#else
#  printCoverageSummary
fi

exit $result
  #--test-reporter=lcov --test-reporter-destination="$COVERAGE_FILE" \
