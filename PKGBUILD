# Maintainer: K. Teichmann
options=("!debug")
pkgname=batocera-emulationstation
pkgver=41
pkgrel=1
pkgdesc="Emulationstation from batocera plus some scripts for fully working integration into Arch"
arch=('x86_64')
url="https://github.com/Ark-GameBox"
license=(
  'GPL-2.0-or-later'               #config files from batocera.linux
  'Apache-2.0' 'Ubuntu-font-1.0'   #fonts used in batocera-emulationstation
  'BSD-2-Clause'                   #copy of id3v2lib provided in repo of batocera-emulationstation
  'Zlib'                           #(modified) copy of nanosvg in repo of batocera-emulationstation
  'MIT'                            #batocera-linux, batocera-emulationstation, emulationstation-de, inbuilt library rcheevos, anything in this repo
)
depends=(
  #building of ES itself
  'sdl2_mixer' 'sdl2' 'libpulse'
  'rapidjson' 'boost' 'libvlc' 'freeimage' 'freetype2' 'pugixml'
  #PKGBUILD and emulator configuration
  'nodejs'
)

# these are added to 'depends' in package()
_runtimeDependencies=(
  #required for emulator/game launching
  'fuse3'
  'fuse-overlayfs' # no-root overlays
  'squashfuse' 'fuseiso' 'bindfs'
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

SRCDEST="$startdir/tmp/downloads"

# source array is built dynamically with different urls from batocera and es-de
_ESDE_REVISION="v3.1.1"
_ESDE_RAWGIT_ROOT="https://gitlab.com/es-de/emulationstation-de/-/raw/${_ESDE_REVISION}"
_BATOCERA_REVISION="a0d3684e9716234df64b9b549b19923745cbbffe"
_BATOCERA_RAWGIT_ROOT="https://raw.githubusercontent.com/batocera-linux/batocera.linux/${_BATOCERA_REVISION}/package/batocera"
_BATOCERA_ES_MK_URL="${_BATOCERA_RAWGIT_ROOT}/emulationstation/batocera-emulationstation/batocera-emulationstation.mk"

if ! [ -f "$SRCDEST"/rev_"$_BATOCERA_REVISION" ]; then
  echo "Downloading version info from $_BATOCERA_ES_MK_URL ..."
  mkdir -p "$SRCDEST"
  curl -s "$_BATOCERA_ES_MK_URL" > "$SRCDEST"/rev_"$_BATOCERA_REVISION"
else
  echo "Skip downloading version info because it was cached already"
fi
_BATOCERA_ES_REVISION=$(grep 'BATOCERA_EMULATIONSTATION_VERSION' "$SRCDEST"/rev_"$_BATOCERA_REVISION" | cut -d'=' -f2 | xargs)

_confPathEmulatorLauncher="rootfs/etc/emulatorlauncher"
_confPathEmulationStation="rootfs/opt/batocera-emulationstation/conf.d"
mkdir -p "$SRCDEST/$_confPathEmulatorLauncher" "$SRCDEST/rootfs/usr/share/licenses/batocera-emulationstation"
source=(
  "batocera-emulationstation::git+https://github.com/batocera-linux/batocera-emulationstation.git#commit=${_BATOCERA_ES_REVISION}"
  "${_confPathEmulatorLauncher}/es_find_rules.xml::${_ESDE_RAWGIT_ROOT}/resources/systems/linux/es_find_rules.xml"
  "rootfs/usr/share/licenses/batocera-emulationstation/MIT_emulationstation-de::${_ESDE_RAWGIT_ROOT}/LICENSE"
)
md5sums=('SKIP' 'SKIP' 'SKIP')
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
    _localPath=$(realpath -m "$_localPath" --relative-to=$(pwd))
    mkdir -p "$SRCDEST/$_localPath"
    _sourceSpec="${_localPath}/$(basename "$_remotePath")::${_BATOCERA_RAWGIT_ROOT}/${_remotePath}"
  fi
  source+=("$_sourceSpec")
  md5sums+=('SKIP')
done

prepare(){
  cd "$srcdir/batocera-emulationstation"
  git submodule update --init

  cd external/id3v2lib
  #lib is linked statically, no need to install the object archives and headers
  installRemoved=$(cat src/CMakeLists.txt | grep -Ev '^INSTALL')
  echo "$installRemoved" > src/CMakeLists.txt

  local packageTarget="$SRCDEST/rootfs/opt/batocera-emulationstation"
  mkdir -p "$packageTarget"
  versionJson="{
  'package': '${pkgver}-${pkgrel}',
  'batocera-configs': '${_BATOCERA_REVISION}',
  'emulationstation': '${_BATOCERA_ES_REVISION}',
  'es-de-configs' : '${_ESDE_REVISION}'
}" 
  echo -e "${versionJson//\'/\"}" > "$packageTarget"/versions.json
}

