#!/bin/bash

# Configure envs so that all processes started from will use the same values for FS_ROOT, ES_HOME etc.
# Required to bring btc-config in sync the executables unser sources/fs-root/usr/bin
# Also changes XDG directories and user home

# First unset all in the current shell to make sure configurations of the real system dont interfere
(
  ROOT_DIR="$(dirname "$(readlink -f "$0")")"
  ROOT_DIR="$(realpath -s "$ROOT_DIR/..")"
  TEST_ROOT="$ROOT_DIR"/tmp/FS_ROOT
  mkdir -p "$TEST_ROOT"

  "$ROOT_DIR"/scripts/generate-config.sh "$TEST_ROOT"
  ln -s "$ROOT_DIR"/pkg/batocera-emulationstation/opt/batocera-emulationstation/bin/resources \
        "$TEST_ROOT"/opt/batocera-emulationstation/bin/resources
  ln -s "$ROOT_DIR"/pkg/batocera-emulationstation/opt/batocera-emulationstation/bin/emulationstation \
        "$TEST_ROOT"/opt/batocera-emulationstation/bin/emulationstation
  ln -s "$ROOT_DIR"/sources/fs-root/etc/batocera-emulationstation/controller-profiles \
        "$TEST_ROOT"/etc/batocera-emulationstation/controller-profiles
  rsync -a "$ROOT_DIR"/test/resource/fs_root/home/ "$TEST_ROOT"/home/
  
  # ... But do everything in a sub-shell to not destroy the real environment
  unset XDG_CONFIG_HOME XDG_DATA_HOME XDG_STATE_HOME XDG_CACHE_HOME
  unset ES_HOME ES_CONFIG_HOME ES_DATA_DIR ES_STATE_DIR ES_CACHE_DIR
  unset DEFAULT_ROMS_ROOT ROMS_ROOT_DIR SAVES_ROOT_DIR
  unset EMU_CMD_DIR EMU_CFG_DIR

  # for all using common-paths.lib
  export FS_ROOT="$ROOT_DIR"/sources/fs-root
  export HOME="$TEST_ROOT"/home/test
  export ES_CONFIG_HOME="$HOME"/.emulationstation
  export CONFIG_ROOT="$TEST_ROOT"/etc
  export ROMS_ROOT_DIR="$HOME"/ROMs

  # usr/bin/emulatorlauncher, normally under CONFIG_ROOT
  #export EMU_CFG_DIR=""

  # btc-config
  #export DROPIN_PATH="$CONFIG_ROOT"/conf.d

  # btc-config and usr/bin/emulationstation
  #this only works if the package has been built at least once
  export BTC_BIN_DIR="$TEST_ROOT"/opt/batocera-emulationstation/bin

  export PATH="$FS_ROOT/usr/bin:$PATH"
  PATH="$FS_ROOT/opt/batocera-emulationstation:$PATH"
  mkdir -p "$HOME" "$CONFIG_ROOT" 
  #"$DROPIN_PATH"

  echo "Config is:"
  for v in FS_ROOT HOME ES_CONFIG_HOME CONFIG_ROOT ROMS_ROOT_DIR EMU_CFG_DIR DROPIN_PATH BTC_BIN_DIR PATH; do
    echo " * $v = ${!v}"
  done
  echo

  if [ "$#" -gt 0 ]; then
    CMD=("$@")
    CMD="${CMD[@]}"
    echo "running command [$CMD]"
    bash -c "$CMD"
  else
    echo "Entering pre-configured sub-shell for testing."
    bash
  fi
)