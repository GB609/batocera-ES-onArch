launchCommand=("$FS_ROOT"/usr/bin/emulationstation-wine install "'$rom'" -cfg "$CONFIG_FILE_PATH")
cat << EOF > "$CONFIG_FILE_PATH" 
export INSTALL_DATE="$(date)"
EOF

configFiles+=("$CONFIG_FILE_PATH")