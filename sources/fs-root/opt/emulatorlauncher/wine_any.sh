# SPDX-FileCopyrightText: 2025 Karsten Teichmann
#
# SPDX-License-Identifier: MIT

launchCommand=("$FS_ROOT"/usr/bin/emulationstation-wine run "$absRomPath" -cfg "$CONFIG_FILE_PATH")

if [ "$core" = "dxvk" ]; then
  dxvk="${dxvk:-1}"
else
  dxvk="0"
fi

cat << EOF > "$CONFIG_FILE_PATH"
$(declaredVars)
 
export DXVK="${dxvk:-0}"
export DXVK_HUD="${dxvk_hud:-0}"
export DXVK_ENABLE_NVAPI="${dxvk_enable_nvapi:-0}"
export PROTON_ENABLE_NVAPI="${dxvk_enable_nvapi:-0}"
export DXVK_FRAME_RATE="$([[ "$dxvk_fps_limit" = "1" ]] && echo 60 || echo 0)"
export DXVK_STATE_CACHE="$([[ "$dxvk_reset_cache" = "1" ]] && echo reset || echo 1)"

export WINEESYNC="${esync:-1}"
export WINEFSYNC="${fsync:-1}"

export WINE_DISABLE_WRITE_WATCH="${no_write_watch:-0}"
export WINE_FULLSCREEN_FSR="${dxvk_fsr:-1}"
export WINE_HEAP_DELAY_FREE="${heap_delay_free:-0}"
export WINE_HIDE_NVIDIA_GPU="${hide_nvidia_gpu:-0}"
export WINE_LARGE_ADDRESS_AWARE="${force_large_adress:-1}"

export NTFS_MODE="${wine_ntfs:-0}"
export PBA_ENABLE="${pba:-0}"
EOF

configFiles+=("$CONFIG_FILE_PATH")