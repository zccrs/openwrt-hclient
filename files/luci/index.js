'use strict';
'require view';
'require fs';
'require ui';
'require poll';

function callBackend(args) {
	return fs.exec('/usr/libexec/hclient-call', args).then(function(res) {
		if (!res || !res.stdout) {
			return { ok: false, output: (res && res.stderr) ? res.stderr : 'Empty response' };
		}
		try {
			return JSON.parse(res.stdout);
		} catch (e) {
			return { ok: false, output: res.stdout };
		}
	}).catch(function(err) {
		return { ok: false, output: String(err) };
	});
}

return view.extend({
	load: function() {
		return callBackend(['status']);
	},

	updateStatusDOM: function(st) {
		if (!st) return;

		var runBadge = document.getElementById('hc-run-badge');
		if (runBadge) {
			if (st.running) {
				runBadge.textContent = '运行中' + (st.pid ? ' (PID: ' + st.pid + ')' : '');
				runBadge.style.background = '#16a34a';
			} else {
				runBadge.textContent = '已停止';
				runBadge.style.background = '#dc2626';
			}
		}

		var bootBadge = document.getElementById('hc-boot-badge');
		if (bootBadge) {
			if (st.boot_enabled) {
				bootBadge.textContent = '开机自启：已开启';
				bootBadge.style.background = '#2563eb';
			} else {
				bootBadge.textContent = '开机自启：已关闭';
				bootBadge.style.background = '#6b7280';
			}
		}

		var tunEl = document.getElementById('hc-tun-info');
		if (tunEl) {
			tunEl.textContent = st.tun_ifname ? (st.tun_ifname + ' (' + (st.virtual_ip || '无IPv6') + ')') : '未建立 (' + (st.tun || 'enabled') + ')';
		}

		var proxyEl = document.getElementById('hc-proxy-info');
		if (proxyEl) {
			proxyEl.textContent = (st.proxy === 'enabled') ? (st.proxy_listen_addr || '0.0.0.0:61090') : '已禁用';
		}

		var verEl = document.getElementById('hc-ver-info');
		if (verEl) {
			verEl.textContent = st.version || 'v1.5.1';
		}

		this.renderBoxTable(st.boxes || []);
	},

	renderBoxTable: function(boxes) {
		var tbody = document.getElementById('hc-box-tbody');
		if (!tbody) return;
		tbody.innerHTML = '';

		if (!boxes || boxes.length === 0) {
			tbody.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td', 'colspan': '6', 'style': 'text-align:center;color:#888;padding:14px;' },
					'暂无已登录的懒猫微服设备（如果后台服务刚启动，请稍候刷新，或在下方登录绑定设备）')
			]));
			return;
		}

		var self = this;
		boxes.forEach(function(b) {
			var statusColor = (b.status === 'Ready') ? '#16a34a' : '#d97706';
			var tr = E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td', 'style': 'font-weight:bold;' }, b.name || '-'),
				E('td', { 'class': 'td', 'style': 'font-family:monospace;font-size:12px;' }, b.id || '-'),
				E('td', { 'class': 'td' }, [
					E('span', {
						'style': 'display:inline-block;padding:2px 8px;border-radius:4px;color:#fff;font-size:12px;background:' + statusColor
					}, b.status || 'Unknown')
				]),
				E('td', { 'class': 'td' }, b.user || '-'),
				E('td', { 'class': 'td' }, b.is_default ? '★ 默认' : '否'),
				E('td', { 'class': 'td' }, [
					E('button', {
						'class': 'btn cbi-button cbi-button-apply',
						'style': 'margin-right:4px;',
						'click': function() { self.handleBoxAction('set-default', b.id); }
					}, '设为默认'),
					E('button', {
						'class': 'btn cbi-button cbi-button-action',
						'style': 'margin-right:4px;',
						'click': function() { self.handleBoxAction('enable', b.id); }
					}, '启用'),
					E('button', {
						'class': 'btn cbi-button cbi-button-neutral',
						'style': 'margin-right:4px;',
						'click': function() { self.handleBoxAction('disable', b.id); }
					}, '禁用'),
					E('button', {
						'class': 'btn cbi-button cbi-button-remove',
						'click': function() {
							if (confirm('确定要删除并解绑微服 ' + (b.name || b.id) + ' 吗？')) {
								self.handleBoxAction('delete', b.id);
							}
						}
					}, '删除')
				])
			]);
			tbody.appendChild(tr);
			if (b.reason) {
				tbody.appendChild(E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td', 'colspan': '6', 'style': 'font-size:12px;color:#666;padding:4px 12px 10px 12px;' },
						'连接信息：' + b.reason)
				]));
			}
		});
	},

	handleServiceAction: function(act) {
		var self = this;
		ui.showModal('正在执行服务操作...', [
			E('p', { 'class': 'spinning' }, '正在执行：' + act + '，请稍候...')
		]);
		return callBackend(['service_action', act]).then(function() {
			return new Promise(function(resolve) { setTimeout(resolve, 1200); });
		}).then(function() {
			return callBackend(['status']);
		}).then(function(st) {
			ui.hideModal();
			self.updateStatusDOM(st);
		});
	},

	handleSaveConfig: function() {
		var self = this;
		var enabled = document.getElementById('hc-cfg-enabled').checked ? '1' : '0';
		var bootEn = document.getElementById('hc-cfg-boot').checked ? '1' : '0';
		var tun = document.getElementById('hc-cfg-tun').value;
		var proxy = document.getElementById('hc-cfg-proxy').value;
		var proxyAddr = document.getElementById('hc-cfg-proxy-addr').value.trim() || '0.0.0.0:61090';
		var ctrlAddr = document.getElementById('hc-cfg-ctrl-addr').value.trim() || 'tcp://127.0.0.1:61091';
		var lanAcc = document.getElementById('hc-cfg-lan').checked ? '1' : '0';
		var dnsFwd = document.getElementById('hc-cfg-dns').checked ? '1' : '0';

		ui.showModal('保存并应用网络服务配置', [
			E('p', { 'class': 'spinning' }, '正在保存 UCI 配置、更新开机自启与防火墙/DNS转发并重启服务...')
		]);

		return callBackend(['save_config', enabled, bootEn, tun, proxy, proxyAddr, ctrlAddr, lanAcc, dnsFwd]).then(function(res) {
			return new Promise(function(resolve) { setTimeout(resolve, 1500); });
		}).then(function() {
			return callBackend(['status']);
		}).then(function(st) {
			ui.hideModal();
			self.updateStatusDOM(st);
			ui.addNotification(null, E('p', '配置已保存并生效！'), 'info');
		});
	},

	handleBoxAction: function(action, boxId) {
		var self = this;
		ui.showModal('操作微服设备', [
			E('p', { 'class': 'spinning' }, '正在执行 ' + action + ' (' + boxId + ')...')
		]);
		return callBackend(['box_action', action, boxId]).then(function(res) {
			return callBackend(['status']).then(function(st) {
				ui.hideModal();
				self.updateStatusDOM(st);
				if (res && res.output) {
					self.setConsoleOutput(res.output);
				}
			});
		});
	},

	handleManualLogin: function() {
		var self = this;
		var boxName = document.getElementById('hc-login-box').value.trim();
		var user = document.getElementById('hc-login-user').value.trim();
		var pass = document.getElementById('hc-login-pass').value;

		if (!boxName || !user || !pass) {
			alert('请完整填写微服名称、用户名和密码！');
			return;
		}

		ui.showModal('正在登录懒猫微服...', [
			E('p', { 'class': 'spinning' }, '正在向微服 (' + boxName + ') 发起认证，可能需要 5~20 秒...')
		]);

		return callBackend(['login_manual', boxName, user, pass]).then(function(res) {
			return callBackend(['status']).then(function(st) {
				ui.hideModal();
				self.updateStatusDOM(st);
				self.setConsoleOutput((res && res.output) ? res.output : JSON.stringify(res));
			});
		});
	},

	handleQrLogin: function() {
		var self = this;
		var qrBox = document.getElementById('hc-qr-display');
		if (qrBox) {
			qrBox.style.display = 'block';
			qrBox.textContent = '正在生成登录二维码，请稍候...';
		}
		return callBackend(['login_qr']).then(function(res) {
			if (!qrBox) return;
			if (res && (res.qr || res.url)) {
				qrBox.textContent = (res.qr ? res.qr + '\n\n' : '') + '登录链接 (可在懒猫App打开):\n' + (res.url || '');
			} else {
				qrBox.textContent = '获取二维码失败，请先确保后台服务正在运行。\n' + ((res && res.output) || '');
			}
		});
	},

	handleTfaLogin: function() {
		var self = this;
		var boxId = document.getElementById('hc-tfa-boxid').value.trim();
		var code = document.getElementById('hc-tfa-code').value.trim();
		if (!boxId || !code) {
			alert('请填写 Box ID 和 2FA 验证码！');
			return;
		}
		ui.showModal('提交双因素验证...', [
			E('p', { 'class': 'spinning' }, '正在验证 TFA 代码...')
		]);
		return callBackend(['login_tfa', boxId, code]).then(function(res) {
			return callBackend(['status']).then(function(st) {
				ui.hideModal();
				self.updateStatusDOM(st);
				self.setConsoleOutput((res && res.output) ? res.output : JSON.stringify(res));
			});
		});
	},

	handleDiag: function(cmd, title) {
		var self = this;
		self.setConsoleOutput('正在执行 ' + title + '，请稍候...');
		return callBackend([cmd]).then(function(res) {
			if (cmd === 'logs' && res) {
				var text = '=== 系统日志 (logread) ===\n' + (res.syslog || '(无)') +
					'\n\n=== 客户端运行日志 (hclient.json) ===\n' + (res.applog || '(无)');
				self.setConsoleOutput(text);
			} else {
				self.setConsoleOutput((res && res.output) ? res.output : JSON.stringify(res, null, 2));
			}
		});
	},

	setConsoleOutput: function(text) {
		var pre = document.getElementById('hc-console-out');
		if (pre) {
			pre.textContent = text || '';
		}
	},

	render: function(st) {
		st = st || {};
		var self = this;

		poll.add(function() {
			return callBackend(['status']).then(function(newSt) {
				self.updateStatusDOM(newSt);
			});
		}, 8);

		var runText = st.running ? ('运行中' + (st.pid ? ' (PID: ' + st.pid + ')' : '')) : '已停止';
		var runBg = st.running ? '#16a34a' : '#dc2626';
		var bootText = st.boot_enabled ? '开机自启：已开启' : '开机自启：已关闭';
		var bootBg = st.boot_enabled ? '#2563eb' : '#6b7280';

		var root = E('div', { 'class': 'cbi-map' }, [
			E('h2', { 'name': 'content' }, '懒猫微服网络服务 (Lazycat HClient)'),
			E('div', { 'class': 'cbi-map-descr' },
				'将懒猫微服客户端作为 OpenWrt 路由级网络服务运行，支持开机自启动、TUN 虚拟专网直连、局域网共享转发、Dnsmasq 域名自动解析与 HTTP/SOCKS5 代理。'),

			/* 1. Status Section */
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, '一、 服务运行状态与快捷控制'),
				E('div', { 'class': 'cbi-section-node', 'style': 'padding:12px;' }, [
					E('div', { 'style': 'display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:14px;' }, [
						E('span', {
							'id': 'hc-run-badge',
							'style': 'padding:5px 12px;border-radius:4px;color:#fff;font-weight:bold;background:' + runBg
						}, runText),
						E('span', {
							'id': 'hc-boot-badge',
							'style': 'padding:5px 12px;border-radius:4px;color:#fff;font-weight:bold;background:' + bootBg
						}, bootText),
						E('span', { 'style': 'margin-left:8px;' }, [
							E('strong', {}, 'TUN 虚拟网卡：'),
							E('span', { 'id': 'hc-tun-info', 'style': 'font-family:monospace;' },
								st.tun_ifname ? (st.tun_ifname + ' (' + (st.virtual_ip || '无IPv6') + ')') : '未建立')
						]),
						E('span', { 'style': 'margin-left:8px;' }, [
							E('strong', {}, '混合代理监听：'),
							E('span', { 'id': 'hc-proxy-info', 'style': 'font-family:monospace;' },
								(st.proxy === 'enabled') ? (st.proxy_listen_addr || '0.0.0.0:61090') : '已禁用')
						]),
						E('span', { 'style': 'margin-left:8px;' }, [
							E('strong', {}, '版本：'),
							E('span', { 'id': 'hc-ver-info' }, st.version || 'v1.5.1')
						])
					]),
					E('div', { 'style': 'display:flex;flex-wrap:wrap;gap:8px;' }, [
						E('button', {
							'class': 'btn cbi-button cbi-button-apply',
							'click': function() { self.handleServiceAction('start'); }
						}, '启动服务'),
						E('button', {
							'class': 'btn cbi-button cbi-button-reset',
							'click': function() { self.handleServiceAction('stop'); }
						}, '停止服务'),
						E('button', {
							'class': 'btn cbi-button cbi-button-action',
							'click': function() { self.handleServiceAction('restart'); }
						}, '重启服务'),
						E('button', {
							'class': 'btn cbi-button cbi-button-neutral',
							'click': function() {
								callBackend(['status']).then(function(s) { self.updateStatusDOM(s); });
							}
						}, '刷新状态')
					])
				])
			]),

			/* 2. Configuration Section */
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, '二、 网络服务与开机自启动设置'),
				E('div', { 'class': 'cbi-section-node' }, [
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, '启用后台服务'),
						E('div', { 'class': 'cbi-value-field' }, [
							E('input', {
								'id': 'hc-cfg-enabled',
								'type': 'checkbox',
								'checked': (st.uci_enabled !== '0') ? 'checked' : null
							}),
							E('div', { 'class': 'cbi-value-description' }, '启用 hclient-cli 后台守护进程')
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, '开机自动启动'),
						E('div', { 'class': 'cbi-value-field' }, [
							E('input', {
								'id': 'hc-cfg-boot',
								'type': 'checkbox',
								'checked': (st.boot_enabled !== false) ? 'checked' : null
							}),
							E('div', { 'class': 'cbi-value-description' }, '路由器重启后由 OpenWrt Procd 自动拉起服务（/etc/init.d/hclient enable）')
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, 'TUN 虚拟网卡模式'),
						E('div', { 'class': 'cbi-value-field' }, [
							E('select', { 'id': 'hc-cfg-tun', 'class': 'cbi-input-select' }, [
								E('option', { 'value': 'enabled', 'selected': (st.tun !== 'disabled') ? 'selected' : null }, '启用 (推荐，创建 heiyu-0 虚拟网卡)'),
								E('option', { 'value': 'disabled', 'selected': (st.tun === 'disabled') ? 'selected' : null }, '禁用 (仅使用本地代理)')
							])
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, '允许局域网设备转发访问'),
						E('div', { 'class': 'cbi-value-field' }, [
							E('input', {
								'id': 'hc-cfg-lan',
								'type': 'checkbox',
								'checked': (st.lan_access !== '0') ? 'checked' : null
							}),
							E('div', { 'class': 'cbi-value-description' }, '自动配置 OpenWrt 防火墙转发规则与 NAT66，使局域网内设备可直接通过路由器访问微服')
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, '自动配置 Dnsmasq 域名解析'),
						E('div', { 'class': 'cbi-value-field' }, [
							E('input', {
								'id': 'hc-cfg-dns',
								'type': 'checkbox',
								'checked': (st.dns_forward !== '0') ? 'checked' : null
							}),
							E('div', { 'class': 'cbi-value-description' }, '将 *.heiyu.space 自动转发至微服虚拟 DNS (fc03:1136:3800::1) 并加入防重绑定白名单')
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, 'HTTP/SOCKS5 混合代理'),
						E('div', { 'class': 'cbi-value-field' }, [
							E('select', { 'id': 'hc-cfg-proxy', 'class': 'cbi-input-select' }, [
								E('option', { 'value': 'enabled', 'selected': (st.proxy !== 'disabled') ? 'selected' : null }, '启用'),
								E('option', { 'value': 'disabled', 'selected': (st.proxy === 'disabled') ? 'selected' : null }, '禁用')
							])
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, '代理监听地址'),
						E('div', { 'class': 'cbi-value-field' }, [
							E('input', {
								'id': 'hc-cfg-proxy-addr',
								'type': 'text',
								'class': 'cbi-input-text',
								'value': st.proxy_listen_addr || '0.0.0.0:61090'
							}),
							E('div', { 'class': 'cbi-value-description' }, '0.0.0.0:61090 允许局域网设备使用该代理，127.0.0.1:61090 仅允许路由器本机使用')
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, '守护进程控制地址'),
						E('div', { 'class': 'cbi-value-field' }, [
							E('input', {
								'id': 'hc-cfg-ctrl-addr',
								'type': 'text',
								'class': 'cbi-input-text',
								'value': st.address || 'tcp://127.0.0.1:61091'
							})
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, ''),
						E('div', { 'class': 'cbi-value-field' }, [
							E('button', {
								'class': 'btn cbi-button cbi-button-save',
								'click': function() { self.handleSaveConfig(); }
							}, '保存并应用配置')
						])
					])
				])
			]),

			/* 3. Box List Section */
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, '三、 已绑定的懒猫微服设备'),
				E('div', { 'class': 'cbi-section-node' }, [
					E('table', { 'class': 'table cbi-section-table' }, [
						E('thead', {}, [
							E('tr', { 'class': 'tr table-titles' }, [
								E('th', { 'class': 'th' }, '微服名称'),
								E('th', { 'class': 'th' }, 'Box ID'),
								E('th', { 'class': 'th' }, '连接状态'),
								E('th', { 'class': 'th' }, '登录账号'),
								E('th', { 'class': 'th' }, '默认设备'),
								E('th', { 'class': 'th' }, '操作')
							])
						]),
						E('tbody', { 'id': 'hc-box-tbody' })
					])
				])
			]),

			/* 4. Login Section */
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, '四、 登录 / 添加懒猫微服'),
				E('div', { 'class': 'cbi-section-node' }, [
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, '微服名称 (Box Name)'),
						E('div', { 'class': 'cbi-value-field' }, [
							E('input', { 'id': 'hc-login-box', 'type': 'text', 'class': 'cbi-input-text', 'placeholder': '例如：mybox（不含 .heiyu.space）' })
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, '用户名 (User)'),
						E('div', { 'class': 'cbi-value-field' }, [
							E('input', { 'id': 'hc-login-user', 'type': 'text', 'class': 'cbi-input-text', 'placeholder': '输入微服用户名' })
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, '密码 (Password)'),
						E('div', { 'class': 'cbi-value-field' }, [
							E('input', { 'id': 'hc-login-pass', 'type': 'password', 'class': 'cbi-input-password', 'placeholder': '输入微服密码' })
						])
					]),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, ''),
						E('div', { 'class': 'cbi-value-field' }, [
							E('button', {
								'class': 'btn cbi-button cbi-button-apply',
								'style': 'margin-right:8px;',
								'click': function() { self.handleManualLogin(); }
							}, '账号密码登录'),
							E('button', {
								'class': 'btn cbi-button cbi-button-action',
								'click': function() { self.handleQrLogin(); }
							}, '生成扫码登录二维码')
						])
					]),
					E('pre', {
						'id': 'hc-qr-display',
						'style': 'display:none;background:#111;color:#fff;padding:14px;border-radius:6px;font-family:monospace;line-height:1.05;font-size:12px;overflow-x:auto;margin:10px 20px;'
					}),
					E('hr', { 'style': 'margin:14px 0;' }),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, '双因素验证 (2FA / TFA)'),
						E('div', { 'class': 'cbi-value-field', 'style': 'display:flex;gap:8px;flex-wrap:wrap;' }, [
							E('input', { 'id': 'hc-tfa-boxid', 'type': 'text', 'class': 'cbi-input-text', 'style': 'width:260px;', 'placeholder': 'Box ID' }),
							E('input', { 'id': 'hc-tfa-code', 'type': 'text', 'class': 'cbi-input-text', 'style': 'width:140px;', 'placeholder': '6位动态验证码' }),
							E('button', {
								'class': 'btn cbi-button cbi-button-action',
								'click': function() { self.handleTfaLogin(); }
							}, '提交 2FA 验证')
						])
					])
				])
			]),

			/* 5. Diagnostics & Logs */
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, '五、 网络诊断与运行日志'),
				E('div', { 'class': 'cbi-section-node', 'style': 'padding:12px;' }, [
					E('div', { 'style': 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;' }, [
						E('button', {
							'class': 'btn cbi-button cbi-button-action',
							'click': function() { self.handleDiag('check', 'TUN与运行环境检查'); }
						}, '运行环境检查 (check)'),
						E('button', {
							'class': 'btn cbi-button cbi-button-action',
							'click': function() { self.handleDiag('netdiag', '网络穿透诊断'); }
						}, '网络穿透诊断 (network-diagnostic)'),
						E('button', {
							'class': 'btn cbi-button cbi-button-neutral',
							'click': function() { self.handleDiag('logs', '查看运行日志'); }
						}, '查看运行日志 (logs)')
					]),
					E('pre', {
						'id': 'hc-console-out',
						'style': 'background:#1e293b;color:#e2e8f0;padding:12px;border-radius:6px;font-family:monospace;font-size:12px;min-height:100px;max-height:420px;overflow:auto;white-space:pre-wrap;'
					}, '点击上方按钮可执行环境检测、打洞诊断或读取实时运行日志。')
				])
			])
		]);

		setTimeout(function() {
			self.renderBoxTable(st.boxes || []);
		}, 0);

		return root;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
