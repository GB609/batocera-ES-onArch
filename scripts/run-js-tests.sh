#!/bin/bash

source "$(dirname "$(realpath -s "$0")")"/paths.sh

mkdir -p "$RESULT_DIR"
RUN_LOG="$RESULT_DIR"/coverage_short.log

shopt -s globstar nullglob

RUN_MODE="FULL"

TESTS=()
while [ "$#" -gt 0 ]; do
  echo "checking: $1"
  if [ -d "$1" ]; then
    TESTS+=("$1/**/*.test.js")
  elif [ -e "$1" ]; then
    TESTS+=("$1")
  elif [ -e "$ROOT_DIR/test/js/$1" ]; then
    TESTS+=("$ROOT_DIR/test/js/$1")
  else
    case "$1" in
      '--config-only') RUN_MODE="no-test" ;;
      '--skip-config') RUN_MODE="no-config" ;;
      '--run-name') RUN_NAME="$2"; shift ;;
      # assume $1 to be a globbing pattern and try to treat it as such
      *) IFS= TESTS+=($1) ;; 
    esac
  fi
  shift
done

if [ "${#TESTS[@]}" = 0 ]; then
  TESTS=("$ROOT_DIR"/test/js/**/*.test.js)
  TESTS+=("$ROOT_DIR"/test/shell/**/*.test.js)
fi

if [ "$ROOT_DIR" != "$(pwd)" ]; then
  echo -n "Working directory: " && pwd
  echo "change to [$ROOT_DIR]"
  pushd "$ROOT_DIR" &>/dev/null
  trap "popd &>/dev/null" EXIT
fi

# COVERAGE minimums, coverage-out.mjs will fail the build when there is less
export COVERAGE_LINE_MIN="${COVERAGE_LINE_MIN:-80}"
export COVERAGE_BRANCH_MIN="${COVERAGE_BRANCH_MIN:-90}"
export COVERAGE_FUNC_MIN="${COVERAGE_FUNC_MIN:-80}"
export COVERAGE_SEVERITY="${COVERAGE_SEVERITY:-info}"

if [ -n "$COVERAGE_CHECK_DISABLED" ]; then
  unset COVERAGE_LINE_MIN COVERAGE_BRANCH_MIN COVERAGE_FUNC_MIN
fi

TEST_REPORTERS=()

if isGithub; then
  echo "Running on Github - use TESTREPORTER_STYLE=github"
  export TESTREPORTER_STYLE="${TESTREPORTER_STYLE:-github}"
  if isRelease; then
    echo "Release build: Also generate LCOV report"
    TEST_REPORTERS+=("--test-reporter=lcov" "--test-reporter-destination=$RESULT_DIR/js.coverage.info")
    COVERAGE_SEVERITY="error"
  fi
else
  echo "Running locally - use TESTREPORTER_STYLE=stdout"
  export TESTREPORTER_STYLE="${TESTREPORTER_STYLE:-stdout}"
fi

case "$TESTREPORTER_STYLE" in
  github|stdout|junit)
    TEST_REPORTERS+=(--test-reporter="$ROOT_DIR"/test/coverage-out.mjs --test-reporter-destination="$RUN_LOG")
    ;;
  spec|tap|dot)
    TEST_REPORTERS+=(--test-reporter="$TESTREPORTER_STYLE" --test-reporter-destination="$RUN_LOG")
    ;;
  none|*)
    ;;
esac

rm -rf "$RESULT_DIR"/logs "$RUN_LOG" 2>/dev/null

if [ "$RUN_MODE" != "no-config" ]; then
  "$ROOT_DIR"/scripts/generate-config.sh "$TEST_ROOT" || exit 1
fi

# do not run tests, when --config-only is given
[ "$RUN_MODE" = "no-test" ] && exit 0

export BTC_VERIFY_API=true
export NODE_PATH="$TESTSRC_DIR:$BTC_CONFIG_DIR:$ROOT_DIR"
node --import "$ROOT_DIR"/test/setup.unit.mjs \
  --experimental-test-coverage \
  "${TEST_REPORTERS[@]}" \
  --trace-exit --trace-uncaught \
  --test "${TESTS[@]}"
result=$?

function printTestLogs {
  if [ -d "$RESULT_DIR"/logs ]; then
    (
      cd "$RESULT_DIR"/logs || exit 1
      for file in *.log; do
        echo "::group::${file%.log}"
        cat "$file"
        echo "::endgroup::"
      done
    ) || return $?
  fi
}

function printSummary {
  if ! [ -f "$RUN_LOG" ] && [ "$TESTREPORTER_STYLE" != "none" ]; then 
    exit $result
  fi
  [ -n "$RUN_NAME" ] && echo -e "# $RUN_NAME\n"
  xargs -a "$RESULT_DIR"/coverage_short.log -0 echo -e
  echo
}

OUTPUT_TARGET=${GITHUB_STEP_SUMMARY:-/dev/stdout}

[ "$TESTREPORTER_STYLE" = "github" ] && printTestLogs
printSummary >> "$OUTPUT_TARGET"
[ "$TESTREPORTER_STYLE" == "github" ] || echo "For test output, check [$RESULT_DIR/logs]"

exit $result
