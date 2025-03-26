ROOT_DIR=$(dirname "$(readlink -f "$0")")
ROOT_DIR=$(realpath -s "$ROOT_DIR"/..)

REPORT_DIR="$ROOT_DIR"/tmp/reports
RESULT_DIR="$ROOT_DIR"/tmp/results

COVERAGE_FILE="$RESULT_DIR"/js.coverage.info

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