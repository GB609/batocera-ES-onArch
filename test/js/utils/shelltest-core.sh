# SPDX-FileCopyrightText: 2026 Karsten Teichmann
#
# SPDX-License-Identifier: MIT

# @file
# @brief Common utils and setup used by [shelltest.mjs](./shelltest.mjs.md)
# @description
# This file will be set as `$BASH_ENV` by `ShellTestRunner` to make sure it is pulled in and used by all bash-based sub commands.
# This is done to make sure that all scripts have a fail-fast error trap installed into it to prevent false positives 
# in tests which happen because a subshell's negative exit code is ignored silently.

# Verify a batch of env vars to be given. These are 'test API'
: "${TEST_TAG:?}" "${ROOT_DIR:?}"
: "${FAILURE_MARKER_START:?}" "${FAILURE_MARKER_END:?}"
: "${ERROR_MARKER_START:?}" "${ERROR_MARKER_END:?}"
: "${ASSERTION_ERROR_CODE:?}" "${ERR_EXIT_CODE:?}"

# @description
# Installs an ERR trap which prints a stack exits the script when any line's code is >0 and !=$ASSERTION_ERROR_CODE.  
# The function also enables the errtrace option (set -E) to get a more accurate stack.
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
    test:error "Unexpected error ${T_CODE} from command: ${T_CMD}"
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
} >&2
' ERR;

  if [ "$1" = "--lock" ]; then
    function trap { [ "$2" != "ERR" ] && builtin trap "$@"; }
    declare -fr trap
  fi
}

test:installErrorTrap "${LOCK_ERROR_TRAP:+--lock}"

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
  local NOEXIT=1
  . <( echo "${1}" )
 
  local expected="$2"
  local EXIT_CODE="$?"
  if [ "${EXIT_CODE}" -gt 0 ] && ! [[ $2 =~ ^[0-9]+$ ]]; then 
    EXIT_CODE=false;
  elif [ "${EXIT_CODE}" = "0" ]; then
    EXIT_CODE=true
  fi
  [ "$expected" = "0" ] && expected=true

  local MESSAGE_PREFIX="Unexpected exit code for: [$1]"
  test:verifyVar EXIT_CODE "$expected"
} >&2

function test:verifyExport {
  if [ -n "$(builtin export -p | grep -oE -- "-x ${1}=")" ]; then builtin return 0; fi
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

# Mark all public test api functions as read-only
for testFunc in $(declare -F | grep -oE 'test:\S+$'); do
  builtin declare -fr "$testFunc"
done
