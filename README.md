# OpenWrt Lazycat HClient (`hclient-cli` + `luci-app-hclient`)

将 [懒猫微服 (Lazycat Microserver)](https://lazycat.cloud/download) 官方 Linux 无头客户端（`hclient-cli`）打包为 **OpenWrt / iStoreOS 路由级网络服务与 LuCI 可视化管理应用**。

本仓库配置了 **GitHub Actions 每日定时任务**，自动从懒猫官方源 [`https://dl.lazycatmicroserver.com/hclient-cli/latest-version.json`](https://dl.lazycatmicroserver.com/hclient-cli/latest-version.json) 检测最新版本，拉取 **`amd64`、`arm64`、`riscv64`** 三个架构的二进制文件，校验 SHA256 后自动打包为 `.ipk` 并发布到 [GitHub Releases](../../releases)。

---

## ✨ 功能特性

1. **完整的 LuCI Web 管理界面**（自适应 OpenWrt 18.06 ~ 24.10+ / iStoreOS / ImmortalWrt）：
   - **服务监控与控制**：实时展示守护进程状态、`heiyu-0` 虚拟网卡 IPv6 地址（`fc03:...`）、混合代理端口；支持网页一键**启动 / 停止 / 重启**及设置**开机自启动**。
   - **微服设备管理**：表格展示所有已绑定微服的 `Box ID`、名称、在线状态与打洞连接路径详情；支持网页一键**设为默认 / 启用 / 禁用 / 解绑删除**。
   - **三种网页登录方式**：支持**账号密码登录**、**网页生成二维码扫码登录**、**2FA 双因素验证码提交**。
   - **在线诊断与日志**：网页直接调用 `check`（TUN 环境检查）、`network-diagnostic`（网络穿透诊断）与实时运行日志读取。
2. **OpenWrt 路由级网络服务与开机自启动**：
   - **Procd 进程守护与开机自启**：安装后自动开启自启并拉起服务，异常退出自动重连。
   - **局域网共享转发 (`lan_access`)**：自动注册 `hclient` 防火墙区域（放行 `heiyu-+` 转发并开启 NAT66 伪装），让局域网内的手机/电脑无需安装客户端即可通过路由器直连微服。
   - **Dnsmasq 域名自动分流 (`dns_forward`)**：自动将 `*.heiyu.space` 解析指向微服虚拟 DNS（`fc03:1136:3800::1`）并加入防 DNS 重绑定白名单。
   - **自动绑定 `:1` 内核直通地址**：自动在 `heiyu-0` 网卡上挂载末尾为 `:1` 的 IPv6 地址（绕过 `hclient-cli` 用户态 gVisor 对 `:0` 地址 80/22 端口的拦截），支持从远端直接通过虚拟 IPv6 `:1` 访问 OpenWrt 路由器的 Web 后台与 SSH。
3. **GitHub 在线版本检测与自更新**：
   - LuCI 页面显示**已安装版本**与 **GitHub Releases 最新版本**，支持网页一键**检查更新**、**立即下载并更新**。
   - 内置 `hclient-update` 后台服务，默认每 24 小时自动检查 GitHub Releases；发现新版本时下载对应架构 IPK、**强制校验 SHA256** 后通过 `opkg` 原地升级并自动重启服务。
   - 全部行为可通过 UCI 配置：`update_enabled`（自动更新开关）、`update_interval_hours`（检查周期）、`update_repo`（自定义 GitHub 仓库，适配 fork/自建分支）。

---

## 📦 架构与安装包选择

前往 [Releases 页面](../../releases) 下载对应路由器 CPU 架构的 `.ipk` 包：

| 路由器架构 | 安装包名（均内置客户端 + 开机自启服务 + LuCI 界面） |
| :--- | :--- |
| **amd64 (`x86_64` 软路由)** | `hclient-cli_<版本>_amd64.ipk` |
| **arm64 (`aarch64` 路由/盒子)** | `hclient-cli_<版本>_arm64.ipk` |
| **riscv64 (`RISC-V` 64位路由)** | `hclient-cli_<版本>_riscv64.ipk` |

> **说明**：每个安装包均已完整内置客户端程序、Procd 自启服务与 LuCI 网页界面；采用 `Architecture: all` 配合安装前 `uname -m` 硬件架构校验，兼容所有 ARM64/RISC-V OpenWrt 子架构（如 `aarch64_cortex-a53`、`aarch64_cortex-a72`、`aarch64_generic`），无需附加 `--force-architecture`。

---

## 🚀 安装与使用

### 1. 安装 IPK
上传 `.ipk` 到路由器 `/tmp` 目录（或直接在 LuCI **「系统 → 软件包 → 上传软件包」** 页面上传安装）：

```bash
opkg update
opkg install /tmp/hclient-cli_*_amd64.ipk
```

### 2. 进入 LuCI 界面
安装完成后刷新浏览器，在 **「网络 (Network) → 懒猫微服 (HClient)」** 或 **「服务 (Services) → 懒猫微服 (HClient)」** 即可进入配置与登录界面。

### 3. 从外部通过懒猫虚拟网访问路由器后台
若路由器分配到的 `heiyu-0` 虚拟 IP 为 `fc03:1136:38c2:8463:5719:5b1:2d55:0`，服务启动时会自动在内核 `heiyu-0` 网卡上绑定 `:1` 地址：
- 访问路由器 LuCI 后台：`http://[fc03:1136:38c2:8463:5719:5b1:2d55:1]/`
- SSH 登录路由器：`ssh root@fc03:1136:38c2:8463:5719:5b1:2d55:1`

### 4. 在线版本检测与自动更新
安装包内置 `hclient-update` 与 `/etc/init.d/hclient-update` 服务，通过 [GitHub Releases](https://github.com/zccrs/openwrt-hclient/releases) 检测并安装新版本：

- **LuCI 页面**：进入「懒猫微服 (HClient) → 六、 版本检测与在线自动更新」，可查看当前/最新版本、手动「检查更新」「立即下载并更新」，或勾选「自动检测并安装新版本」。
- **命令行**：

```bash
# 立即检查 GitHub 最新版本（只检查，不安装）
hclient-update check

# 立即下载、校验 SHA256 并安装最新版本
hclient-update apply

# 查看缓存的版本状态
hclient-update status

# 自动更新配置（默认已开启，每 24 小时检查一次）
uci set hclient.config.update_enabled='1'
uci set hclient.config.update_interval_hours='24'
uci set hclient.config.update_repo='zccrs/openwrt-hclient'
uci commit hclient
/etc/init.d/hclient-update enable
```

更新流程：GitHub API 查询最新 Release → 按本机 `uname -m` 匹配 `amd64/arm64/riscv64` 资产 → 下载 `hclient-cli_<版本>_<架构>.ipk` 与 `SHA256SUMS` → 校验通过后 `opkg install --force-reinstall` → 服务自动重启。更新过程中的日志可通过 `logread -e hclient-update` 查看，最近一次检查结果缓存在 `/etc/hclient/update.state`。

> **注意**：`update_enabled='0'` 会同时关闭定时检查与自动安装（手动检查/更新仍可用）；自动更新需要路由器可直连 `github.com` 且系统时间正确（HTTPS 证书校验）。

---

## 🛠️ 本地构建

```bash
# 自动从懒猫官方拉取最新 amd64 / arm64 / riscv64 二进制并打包所有 IPK 到 ./dist/
./scripts/build-ipk.sh
```
