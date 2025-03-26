#!/bin/bash

source $(dirname $(realpath -s "$0"))/paths.sh

mkdir -p "$RESULT_DIR"

if isGithub; then
  echo "Running on Github - use node-test-github-reporter"
  STDOUT_REPORTER="--test-reporter=node-test-github-reporter --test-reporter-destination=stdout"
else
  echo "Running locally - use inbuild test reporter 'spec'"
  STDOUT_REPORTER="--test-reporter=spec --test-reporter-destination=stdout"
  COVERAGE_ARGS="--test-coverage-lines=80 --test-coverage-branches=90 --test-coverage-functions=80"
fi

node --import "$ROOT_DIR"/test/setup.unit.mjs \
  --experimental-test-coverage \
  $STDOUT_REPORTER \
  --test-reporter=lcov --test-reporter-destination="$COVERAGE_FILE" \
  $COVERAGE_ARGS \
  --test "$ROOT_DIR"/test/js/**/*.test.js 2>&1