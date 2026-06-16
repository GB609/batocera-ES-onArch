# SPDX-FileCopyrightText: 2025 Karsten Teichmann
#
# SPDX-License-Identifier: MIT

executable="$(locateExecutable "pcsx2")"
launchCommand=("$executable" -nogui -fullscreen -fastboot -datapath "${CONFIG_FILE_PATH}" -- "$rom")

if ! [ -d "${CONFIG_FILE_PATH}" ]; then
  mkdir -p "${CONFIG_FILE_PATH}"
fi

#TODO: write property files to "${CONFIG_FILE_PATH}", and link save dir (when there is no direct config option to specify save path)
