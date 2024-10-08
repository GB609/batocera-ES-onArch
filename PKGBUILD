# Maintainer: K. Teichmann
pkgname=batocera-emulationstation
pkgver=0.0.1
pkgrel=1
pkgdesc="Emulationstation from batocera plus some scripts for fully working integration into Arch"
arch=('x86_64')
url="https://github.com/Ark-GameBox"
license=('MIT')
# first dep is primary package, others in same line for 'implementorOf' packages or thematic groups
depends=(
	'cmake'
	#'retroarch'	
	#'wine-staging'
	#'nodejs'
	'freeimage'
	'sdl2_mixer'
	#stores and runners
	'sdl2' 'rapidjson' 'boost' 'libvlc' 'id3v2'
)

source=(
	'git+https://github.com/batocera-linux/batocera-emulationstation.git#commit=7c43b74063b150016152a9bcd505589b0e4e6e2a'
	'https://raw.githubusercontent.com/batocera-linux/batocera.linux/refs/heads/master/package/batocera/emulationstation/batocera-emulationstation/controllers/es_input.cfg'
	'git+https://github.com/fabricecaruso/es-theme-carbon.git#commit=06db7dc11c1eb618ccaccad6343e861071271dd5'
)

md5sums=('SKIP' 'SKIP' 'SKIP')

prepare(){
	cd "$srcdir/batocera-emulationstation"
	git submodule update --init
	
	cd external/id3v2lib
	#lib is linked statically, no need to install the object archives and headers
	installRemoved=$(cat src/CMakeLists.txt | grep -Ev '^INSTALL')
	echo "$installRemoved" > src/CMakeLists.txt
	
	cp "$srcdir/es_input.cfg" "$srcdir"/../additional-files/opt/batocera-emulationstation/bin
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
	
	#basic theme
	mkdir -p "$binPath/../system/themes"
	cp -r "$srcdir/es-theme-carbon" "$binPath/../system/themes"
	rm -rf "$binPath/../system/themes/*/.git*"
	
	#patch in additional files
	cp -r "$srcdir"/../additional-files/* "$pkgdir"
}