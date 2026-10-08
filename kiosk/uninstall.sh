#!/usr/bin/env bash
# Sunroom uninstaller: takes off this Pi what kiosk/install.sh set up for the kitchen screen.
#
#   bash uninstall.sh [--purge] [--yes]
#   (the same as: bash install.sh --uninstall [--purge] [--yes]; the installer keeps a copy
#    of this script at ~/.local/share/sunroom-kiosk/uninstall.sh)
#
# Removes the kitchen screen's systemd user units and nightly restart timer, the launcher,
# its settings, the labwc autostart block or the X11 autostart entry, the labwc pointer and
# touch settings (putting back rc.xml.sunroom-backup when nothing else changed), the Wi-Fi
# power-saving drop-in, the kernel command line options it added, and systemd-time-wait-sync
# if the installer turned it on. It asks before deleting the browser profile, which holds
# the screen's pairing. Docker and Sunroom with its data stay unless you add --purge, which
# runs "docker compose down -v" in /opt/sunroom and deletes that folder. Desktop autologin
# and "no screen blanking" are left as they are.
#
# Like the installer: run it as your normal user (it uses sudo itself), questions are read
# from the keyboard (/dev/tty), --yes answers yes to all of them, and nothing runs until
# the last line. See docs/PLAN.md §13.2.

set -euo pipefail

SCRIPT_PATH="${BASH_SOURCE[0]:-}"
STATE_DIR="$HOME/.local/state/sunroom-kiosk"
LOG_FILE="$STATE_DIR/uninstall.log"
STATE_FILE="$STATE_DIR/install-state"
LABWC_STATE="$STATE_DIR/labwc-rule.json"
CONFIG_DIR="$HOME/.config/sunroom-kiosk"
SHARE_DIR="$HOME/.local/share/sunroom-kiosk"
BIN_DIR="$HOME/.local/bin"
UNIT_DIR="$HOME/.config/systemd/user"
LABWC_DIR="$HOME/.config/labwc"
XDG_AUTOSTART_FILE="$HOME/.config/autostart/sunroom-kiosk.desktop"
SERVER_DIR="/opt/sunroom"
NM_DROPIN="/etc/NetworkManager/conf.d/zz-sunroom-kiosk-wifi.conf"
BLOCK_BEGIN="# >>> sunroom-kiosk"
BLOCK_END="# <<< sunroom-kiosk <<<"
UNITS=(sunroom-kiosk.service sunroom-kiosk-restart.service sunroom-kiosk-restart.timer)

PURGE=0
YES=0
HAVE_TTY=0
TMP_DIR=""
SUDO_READY=0
NEEDS_RESTART=0

say() {
	printf '%s\n' "$*"
}

note() {
	printf '    %s\n' "$*"
}

warn() {
	printf '    Heads up: %s\n' "$*"
}

die() {
	printf '\n' >&2
	printf '%s\n' "$@" >&2
	exit 1
}

