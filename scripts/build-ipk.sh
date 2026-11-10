#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${DIST_DIR:-$ROOT_DIR/dist}"
CACHE_DIR="${CACHE_DIR:-$ROOT_DIR/.cache}"
PKG_REL="${PKG_REL:-1}"
ARCHS="${ARCHS:-amd64 arm64 riscv64}"
BASE_URL="${BASE_URL:-https://dl.lazycatmicroserver.com/hclient-cli}"

mkdir -p "$DIST_DIR" "$CACHE_DIR"

echo "==> Fetching upstream manifest from $BASE_URL/latest-version.json ..."
MANIFEST_FILE="$CACHE_DIR/latest-version.json"
curl -fsSL "$BASE_URL/latest-version.json" -o "$MANIFEST_FILE"

RAW_VERSION="$(jq -r '.version' "$MANIFEST_FILE")"
if [ -z "$RAW_VERSION" ] || [ "$RAW_VERSION" = "null" ]; then
	echo "ERROR: Failed to parse version from latest-version.json" >&2
	exit 1
fi

PKG_VERSION="${RAW_VERSION#v}"
echo "==> Upstream version: $RAW_VERSION (OpenWrt PKG_VERSION: $PKG_VERSION-$PKG_REL)"

map_openwrt_arch() {
	case "$1" in
		amd64)   echo "x86_64" ;;
		arm64)   echo "aarch64_generic" ;;
		riscv64) echo "riscv64" ;;
		*)       echo "$1" ;;
	esac
}

map_uname_arch() {
	case "$1" in
		amd64)   echo "x86_64" ;;
		arm64)   echo "aarch64" ;;
		riscv64) echo "riscv64" ;;
		*)       echo "$1" ;;
	esac
}

