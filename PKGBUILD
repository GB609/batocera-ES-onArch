# Maintainer: K. Teichmann
options=("!debug")
pkgname=batocera-emulationstation
pkgver=0.0.1
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
)
makedepends=('cmake')
optdepends=(
  'batocera-es-theme-carbon: default theme as standalone package'
  'batocera-es-pacman: integrate batocera store with pacman (not implemented yet)'
  'umu-launcher: for windows based games and emulators'
)

source=(
  'git+https://github.com/batocera-linux/batocera-emulationstation.git#commit=7c43b74063b150016152a9bcd505589b0e4e6e2a'
  'https://raw.githubusercontent.com/batocera-linux/batocera.linux/refs/heads/master/package/batocera/emulationstation/batocera-emulationstation/controllers/es_input.cfg'
)

md5sums=('SKIP' 'SKIP')

prepare(){
	cd "$srcdir/batocera-emulationstation"
	git submodule update --init
	
	cd external/id3v2lib
	#lib is linked statically, no need to install the object archives and headers
	installRemoved=$(cat src/CMakeLists.txt | grep -Ev '^INSTALL')
	echo "$installRemoved" > src/CMakeLists.txt
	
	cp "$srcdir/es_input.cfg" "$srcdir"/../additional-files/opt/batocera-emulationstation/bin

 	#cd "$srcdir"/../additional-files/opt/batocera-emulationstation/bin
  #	systemsFile=$(tail -n +2 es_systems.cfg)
  # 	notes='<!-- file is preprocessed in PKGBUILD to change /userdata/roms to ~/ROMs -->\n'
  #  	xmlTag="$(head -n 1 es_systems.cfg)\n"
  # 	echo -e "${xmlTag}${notes}${systemsFile//\/userdata\/roms\//\~\/ROMs\/}" > es_systems.cfg
}

build(){
	cd "$srcdir/batocera-emulationstation"
	cmake -S . -B . \
		-DENABLE_FILEMANAGER=ON -DDISABLE_KODI=ON -DENABLE_PULSE=ON -DUSE_SYSTEM_PUGIXML=ON \
		--install-prefix=/opt/batocera-emulationstation \
		-DCMAKE_C_FLAGS="-g0" -DCMAKE_CXX_FLAGS="-g0" -DCMAKE_BUILD_TYPE="Release" .
	
	make
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
	
	#import/generate system default configs
	btcDir="$pkgdir"/opt/batocera-emulationstation
	cfgDir="$btcDir"/conf.d
	"$btcDir"/config.js importBatoceraConfig \
    "$cfgDir"/batocera.conf "$cfgDir"/configgen-defaults.yml "$cfgDir"/configgen-defaults-x86_64.yml \
    -o "$pkgdir"/etc
}