tidy() {
	local path=$1
	if [[ $path == "$HOME"/* ]]; then
		path="~${path#"$HOME"}"
	fi
	printf '%s' "$path"
}

usage() {
	cat <<'EOF'
Remove the Sunroom kitchen screen setup from this Pi.

Usage: bash uninstall.sh [--purge] [--yes]

  --purge   Also stop Sunroom and delete it and ALL its data (calendars, lists, photos)
            from this Pi: docker compose down -v in /opt/sunroom, then that folder.
  --yes     Answer yes to every question, including deleting the screen's pairing.
  --help    Show this help

Docker itself, desktop autologin and "no screen blanking" are left as they are.
EOF
}

# ask_yes_no QUESTION DEFAULT(y|n): --yes answers yes; with no keyboard the answer is no.
ask_yes_no() {
	local question=$1 default=$2 hint answer
	if ((YES)); then
		say "$question yes (--yes)"
		return 0
	fi
	if [[ $default == y ]]; then hint="[Y/n]"; else hint="[y/N]"; fi
	if ((!HAVE_TTY)); then
		say "$question $hint (no keyboard to ask; answering no)"
		return 1
	fi
	while true; do
		printf '%s %s ' "$question" "$hint" >/dev/tty
		answer=""
		IFS= read -r answer </dev/tty || true
		printf '%s %s %s\n' "$question" "$hint" "${answer:-<Enter>}" >>"$LOG_FILE"
		case ${answer,,} in
		"")
			[[ $default == y ]]
			return
			;;
		y | yes) return 0 ;;
		n | no) return 1 ;;
		*) printf 'Please answer y or n.\n' >/dev/tty ;;
		esac
	done
}

parse_args() {
	while (($#)); do
		case $1 in
		--purge) PURGE=1 ;;
		--yes | -y) YES=1 ;;
		-h | --help)
			usage
			exit 0
			;;
		*)
			usage >&2
			die "I don't know the option \"$1\"."
			;;
		esac
		shift
	done
}

setup() {
	if [[ $(id -u) -eq 0 ]]; then
		die "Please run this as your normal user, without sudo; it asks for sudo by itself when it needs to." \
			"For example:  bash ~/.local/share/sunroom-kiosk/uninstall.sh"
	fi
	if { : </dev/tty; } 2>/dev/null; then
		HAVE_TTY=1
	fi
	mkdir -p "$STATE_DIR"
	printf '\n----- %s  uninstall.sh  purge=%s yes=%s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$PURGE" "$YES" >>"$LOG_FILE"
	exec > >(tee -a "$LOG_FILE") 2>&1
	TMP_DIR=$(mktemp -d)
	trap 'rm -rf "$TMP_DIR"' EXIT
}

need_sudo() {
	if ((SUDO_READY)); then
		return 0
	fi
	if ! sudo -n true 2>/dev/null; then
		note "This step needs administrator rights, so sudo may ask for your password."
		sudo -v || die "sudo didn't accept the password, so the rest was left in place." \
			"Run this again when sudo works for your account."
	fi
	SUDO_READY=1
}

user_systemctl() {
	XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}" systemctl --user "$@"
}

load_state() {
	if [[ -r $STATE_FILE ]]; then
		# shellcheck source=/dev/null
		. "$STATE_FILE"
	fi
	STATE_LABWC_AUTOSTART_CREATED=${STATE_LABWC_AUTOSTART_CREATED:-0}
	STATE_TIME_WAIT_SYNC_BY_US=${STATE_TIME_WAIT_SYNC_BY_US:-0}
	STATE_NM_DROPIN=${STATE_NM_DROPIN:-}
	STATE_CMDLINE_FILE=${STATE_CMDLINE_FILE:-}
	STATE_CMDLINE_BACKUP=${STATE_CMDLINE_BACKUP:-}
	STATE_CMDLINE_KEYS=${STATE_CMDLINE_KEYS:-}
}

remove_units() {
	local unit removed=0
	user_systemctl disable --now sunroom-kiosk-restart.timer >/dev/null 2>&1 || true
	user_systemctl stop sunroom-kiosk.service >/dev/null 2>&1 || true
	for unit in "${UNITS[@]}"; do
		if [[ -e $UNIT_DIR/$unit ]]; then
			rm -f "$UNIT_DIR/$unit"
			removed=1
		fi
	done
	rm -f "$UNIT_DIR/timers.target.wants/sunroom-kiosk-restart.timer"
	user_systemctl daemon-reload >/dev/null 2>&1 || true
	user_systemctl reset-failed "${UNITS[@]}" >/dev/null 2>&1 || true
	if ((removed)); then
		note "Stopped the kitchen screen and removed its service and nightly restart."
	fi
	if [[ -e $BIN_DIR/sunroom-kiosk ]]; then
		rm -f "$BIN_DIR/sunroom-kiosk"
		note "Removed the launcher ($(tidy "$BIN_DIR/sunroom-kiosk"))."
	fi
}

strip_block() {
	awk -v begin="$BLOCK_BEGIN" -v end="$BLOCK_END" '
		index($0, begin) == 1 && !inblock { inblock = 1; held = $0; next }
		inblock { held = held "\n" $0; if ($0 == end) { inblock = 0; held = "" } next }
		{ print }
		END { if (inblock) print held }
	' "$1"
}

remove_autostart() {
	local file="$LABWC_DIR/autostart"
	if [[ -f $file ]] && grep -q "^$BLOCK_BEGIN" "$file"; then
		strip_block "$file" | awk '{ line[NR] = $0 } END { n = NR; while (n > 0 && line[n] ~ /^[ \t]*$/) n--; for (i = 1; i <= n; i++) print line[i] }' >"$TMP_DIR/autostart"
		if [[ ! -s $TMP_DIR/autostart && $STATE_LABWC_AUTOSTART_CREATED == 1 ]]; then
			rm -f "$file"
			note "Removed $(tidy "$file") (the installer had created it)."
		else
			cat "$TMP_DIR/autostart" >"$file"
			note "Took the kitchen screen out of $(tidy "$file")."
		fi
	fi
	if [[ -e $XDG_AUTOSTART_FILE ]]; then
		rm -f "$XDG_AUTOSTART_FILE"
		note "Removed $(tidy "$XDG_AUTOSTART_FILE")."
	fi
}

find_labwc_rule() {
	local dir candidate
	if [[ -n $SCRIPT_PATH && -f $SCRIPT_PATH ]]; then
		dir=$(cd "$(dirname "$SCRIPT_PATH")" && pwd)
		candidate="$dir/labwc-rule.py"
		if [[ -f $candidate ]]; then
			printf '%s' "$candidate"
			return 0
		fi
	fi
	if [[ -f $SHARE_DIR/labwc-rule.py ]]; then
		printf '%s' "$SHARE_DIR/labwc-rule.py"
		return 0
	fi
	return 1
}

remove_labwc_settings() {
	local rule status=0
	if [[ ! -f $LABWC_STATE ]] && ! grep -qs 'sunroom-kiosk' "$LABWC_DIR/rc.xml"; then
		return 0
	fi
	if ! rule=$(find_labwc_rule) || ! command -v python3 >/dev/null 2>&1; then
		warn "couldn't find labwc-rule.py, so $(tidy "$LABWC_DIR/rc.xml") still has the kitchen screen's" \
			"pointer and touch settings (marked sunroom-kiosk). Your copy from before is $(tidy "$LABWC_DIR/rc.xml.sunroom-backup")."
		return 0
	fi
	python3 "$rule" --remove 2>&1 | sed 's/^/    /' || status=$?
	if ((status != 0)); then
		warn "couldn't fully take the kitchen screen's settings out of $(tidy "$LABWC_DIR/rc.xml")."
	fi
	pkill -HUP -u "$(id -u)" -x labwc 2>/dev/null || true
}

remove_wifi_dropin() {
	local file=${STATE_NM_DROPIN:-$NM_DROPIN}
	if [[ -e $file ]]; then
		need_sudo
		sudo rm -f "$file"
		note "Wi-Fi power saving is back to the Pi's default (after a restart)."
		NEEDS_RESTART=1
	fi
}

undo_time_wait_sync() {
	if [[ $STATE_TIME_WAIT_SYNC_BY_US == 1 ]]; then
		need_sudo
		sudo systemctl disable systemd-time-wait-sync.service >/dev/null 2>&1 || true
		note "Turned off systemd-time-wait-sync again (the installer had turned it on)."
	fi
}

# Put back the kernel command line options the installer replaced or added, one option
# (key) at a time, from the copy it kept before its first change.
restore_cmdline() {
	local file=$STATE_CMDLINE_FILE backup=$STATE_CMDLINE_BACKUP line original="" token key keep new_line
	local -a keys tokens original_tokens new_tokens=()
	[[ -n $file && -n $STATE_CMDLINE_KEYS ]] || return 0
	need_sudo
	if ! sudo test -f "$file"; then
		warn "couldn't find $file to take out the screen options; nothing changed there."
		return 0
	fi
	line=$(sudo cat "$file")
	if [[ -z $line || $line == *$'\n'* ]]; then
		warn "$file isn't a single line any more, so it was left alone." \
			"Remove these options from it by hand if they are still there: $STATE_CMDLINE_KEYS"
		return 0
	fi
	if [[ -n $backup ]] && sudo test -f "$backup"; then
		original=$(sudo cat "$backup")
	fi
	read -ra keys <<<"$STATE_CMDLINE_KEYS"
	read -ra tokens <<<"$line"
	read -ra original_tokens <<<"$original"
	for token in "${tokens[@]}"; do
		keep=1
		for key in "${keys[@]}"; do
			if [[ $token == "$key"* ]]; then
				keep=0
			fi
		done
		if ((keep)); then
			new_tokens+=("$token")
		fi
	done
	for key in "${keys[@]}"; do
		for token in "${original_tokens[@]}"; do
			if [[ $token == "$key"* ]]; then
				new_tokens+=("$token")
			fi
		done
	done
	new_line="${new_tokens[*]}"
	if [[ $new_line != "$line" ]]; then
		printf '%s\n' "$new_line" >"$TMP_DIR/cmdline.txt"
		sudo cp "$TMP_DIR/cmdline.txt" "$file"
		sync
		note "Took the screen options back out of $file."
		NEEDS_RESTART=1
	fi
	if [[ -n $backup ]]; then
		sudo rm -f "$backup"
	fi
}

remove_config() {
	if [[ -d $CONFIG_DIR/profile ]]; then
		say ""
		say "The kitchen screen's browser data holds its pairing with Sunroom."
		if ask_yes_no "Delete it too? The screen would need to be paired again." n; then
			rm -rf "$CONFIG_DIR"
			note "Deleted the kitchen screen's browser data and settings."
			return 0
		fi
		note "Kept the browser data (and the pairing) in $(tidy "$CONFIG_DIR/profile")."
	fi
	if [[ -e $CONFIG_DIR/config ]]; then
		rm -f "$CONFIG_DIR/config"
		note "Removed the kitchen screen's settings."
	fi
	rmdir "$CONFIG_DIR" 2>/dev/null || true
}

purge_server() {
	say ""
	if [[ ! -d $SERVER_DIR ]]; then
		note "Sunroom's server isn't installed in $SERVER_DIR on this Pi; nothing more to delete."
		return 0
	fi
	if ! ask_yes_no "Delete Sunroom and ALL its data (calendars, lists, photos) from this Pi? This can't be undone." n; then
		note "Kept Sunroom and its data."
		PURGE=0
		return 0
	fi
	need_sudo
	if command -v docker >/dev/null 2>&1; then
		if [[ -f $SERVER_DIR/docker-compose.yml ]]; then
			sudo docker compose --project-directory "$SERVER_DIR" -f "$SERVER_DIR/docker-compose.yml" down -v ||
				warn "docker compose down didn't finish; removing the container and data directly."
		fi
		sudo docker rm -f sunroom >/dev/null 2>&1 || true
		sudo docker volume rm sunroom_data >/dev/null 2>&1 || true
	fi
	sudo rm -rf "$SERVER_DIR"
	note "Deleted Sunroom, its data and $SERVER_DIR. Docker itself is still installed."
}

finish() {
	local keep_uninstaller=0
	rm -f "$STATE_FILE" "$LABWC_STATE"
	# While Sunroom's server stays, keep this script so --purge still works later.
	if ((!PURGE)) && [[ -d $SERVER_DIR ]] && [[ -f $SHARE_DIR/uninstall.sh ]]; then
		keep_uninstaller=1
		find "$SHARE_DIR" -mindepth 1 ! -name uninstall.sh -exec rm -rf {} + 2>/dev/null || true
	else
		rm -rf "$SHARE_DIR"
	fi
	say ""
	say "The Sunroom kitchen screen setup is removed."
	say "Left as they are: Docker, the desktop logging in by itself and screen blanking being off"
	say "(change those in Raspberry Pi Configuration if you like)."
	if ((!PURGE)) && [[ -d $SERVER_DIR ]]; then
		say "Sunroom itself still runs on this Pi, with your family's data. To delete it as well:"
		if ((keep_uninstaller)); then
			say "  bash ~/.local/share/sunroom-kiosk/uninstall.sh --purge"
		else
			say "  bash kiosk/install.sh --uninstall --purge"
		fi
	fi
	if ((NEEDS_RESTART)); then
		say "Restart the Pi to finish (sudo reboot)."
	fi
	say "Log: $(tidy "$LOG_FILE")"
}

main() {
	parse_args "$@"
	setup
	load_state
	say "Removing the Sunroom kitchen screen setup..."
	remove_units
	remove_autostart
	remove_labwc_settings
	remove_wifi_dropin
	undo_time_wait_sync
	restore_cmdline
	remove_config
	if ((PURGE)); then
		purge_server
	fi
	finish
}

main "$@"