populate_common_files() {
	local stage="$1"
	mkdir -p "$stage/CONTROL"
	mkdir -p "$stage/usr/libexec"
	mkdir -p "$stage/etc/init.d"
	mkdir -p "$stage/etc/config"
	mkdir -p "$stage/etc/hclient/state"
	mkdir -p "$stage/etc/uci-defaults"
	mkdir -p "$stage/usr/share/luci/menu.d"
	mkdir -p "$stage/usr/share/rpcd/acl.d"
	mkdir -p "$stage/www/luci-static/resources/view/hclient"
	mkdir -p "$stage/usr/lib/lua/luci/controller"
	mkdir -p "$stage/usr/lib/lua/luci/view/hclient"

	cp -f "$ROOT_DIR/files/hclient-call" "$stage/usr/libexec/hclient-call"
	cp -f "$ROOT_DIR/files/hclient.init" "$stage/etc/init.d/hclient"
	cp -f "$ROOT_DIR/files/hclient.config" "$stage/etc/config/hclient"
	cp -f "$ROOT_DIR/files/99-luci-hclient" "$stage/etc/uci-defaults/99-luci-hclient"
	cp -f "$ROOT_DIR/files/luci/menu.json" "$stage/usr/share/luci/menu.d/luci-app-hclient.json"
	cp -f "$ROOT_DIR/files/luci/acl.json" "$stage/usr/share/rpcd/acl.d/luci-app-hclient.json"
	cp -f "$ROOT_DIR/files/luci/index.js" "$stage/www/luci-static/resources/view/hclient/index.js"
	cp -f "$ROOT_DIR/files/luci/controller.lua" "$stage/usr/lib/lua/luci/controller/hclient.lua"
	cp -f "$ROOT_DIR/files/luci/index.htm" "$stage/usr/lib/lua/luci/view/hclient/index.htm"

	cat > "$stage/CONTROL/conffiles" << 'EOF'
/etc/config/hclient
EOF

	cat > "$stage/CONTROL/postinst" << 'EOF'
#!/bin/sh
[ -n "$IPKG_INSTROOT" ] || {
	if [ -x /etc/uci-defaults/99-luci-hclient ]; then
		/etc/uci-defaults/99-luci-hclient && rm -f /etc/uci-defaults/99-luci-hclient
	else
		/etc/init.d/hclient enable >/dev/null 2>&1 || true
		/etc/init.d/hclient restart >/dev/null 2>&1 || true
		/etc/init.d/rpcd reload >/dev/null 2>&1 || true
		rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache/* 2>/dev/null || true
	fi
}
exit 0
EOF

	cat > "$stage/CONTROL/prerm" << 'EOF'
#!/bin/sh
[ -n "$IPKG_INSTROOT" ] || {
	/etc/init.d/hclient stop >/dev/null 2>&1 || true
	/etc/init.d/hclient disable >/dev/null 2>&1 || true
	rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache/* 2>/dev/null || true
}
exit 0
EOF

	find "$stage" -type d -exec chmod 755 {} +
	find "$stage" -type f -exec chmod 644 {} +
	chmod 755 "$stage/usr/libexec/hclient-call"
	chmod 755 "$stage/etc/init.d/hclient"
	chmod 755 "$stage/etc/uci-defaults/99-luci-hclient"
	chmod 755 "$stage/CONTROL/postinst"
	chmod 755 "$stage/CONTROL/prerm"
}

for arch in $ARCHS; do
	ART_KEY="linux-$arch"
	BIN_NAME="$(jq -r ".artifacts[\"$ART_KEY\"].name" "$MANIFEST_FILE")"
	EXPECTED_SHA256="$(jq -r ".artifacts[\"$ART_KEY\"].sha256" "$MANIFEST_FILE")"

	if [ -z "$BIN_NAME" ] || [ "$BIN_NAME" = "null" ]; then
		echo "ERROR: Missing artifact entry for $ART_KEY in latest-version.json" >&2
		exit 1
	fi

	BIN_PATH="$CACHE_DIR/${BIN_NAME}-${RAW_VERSION}"
	NEED_DL=1
	if [ -f "$BIN_PATH" ]; then
		ACTUAL_SHA256="$(sha256sum "$BIN_PATH" | awk '{print $1}')"
		if [ "$ACTUAL_SHA256" = "$EXPECTED_SHA256" ]; then
			NEED_DL=0
			echo "==> Cached binary verified for $ART_KEY ($RAW_VERSION)"
		fi
	fi

	if [ "$NEED_DL" -eq 1 ]; then
		DL_URL="$BASE_URL/$RAW_VERSION/$BIN_NAME"
		echo "==> Downloading $DL_URL ..."
		curl -fL --retry 3 "$DL_URL" -o "$BIN_PATH"
		ACTUAL_SHA256="$(sha256sum "$BIN_PATH" | awk '{print $1}')"
		if [ "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]; then
			echo "ERROR: SHA256 mismatch for $BIN_NAME! Expected $EXPECTED_SHA256, got $ACTUAL_SHA256" >&2
			exit 1
		fi
		echo "==> SHA256 verified: $ACTUAL_SHA256"
	fi

	OWRT_ARCH="$(map_openwrt_arch "$arch")"
	UNAME_ARCH="$(map_uname_arch "$arch")"

	STAGE_DIR="$(mktemp -d)"
	populate_common_files "$STAGE_DIR"
	mkdir -p "$STAGE_DIR/usr/bin"
	cp -f "$BIN_PATH" "$STAGE_DIR/usr/bin/hclient-cli"
	chmod 755 "$STAGE_DIR/usr/bin/hclient-cli"

	cat > "$STAGE_DIR/CONTROL/preinst" << EOF
#!/bin/sh
if [ -z "\$IPKG_INSTROOT" ]; then
	HOST_ARCH="\$(uname -m 2>/dev/null || true)"
	if [ -n "\$HOST_ARCH" ] && [ "\$HOST_ARCH" != "$UNAME_ARCH" ]; then
		echo "ERROR: Package is built for $arch ($UNAME_ARCH), but router CPU is \$HOST_ARCH" >&2
		exit 1
	fi
fi
exit 0
EOF
	chmod 755 "$STAGE_DIR/CONTROL/preinst"

	# 1. Build universal subtarget-compatible IPK (Architecture: all with preinst CPU guard)
	cat > "$STAGE_DIR/CONTROL/control" << EOF
Package: hclient-cli
Version: ${PKG_VERSION}-${PKG_REL}
Depends: kmod-tun, ca-bundle
Section: net
Architecture: all
Installed-Size: 0
Maintainer: zccrs
Description: Lazycat Microserver (hportal) network service, CLI daemon, and LuCI Web UI for OpenWrt ($arch / $UNAME_ARCH).
EOF
	"$ROOT_DIR/scripts/ipkg-build" "$STAGE_DIR" "$DIST_DIR" "hclient-cli_${PKG_VERSION}-${PKG_REL}_linux_${arch}.ipk"

	# 2. Build strict OpenWrt arch-named IPK (x86_64 / aarch64_generic / riscv64)
	cat > "$STAGE_DIR/CONTROL/control" << EOF
Package: hclient-cli
Version: ${PKG_VERSION}-${PKG_REL}
Depends: kmod-tun, ca-bundle
Section: net
Architecture: ${OWRT_ARCH}
Installed-Size: 0
Maintainer: zccrs
Description: Lazycat Microserver (hportal) network service, CLI daemon, and LuCI Web UI for OpenWrt ($OWRT_ARCH).
EOF
	"$ROOT_DIR/scripts/ipkg-build" "$STAGE_DIR" "$DIST_DIR" "hclient-cli_${PKG_VERSION}-${PKG_REL}_${OWRT_ARCH}.ipk"

	rm -rf "$STAGE_DIR"
done

# Build standalone LuCI package (luci-app-hclient)
LUCI_STAGE="$(mktemp -d)"
populate_common_files "$LUCI_STAGE"
rm -rf "$LUCI_STAGE/etc/init.d" "$LUCI_STAGE/etc/config" "$LUCI_STAGE/etc/hclient" "$LUCI_STAGE/CONTROL/conffiles"
cat > "$LUCI_STAGE/CONTROL/control" << EOF
Package: luci-app-hclient
Version: ${PKG_VERSION}-${PKG_REL}
Depends: hclient-cli
Section: luci
Architecture: all
Installed-Size: 0
Maintainer: zccrs
Description: LuCI Web UI for Lazycat Microserver (HClient) network service.
EOF
"$ROOT_DIR/scripts/ipkg-build" "$LUCI_STAGE" "$DIST_DIR" "luci-app-hclient_${PKG_VERSION}-${PKG_REL}_all.ipk"
rm -rf "$LUCI_STAGE"

( cd "$DIST_DIR" && sha256sum *.ipk > SHA256SUMS )
echo "$RAW_VERSION" > "$DIST_DIR/VERSION"
echo "==> All packages built successfully in $DIST_DIR:"
ls -lh "$DIST_DIR"
