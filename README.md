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

---

## 📦 架构与安装包选择

前往 [Releases 页面](../../releases) 下载对应路由器 CPU 架构的 `.ipk` 包：

| 路由器架构 | 推荐安装包（全子架构通用，含客户端+服务+LuCI） | 标准架构包名 |
| :--- | :--- | :--- |
| **amd64 (`x86_64` 软路由)** | `hclient-cli_<版本>_linux_amd64.ipk` | `hclient-cli_<版本>_x86_64.ipk` |
| **arm64 (`aarch64` 路由/盒子)** | `hclient-cli_<版本>_linux_arm64.ipk` | `hclient-cli_<版本>_aarch64_generic.ipk` |
| **riscv64 (`RISC-V` 64位路由)** | `hclient-cli_<版本>_linux_riscv64.ipk` | `hclient-cli_<版本>_riscv64.ipk` |
| **仅 LuCI 界面包（可选）** | `luci-app-hclient_<版本>_all.ipk` | - |

> **说明**：OpenWrt 的 ARM64 设备存在多种子架构名称（如 `aarch64_cortex-a53`、`aarch64_cortex-a72`、`aarch64_generic`）。下载 `*_linux_arm64.ipk` 可直接在所有 `aarch64` 子架构固件上安装，无需附加 `--force-architecture`，安装前会自动通过 `uname -m` 校验 CPU 架构。

---

## 🚀 安装与使用

### 1. 安装 IPK
上传 `.ipk` 到路由器 `/tmp` 目录（或直接在 LuCI **「系统 → 软件包 → 上传软件包」** 页面上传安装）：

```bash
opkg update
opkg install /tmp/hclient-cli_*_linux_amd64.ipk
```

### 2. 进入 LuCI 界面
安装完成后刷新浏览器，在 **「网络 (Network) → 懒猫微服 (HClient)」** 或 **「服务 (Services) → 懒猫微服 (HClient)」** 即可进入配置与登录界面。

### 3. 从外部通过懒猫虚拟网访问路由器后台
若路由器分配到的 `heiyu-0` 虚拟 IP 为 `fc03:1136:38c2:8463:5719:5b1:2d55:0`，服务启动时会自动在内核 `heiyu-0` 网卡上绑定 `:1` 地址：
- 访问路由器 LuCI 后台：`http://[fc03:1136:38c2:8463:5719:5b1:2d55:1]/`
- SSH 登录路由器：`ssh root@fc03:1136:38c2:8463:5719:5b1:2d55:1`

---

## 🛠️ 本地构建

```bash
# 自动从懒猫官方拉取最新 amd64 / arm64 / riscv64 二进制并打包所有 IPK 到 ./dist/
./scripts/build-ipk.sh
```
