module("luci.controller.hclient", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/hclient") then
		return
	end

	entry({"admin", "network", "hclient"}, template("hclient/index"), _("懒猫微服 (HClient)"), 85).dependent = true
	entry({"admin", "services", "hclient"}, template("hclient/index"), _("懒猫微服 (HClient)"), 85).dependent = true
	entry({"admin", "network", "hclient", "api"}, call("action_api")).leaf = true
end

local function shell_quote(s)
	s = tostring(s or "")
	return "'" .. s:gsub("'", "'\\''") .. "'"
end

function action_api()
	local http = require "luci.http"
	local sys = require "luci.sys"

	local cmd = http.formvalue("cmd") or "status"
	local a1 = http.formvalue("a1") or ""
	local a2 = http.formvalue("a2") or ""
	local a3 = http.formvalue("a3") or ""
	local a4 = http.formvalue("a4") or ""
	local a5 = http.formvalue("a5") or ""
	local a6 = http.formvalue("a6") or ""
	local a7 = http.formvalue("a7") or ""
	local a8 = http.formvalue("a8") or ""

	local full = string.format("/usr/libexec/hclient-call %s %s %s %s %s %s %s %s %s",
		shell_quote(cmd),
		shell_quote(a1),
		shell_quote(a2),
		shell_quote(a3),
		shell_quote(a4),
		shell_quote(a5),
		shell_quote(a6),
		shell_quote(a7),
		shell_quote(a8)
	)

	local out = sys.exec(full)
	http.prepare_content("application/json")
	http.write(out ~= "" and out or '{"ok":false,"output":"Empty response"}')
end
