# Maintainer: K. Teichmann
options=("!debug")
pkgname=batocera-emulationstation
pkgver=40
pkgrel=1
pkgdesc="Emulationstation from batocera plus some scripts for fully working integration into Arch"
arch=('x86_64')
url="https://github.com/Ark-GameBox"
license=('MIT')
depends=(
  #building of ES itself
  'sdl2_mixer' 'sdl2' 'libpulse'
  'rapidjson' 'boost' 'libvlc' 'freeimage' 'freetype2' 'pugixml'
  #PKGBUILD and emulator configuration
  'nodejs'
  #required for emulator/game launching
  'fuse3'
  'fuse-overlayfs' # no-root overlays
  'squashfuse' 'fuseiso'
)
makedepends=('cmake')
optdepends=(
  'batocera-es-theme-carbon: default theme as standalone package'
  'batocera-es-pacman: integrate batocera store with pacman (not implemented yet)'
  'wine: for windows based games and emulators' 
  'umu-launcher: alternative for windows based games and emulators'
  'winetricks: required for game isolation when wine/umu is used'
  'rsync: required to separately manage game updates and save games for wine games'
)

_BATOCERA_REVISION="refs/tags/batocera-40"
_BATOCERA_RAWGIT_ROOT="https://raw.githubusercontent.com/batocera-linux/batocera.linux/${_BATOCERA_REVISION}/package/batocera"
_BATOCERA_ES_MK_URL="${_BATOCERA_RAWGIT_ROOT}/emulationstation/batocera-emulationstation/batocera-emulationstation.mk"
_BATOCERA_ES_REVISION=$(curl -s "$_BATOCERA_ES_MK_URL" | grep 'BATOCERA_EMULATIONSTATION_VERSION' | cut -d'=' -f2 | xargs)
SRCDEST="$startdir/downloads"
_confPathEmulatorLauncher="rootfs/etc/emulatorlauncher"
_confPathEmulationStation="rootfs/opt/batocera-emulationstation/conf.d"
mkdir -p "$SRCDEST/$_confPathEmulatorLauncher"
source=(
  "git+https://github.com/batocera-linux/batocera-emulationstation.git#commit=${_BATOCERA_ES_REVISION}"
  "${_confPathEmulatorLauncher}/es_find_rules.xml::https://gitlab.com/es-de/emulationstation-de/-/raw/master/resources/systems/linux/es_find_rules.xml"
)
md5sums=('SKIP' 'SKIP')
echo "adding config files from batocera revision '${_BATOCERA_REVISION}' to sources..."
_BATOCERA_CFG_FILES=(
  "${_confPathEmulationStation}+core/batocera-configgen/configs/configgen-defaults.yml"
  "${_confPathEmulationStation}+core/batocera-configgen/configs/configgen-defaults-x86_64.yml"
  "${_confPathEmulationStation}+core/batocera-system/batocera.conf"
  "${_confPathEmulationStation}/../bin+emulationstation/batocera-emulationstation/controllers/es_input.cfg"
  "${_confPathEmulationStation}+emulationstation/batocera-es-system/es_features.yml"
  "${_confPathEmulationStation}+emulationstation/batocera-es-system/es_systems.yml"
)
for _cfg in "${_BATOCERA_CFG_FILES[@]}"; do
  _localPath=$(echo "$_cfg" | cut -d'+' -f1)
  _remotePath=$(echo "$_cfg" | cut -d'+' -f2)
  if [ "$_localPath" = "$_remotePath" ]; then
    _sourceSpec="${_BATOCERA_RAWGIT_ROOT}/${_cfg}"
  else
    mkdir -p "$SRCDEST/$_localPath"
    _sourceSpec="${_localPath}/$(basename "$_remotePath")::${_BATOCERA_RAWGIT_ROOT}/${_remotePath}"
  fi
  echo "Adding source: '$_sourceSpec'"
  source+=("$_sourceSpec")
  md5sums+=('SKIP')
done

prepare(){
  return 0
  cd "$srcdir/batocera-emulationstation"
  git submodule update --init
  
  cd external/id3v2lib
  #lib is linked statically, no need to install the object archives and headers
  installRemoved=$(cat src/CMakeLists.txt | grep -Ev '^INSTALL')
  echo "$installRemoved" > src/CMakeLists.txt
  
   #cd "$srcdir"/../additional-files/opt/batocera-emulationstation/bin
  #  systemsFile=$(tail -n +2 es_systems.cfg)
  #   notes='<!-- file is preprocessed in PKGBUILD to change /userdata/roms to ~/ROMs -->\n'
  #    xmlTag="$(head -n 1 es_systems.cfg)\n"
  #   echo -e "${xmlTag}${notes}${systemsFile//\/userdata\/roms\//\~\/ROMs\/}" > es_systems.cfg
}

build(){
  cd "$srcdir/batocera-emulationstation"
  cmake -S . -B . \
    -DENABLE_FILEMANAGER=ON -DDISABLE_KODI=ON -DENABLE_PULSE=ON -DUSE_SYSTEM_PUGIXML=ON \
    --install-prefix=/opt/batocera-emulationstation \
    -DCMAKE_C_FLAGS="-g0" -DCMAKE_CXX_FLAGS="-g0" -DCMAKE_BUILD_TYPE="Release" .
  
  make
  
  echo "generating config files from sources..."
  btcDir="$startdir"/additional-files/opt/batocera-emulationstation
  targetFs="$SRCDEST"/rootfs
  btcCfgSourceDir="$SRCDEST"/"${_confPathEmulationStation}"
  targetBinDir="$targetFs"/opt/batocera-emulationstation/bin
  mkdir -p "$targetBinDir"
  #import/generate system default configs
  "$btcDir"/config.js generate systems -s "$btcCfgSourceDir"/es_systems.yml -o "$targetBinDir"
  "$btcDir"/config.js generate features -s "$btcCfgSourceDir"/es_features.yml -o "$targetBinDir"
  "$btcDir"/config.js importBatoceraConfig \
    "$srcdir"/batocera.conf "$btcCfgSourceDir"/configgen-defaults.yml "$btcCfgSourceDir"/configgen-defaults-x86_64.yml \
    -o "$targetFs"/etc
}

package(){
  srcRoot="$srcdir/batocera-emulationstation"
  cd "$srcRoot"
  export DESTDIR="$pkgdir/"
  make install/strip
  
  binPath="$pkgdir/opt/batocera-emulationstation/bin"
  
  #resources
  cp -r "$srcRoot/resources" "$binPath"

  #licenses from emulationstation repo
  cp "$srcRoot/LICENSE.md" "$srcRoot"/*licen?e.txt "$binPath"
  
  #localization
  mkdir -p "$pkgdir/usr" 
  mv "$binPath/../share" "$pkgdir/usr"
  
  #patch in additional files
  cp -r "$srcdir"/../additional-files/* "$pkgdir"
  
  #copy config source files
  cp -r "$SRCDEST/rootfs/*" "$pkgdir"
}
