# SPDX-FileCopyrightText: 2026 Karsten Teichmann
#
# SPDX-License-Identifier: MIT

# @file
# @brief Common utils and setup used by [shelltest.mjs](./shelltest.mjs.md)
# @description
# This file will be set as `$BASH_ENV` by `GenericShellTestRunner` to make sure it is pulled in and used by all bash-based sub commands.
# This is done to make sure that all scripts have a fail-fast error trap installed into it to prevent false positives 
# in tests which happen because a subshell's negative exit code is ignored silently.  
#
# **Features:**
# - assertions via  
#    * `test:disallowCommand`
#    * `test:verifyExitCode`
#    * `test:verifyExport`
#    * `test:verifyVar`
# - logging, stack traces and custom failure checks:  
#    * `test:diag` - print a line of debug log with a prefix to differentiate from regular output of tested code
#    * `test:stack`
#    * `test:failure` - regular test failure
#    * `test:error` - unexpected 'exceptions' or crashes
#    * variable `DEBUG_MODE=true` - installs a debug trap to trace code path
# - Optional: Record executed statements for coverage calculations.
#
# **Coverage:**  
# The variable `ENABLE_COVERAGE=true` enables coverage recording by usage of a specially prepared debug trap output.  
# It prints a file with valid javascript code for easier parsing from `GenericShellTestRunner`.  
# **Coverage recording is incompatible with debug mode.**  
# Format:  
#  > r(`file`,linenr,`funcname`,`BASH_COMMAND`);
#  > bash control structures like `if` or `else` are not included in the commands
#  > BEFORE a statement is executed, a line matching the format is printed.  
#    This means, theoretically, that for crashing or failing tests, the last none-test line recorded was not executed
#    successfully. The best strategy for failing tests is to drop coverage recorded for it entirely for best accuracy.
# 
# - Note:  
#
# The coverage recording only captures which lines were executed, it is still necessary to analys the files to get
# a total list of statements, line numbers and functions to calculate effective coverage.

# until shelltest-core is set up, crash the shell on every failure
builtin set -e

# Verify a batch of env vars to be given. These are 'test API'
: "${TEST_TAG:?}" "${ROOT_DIR:?}"
: "${FAILURE_MARKER_START:?}" "${FAILURE_MARKER_END:?}"
: "${ERROR_MARKER_START:?}" "${ERROR_MARKER_END:?}"
: "${ASSERTION_ERROR_CODE:?}" "${ERR_EXIT_CODE:?}"

# @description
# Installs an ERR trap which prints a stack exits the script when any line's code is >0 and !=$ASSERTION_ERROR_CODE.  
# The function also enables the `errtrace` option (set -E) to get a more accurate stack.
# It is normally installed by default. However, the code under test might install another ERR trap which needs
# to be overridden or reverted again for the test to work, which is why the trap installation is wrapped in a function.
#
# It supports a `NOEXIT` config for tests which assert exit codes to prevent the default immediate exits.
# For this case, some state variables are used to prevent re-printing the same stack while the command 'bubbles' up the 
# function chain.
#
# @option --lock The function overrides `trap` with a proxy function blocking any change to `ERR` (unless used with builtin)
function test:installErrorTrap {
  builtin set -E
  builtin trap '
T_CODE="$?"; T_LINE="$(( LINENO - 1 ))"; T_CMD="$BASH_COMMAND"
[ "${T_CODE}" = "${ASSERTION_ERROR_CODE}" ] || {
  if [ "${#BASH_SOURCE[@]}" -ge "${NOEXIT_DEPTH:-0}" ] \
  || [ "${NOEXIT_CMD}" != "${T_CMD}" ] \
  || [ "${NOEXIT_PREVLINES[0]}" != "${T_LINE}" ]; then
    test:error "Unexpected error ${T_CODE} from command: ${T_CMD} @[$(basename "${BASH_SOURCE:bash}"):$T_LINE]"
    [ -v NOEXIT ] || builtin exit ${T_CODE}
    NOEXIT_DEPTH="${#BASH_SOURCE[@]}"
    NOEXIT_CMD="${T_CMD}"
    declare -ga NOEXIT_PREVLINES=()
    for i in "${BASH_LINENO[@]}"; do NOEXIT_PREVLINES+=("$i"); done
  elif ! [ -v NOEXIT ]; then
    unset NOEXIT_CMD NOEXIT_DEPTH NOEXIT_PREVLINES
  else
    NOEXIT_PREVLINES=(${NOEXIT_PREVLINES[@]:1})
  fi
}
unset T_CODE T_LINE T_CMD >&2
' ERR;

  if [ "$1" = "--lock" ]; then
    # shellcheck disable=2064  # single quotes to prevent expansion: Intended here, need content of $@
    function trap { 
      if [ "$2" != "ERR" ]; then
        builtin trap "$@"
      else
        test:failure 'Setting the ERR trap is forbidden.'
      fi
    }
    declare -fr trap
  fi
}

test:installErrorTrap "${LOCK_ERROR_TRAP:+--lock}"
builtin set +e

function test:failure {
  builtin echo "${START_MARKER:-${FAILURE_MARKER_START}}"
  [ -v MESSAGE_PREFIX ] && builtin printf '%s\n' "${MESSAGE_PREFIX}"
  builtin printf '%s\n' "$*"
  test:stack
  builtin echo "${END_MARKER:-${FAILURE_MARKER_END}}"
  [ -v NOEXIT ] || builtin exit "${EXIT_CODE:-${ASSERTION_ERROR_CODE}}"
} >&2

