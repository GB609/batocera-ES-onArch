#!/bin/bash

# @file
# This file is a helper that performs the same thing that the wrapper `/usr/bin/emnulationstation` would do.  
# However, contrary to the original, it does not just start btc-es, but a shell instead. This allows for
# manual testing with the same environment that `emulatorlauncher` would have.  
# The enviroment should be mostly identical in terms of defined variables, but the variables themselves
# point to other locations directly in the sources. Some also use some temporary directories.  
# The ENVs are configured so that all processes started from the test shell will use the same values for 
# FS_ROOT, ES_HOME etc.  
# Also changes XDG directories and user home.  
# @example
#   # opens interactive bash
#   scripts/sources-test-shell.sh 
#  
#   # execute just one command
#   scripts/sources-test-shell.sh command 'argument with blanks' anotherArg ...

# First unset all in the current shell to make sure configurations of the real system dont interfere
(
  declare -a _varNames
  ROOT_DIR="$(dirname "$(readlink -f "$0")")"
  ROOT_DIR="$(realpath -s "$ROOT_DIR/..")"
  TEST_ROOT="$ROOT_DIR"/tmp/FS_ROOT
  mkdir -p "$TEST_ROOT"

  "$ROOT_DIR"/scripts/generate-config.sh "$TEST_ROOT"
  ln -s "$ROOT_DIR"/package/pkg/batocera-emulationstation/opt/batocera-emulationstation/bin/resources \
        "$TEST_ROOT"/opt/batocera-emulationstation/bin/resources 2>/dev/null
  ln -s "$ROOT_DIR"/package/pkg/batocera-emulationstation/opt/batocera-emulationstation/bin/emulationstation \
        "$TEST_ROOT"/opt/batocera-emulationstation/bin/emulationstation 2>/dev/null
  rsync -a "$ROOT_DIR"/test/resource/fs_root/home/ "$TEST_ROOT"/home/
  
  # ... But do everything in a sub-shell to not destroy the real environment
  unset XDG_CONFIG_HOME XDG_DATA_HOME XDG_STATE_HOME XDG_CACHE_HOME
  unset ES_HOME ES_CONFIG_HOME ES_DATA_DIR ES_STATE_DIR ES_CACHE_DIR
  unset DEFAULT_ROMS_ROOT ROMS_ROOT_DIR SAVES_ROOT_DIR
  unset EMU_CMD_DIR EMU_CFG_DIR

  # for all using user-paths.lib
  export FS_ROOT="$ROOT_DIR"/sources/fs-root
  export HOME="$TEST_ROOT"/home/test
  export ES_CONFIG_HOME="$HOME"/.emulationstation
  export CONFIG_ROOT="$TEST_ROOT"/etc/batocera-emulationstation
  export ROMS_ROOT_DIR="$HOME"/ROMs
  _varNames+=(FS_ROOT HOME CONFIG_ROOT ES_HOME ES_CONFIG_HOME ES_DATA_DIR ES_STATE_DIR ES_CACHE_DIR)

  # btc-config and usr/bin/emulationstation
  #this only works if the package has been built at least once
  export BTC_BIN_DIR="$TEST_ROOT"/opt/batocera-emulationstation/bin
  source "$ROOT_DIR"/sources/fs-root/etc/batocera-paths.conf
  _varNames+=(BTC_PKG_DIR BTC_BIN_DIR)

  export PATH="$FS_ROOT/usr/bin:$PATH"
  PATH="$FS_ROOT/opt/batocera-emulationstation/support:$FS_ROOT/opt/batocera-emulationstation:$PATH"
  mkdir -p "$HOME" "$CONFIG_ROOT" 
  #"$DROPIN_PATH"
  
  # declare all none-declared common paths
  source "$SH_LIB_DIR"/user-paths.lib
  _varNames+=(ROMS_ROOT_DIR SAVES_ROOT_DIR)
  _varNames+=(XDG_RUNTIME_DIR XDG_CONFIG_HOME XDG_DATA_HOME XDG_STATE_HOME XDG_CACHE_HOME)
  
  source "$SH_LIB_DIR"/logging.lib ~/test-shell.log
  source "$SH_LIB_DIR"/amx.lib export

  _varNames+=(PATH)
  echo "Config is:"
  for v in "${_varNames[@]}"; do
    if [ -e "${!v}" ]; then
      echo " * $v = $(realpath "${!v}" --relative-base="$ROOT_DIR")"
    else
      echo " * $v = ${!v}"
    fi
  done
  echo

  if [ "$#" -gt 0 ]; then
    CMD=("$@")
    CMD="${CMD[@]}"
    echo "running command [$CMD]"
    bash -c "$CMD"
  else
    echo "Entering pre-configured sub-shell for testing."
    export PS1="[T:\u@\W]$ "
    exec bash
  fi
)