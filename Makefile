include $(TOPDIR)/rules.mk

PKG_NAME:=hclient-cli
PKG_VERSION:=1.5.7
PKG_RELEASE:=1

PKG_MAINTAINER:=zccrs
PKG_LICENSE:=Proprietary

include $(INCLUDE_DIR)/package.mk

ifeq ($(ARCH),x86_64)
  HCLIENT_ARCH:=amd64
endif
ifeq ($(ARCH),aarch64)
  HCLIENT_ARCH:=arm64
endif
ifeq ($(ARCH),riscv64)
  HCLIENT_ARCH:=riscv64
endif

define Package/hclient-cli
  SECTION:=net
  CATEGORY:=Network
  SUBMENU:=VPN
  TITLE:=Lazycat Microserver Network Service & LuCI UI
  URL:=https://lazycat.cloud
  DEPENDS:=@(TARGET_x86_64||ARCH_aarch64||ARCH_riscv64) +kmod-tun +ca-bundle
endef

define Package/hclient-cli/description
  Lazycat Microserver (hportal) network service daemon, CLI tool, and LuCI Web UI for OpenWrt (amd64 / arm64 / riscv64).
endef

define Package/hclient-cli/conffiles
/etc/config/hclient
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
	if [ -f ./files/hclient-cli-linux-$(HCLIENT_ARCH) ]; then \
		cp -f ./files/hclient-cli-linux-$(HCLIENT_ARCH) $(PKG_BUILD_DIR)/hclient-cli; \
	elif [ -f ./files/hclient-cli ]; then \
		cp -f ./files/hclient-cli $(PKG_BUILD_DIR)/hclient-cli; \
	else \
		curl -fsSL "https://dl.lazycatmicroserver.com/hclient-cli/v$(PKG_VERSION)/hclient-cli-linux-$(HCLIENT_ARCH)" -o $(PKG_BUILD_DIR)/hclient-cli; \
	fi
	chmod 0755 $(PKG_BUILD_DIR)/hclient-cli
endef

define Build/Compile
	# Precompiled binary, nothing to compile
endef

define Package/hclient-cli/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/hclient-cli $(1)/usr/bin/hclient-cli
	$(INSTALL_DIR) $(1)/usr/libexec
	$(INSTALL_BIN) ./files/hclient-call $(1)/usr/libexec/hclient-call
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/hclient.init $(1)/etc/init.d/hclient
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/hclient.config $(1)/etc/config/hclient
	$(INSTALL_DIR) $(1)/etc/hclient/state
	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_BIN) ./files/99-luci-hclient $(1)/etc/uci-defaults/99-luci-hclient
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./files/luci/menu.json $(1)/usr/share/luci/menu.d/luci-app-hclient.json
	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./files/luci/acl.json $(1)/usr/share/rpcd/acl.d/luci-app-hclient.json
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/hclient
	$(INSTALL_DATA) ./files/luci/index.js $(1)/www/luci-static/resources/view/hclient/index.js
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/controller
	$(INSTALL_DATA) ./files/luci/controller.lua $(1)/usr/lib/lua/luci/controller/hclient.lua
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/view/hclient
	$(INSTALL_DATA) ./files/luci/index.htm $(1)/usr/lib/lua/luci/view/hclient/index.htm
endef

define Package/hclient-cli/postinst
#!/bin/sh
[ -n "$$$$IPKG_INSTROOT" ] || {
	if [ -x /etc/uci-defaults/99-luci-hclient ]; then
		/etc/uci-defaults/99-luci-hclient && rm -f /etc/uci-defaults/99-luci-hclient
	fi
}
exit 0
endef

define Package/hclient-cli/prerm
#!/bin/sh
[ -n "$$$$IPKG_INSTROOT" ] || {
	/etc/init.d/hclient stop >/dev/null 2>&1 || true
	/etc/init.d/hclient disable >/dev/null 2>&1 || true
	rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache/* 2>/dev/null || true
}
exit 0
endef

$(eval $(call BuildPackage,hclient-cli))
