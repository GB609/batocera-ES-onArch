ROOT_DIR="$(dirname "$(readlink -f "$0")")"
ROOT_DIR="$(realpath -s "$ROOT_DIR"/..)"

SRC_DIR="$ROOT_DIR"/sources/fs-root
TESTSRC_DIR="$ROOT_DIR"/test
SUPPORTSRC_DIR="$ROOT_DIR"/scripts

REPORT_DIR="$ROOT_DIR"/tmp/reports
RESULT_DIR="$ROOT_DIR"/tmp/results
TEST_ROOT="$ROOT_DIR"/tmp/FS_ROOT

COVERAGE_FILE="$RESULT_DIR"/js.coverage.info

export ROOT_DIR SRC_DIR TESTSRC_DIR SUPPORTSRC_DIR REPORT_DIR RESULT_DIR COVERAGE_FILE TEST_ROOT

function isGithub {
  if [ -n "$IS_GITHUB" ]; then
    return 0
  fi
  return 1
}

function isRelease {
  if [[ "$BRANCH_NAME" = release/* ]]; then
    return 0
  fi
  return 1
}

function isPR {
  echo "TBD"
  return 1
}

export -f isGithub isRelease isPR