function test:error {
  START_MARKER="${ERROR_MARKER_START}" END_MARKER="${ERROR_MARKER_END}" EXIT_CODE="${ERR_EXIT_CODE}" test:failure "$*"
}

function test:diag {
  builtin echo "${TEST_TAG}-DIAG:: $*"
} >&2

function test:stack {
  local idx _file
  for idx in "${!BASH_LINENO[@]}"; do
    _file="${BASH_SOURCE[$idx+1]%${ROOT_DIR:-/}}"
    builtin printf '\tat %s (%s:%d)\n' "${FUNCNAME[$idx+1]:-main}" "$_file" "${BASH_LINENO[$idx]}"
  done
}

function test:disallowCommand {
  . <( builtin echo "$1 () { test:failure 'Command [$1] must not be called!'; }" )
}

function test:verifyExitCode {
  local testCommand=()
  while [ "$#" -gt 1 ]; do
    testCommand+=("$1")
    shift
  done
  local expected="$1"

  local NOEXIT=1
  . <( builtin echo "${testCommand[*]}" )
  local EXIT_CODE="$?"

  if [ "${EXIT_CODE}" -gt 0 ] && ! [[ $expected =~ ^[0-9]+$ ]]; then 
    EXIT_CODE=false;
  elif [ "${EXIT_CODE}" = "0" ]; then
    EXIT_CODE=true
  fi
  [ "$expected" = "0" ] && expected=true

  local MESSAGE_PREFIX="Unexpected exit code for: [${testCommand[*]}]"
  test:verifyVar EXIT_CODE "$expected"
} >&2

function test:verifyExport {
  if builtin export -p | grep -qoE -- "-x ${1}="; then builtin return 0; fi
  test:failure "${1} must be exported!"
} >&2

# @description Used for test value verifications. 
# For simple scalar evaluation, the actual value needs not be passed.
# @arg $1 variable name/description
# @arg $2 expected value
# @arg $3 actual value
function test:verifyVar {
  local matcher="^${2}$"
  [ -v 3 ] && local actual="$3" || local -n actual="$1"

  if [[ $3 =~ $matcher ]] || [ "${actual}" = "$2" ]; then builtin return 0; fi
  test:failure "\
expected: [$1=\"$2\"]
 but was: [$1=\"${actual}\"]"
} >&2

# set up coverage
test__corefile="${BASH_SOURCE[0]}"
# @description Build and print a coverage recording line.
# Used by `DEBUG` trap internally, so the record gets printed before the statement runs,
# which means that the LAST statement in a record file might not have been executed successfully
#
# **parameters in order:** file linenbr funcname cmd
function test:coverageLine {
  local bash_source="$1"
  local func="$3"
  local cmd="$4"

  if ! [ -f "$bash_source" ] \
  || ! [[ "$bash_source" =~ ^${COVERAGE_ROOT}.* ]] \
  || [ "$bash_source" = "${test__corefile}" ] \
  || [ -n "$T_CODE" ] \
  || [ "$cmd" != "${cmd#"$func"}" ]; then 
    builtin return 0
  fi

  bash_source="${bash_source#"${COVERAGE_ROOT:""}/"}"
  cmd="${cmd//$\{/\\\$\{}"
  builtin echo "r('$bash_source',$2,'$func',\`$cmd\`)"
} >&"${COVERAGE_RECORD_FD}"

# Mark all public test api functions as read-only
for testFunc in $(declare -F | grep -oE 'test:\S+$'); do
  builtin declare -fr "$testFunc"
done
unset testFunc

if [ "${DEBUG_MODE}" = true ]; then
  if [ "${ENABLE_COVERAGE}" = true ]; then
    test:diag "Debug Mode is incompatible with coverage recording - turn it off"
    builtin unset ENABLE_COVERAGE COVERAGE_RECORD_FD
  fi

  builtin set -o functrace
  builtin trap 'echo "[$(basename ${BASH_SOURCE[0]} 2>/dev/null || echo ""):$LINENO]> ($?) $BASH_COMMAND" >&2' DEBUG
fi

# Enable coverage recording only when active AND there is a target file to write to.  
# This check is necessary because the FD might not be passed along to all sub-processes
# which can happen when bash invocations spawn other programs which spawn bash again while `BASH_ENV=shelltest-core.sh`.  
#
# Example: bash(1) -> node:child_process.execSync -> bash(2)
# both `bash` pick up the exported `BASH_ENV=shelltest-core.sh`, but node does not pass through fd=3 to bash(2)
if [ "${ENABLE_COVERAGE}" = true ] && [ -e "/dev/fd/${COVERAGE_RECORD_FD}" ]; then
  builtin set -o functrace
  #builtin shopt -s extdebug  # FIXME: Ubuntu 24 on Github doesn't have bashdb installed
  trap 'test:coverageLine \
    "$BASH_SOURCE" $LINENO "$FUNCNAME" "${BASH_COMMAND}"' \
    DEBUG
elif ! [ -e "/dev/fd/${COVERAGE_RECORD_FD}" ]; then
  trap - DEBUG || true
fi
