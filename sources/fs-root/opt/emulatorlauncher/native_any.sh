# SPDX-FileCopyrightText: 2025 Karsten Teichmann
#
# SPDX-License-Identifier: MIT

launchCommand=("$FS_ROOT"/usr/bin/emulationstation-native "$absRomPath" -cfg "$CONFIG_FILE_PATH")

cat << EOF > "$CONFIG_FILE_PATH" 
$(declaredVars)
EOF

configFiles+=("$CONFIG_FILE_PATH")