_generateConfig(){
  echo "generating config files from sources..."
  btcDir="$startdir"/sources/fs-root/opt/batocera-emulationstation
  targetFs="$SRCDEST"/rootfs
  mkdir -p "$targetFs"/etc/batocera-emulationstation "$targetFs"/opt/batocera-emulationstation/bin

  #import/generate system default configs
  cp -rf "$startdir"/sources/fs-root/etc/batocera-emulationstation/conf.d "$targetFs"/etc/batocera-emulationstation/
  FS_ROOT="$targetFs" "$btcDir"/btc-config generateGlobalConfig \
    --comment "Generated during PKGBUILD from git:batocera.linux:${_BATOCERA_REVISION}, git:batocera-emulationstation: ${_BATOCERA_ES_REVISION}"
  return $?
}

build(){
  cd "$srcdir/batocera-emulationstation"
  cmake -Wno-dev -S . -B . \
    -DENABLE_FILEMANAGER=ON -DDISABLE_KODI=ON -DENABLE_PULSE=ON -DUSE_SYSTEM_PUGIXML=ON \
    --install-prefix=/opt/batocera-emulationstation \
    -DCMAKE_C_FLAGS="-g0" -DCMAKE_CXX_FLAGS="-g0" -DCMAKE_BUILD_TYPE="Release" .

  make

  _generateConfig
}

package(){
  for (( i=0; i < "${#_runtimeDependencies[@]}"; i++ )); do
    source+=("${_runtimeDependencies[i]}")
  done

  srcRoot="$srcdir/batocera-emulationstation"
  cd "$srcRoot"
  export DESTDIR="$pkgdir/"
  make install/strip

  binPath="$pkgdir/opt/batocera-emulationstation/bin"

  #resources
  cp -r "$srcRoot/resources" "$binPath"

  #licenses from emulationstation repo, including libraries contained and build by batocera-emulationstation
  install -Dm0644 -T "$srcRoot/LICENSE.md" "$pkgdir/usr/share/licenses/$pkgname/MIT_batocera-emulationstation"
  install -Dm0644 -t "$pkgdir/usr/share/licenses/$pkgname/" "$srcRoot"/*licen?e.txt
  install -Dm0644 -T "$srcRoot/external/id3v2lib/LICENSE" "$pkgdir/usr/share/licenses/$pkgname/BSD-2-Clause_id3v2lib"
  install -Dm0644 -T "$srcRoot/external/libcheevos/rcheevos/LICENSE" "$pkgdir/usr/share/licenses/$pkgname/MIT_rcheevos"
  install -Dm0644 -T "$srcRoot/external/nanosvg/nanosvg_license.txt" "$pkgdir/usr/share/licenses/$pkgname/Zlib_nanosvg"
  #license of the code placed in this PKGBUILD repo
  install -Dm0644 -t "$pkgdir/usr/share/licenses/$pkgname/" "$startdir/ABOUT-LICENSES"
  install -Dm0644 -T "$startdir/LICENSE" "$pkgdir/usr/share/licenses/$pkgname/MIT_pkgbuild-additions"

  #List all (external) sources
  for (( i=0; i < "${#source[@]}"; i++ )); do
    _file="${source[i]%%::*}"
    _url="${source[i]#*::}"
    echo "- ${_file#rootfs}: $_url" >> "$pkgdir/usr/share/licenses/$pkgname/ABOUT-LICENSES"
  done
  
  #localization
  mkdir -p "$pkgdir/usr"
  cp -rf "$binPath"/../share/* "$pkgdir/usr/"

  #patch in additional files
  cp -rf "$startdir"/sources/fs-root/* "$pkgdir"

  #copy config source files
  cp -rf "$SRCDEST"/rootfs/* "$pkgdir"
}
