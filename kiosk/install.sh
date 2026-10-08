#!/usr/bin/env bash
# Sunroom installer for Raspberry Pi OS (64-bit, Bookworm or Trixie). See docs/PLAN.md §13.
#
# Three ways to use it:
#   a. Sunroom and the kitchen screen, both on this Pi          (no option)
#   b. only the kitchen screen; Sunroom runs on another computer --display-only --url URL
#   c. only Sunroom, no screen (Raspberry Pi OS Lite)            --server-only
#
#   curl -fsSL https://raw.githubusercontent.com/ScopeXL/assistant-calendar/main/kiosk/install.sh | bash
#   bash kiosk/install.sh --display-only --url https://calendar.example.com
#
# Run it as your normal user, not root; it uses sudo where it must. Running it again is
# safe: packages and Docker are installed only when missing, the files it owns are
# rewritten with the same content, and its edits to shared files sit between marker lines
# or are recorded (~/.local/state/sunroom-kiosk/install-state) so kiosk/uninstall.sh can
# take them back. Everything it prints is also logged to
# ~/.local/state/sunroom-kiosk/install.log.
#
# The rest of the kiosk/ folder (launcher, screen helper, systemd units, labwc-rule.py,
# update.sh, uninstall.sh) is taken from next to this script when present, otherwise
# downloaded from GitHub for the requested version.
#
# Nothing runs until `main "$@"` on the very last line, so a download that stops halfway
# never runs half a script.

set -euo pipefail
set -o errtrace

KIOSK_VERSION="0.5.0" # Sunroom's VERSION (`just bump` sets it), written into every file it creates
SUNROOM_REPO="ScopeXL/assistant-calendar"
SUNROOM_IMAGE="scopexl/sunroom"

SCRIPT_PATH="${BASH_SOURCE[0]:-}" # empty when the script is piped into bash

STATE_DIR="$HOME/.local/state/sunroom-kiosk"
LOG_FILE="$STATE_DIR/install.log"
STATE_FILE="$STATE_DIR/install-state"
CONFIG_DIR="$HOME/.config/sunroom-kiosk"
SHARE_DIR="$HOME/.local/share/sunroom-kiosk"
BIN_DIR="$HOME/.local/bin"
UNIT_DIR="$HOME/.config/systemd/user"
LABWC_DIR="$HOME/.config/labwc"
XDG_AUTOSTART_FILE="$HOME/.config/autostart/sunroom-kiosk.desktop"
SERVER_DIR="/opt/sunroom"
# NetworkManager merges conf.d files in byte order and the last one wins, hence "zz-".
NM_DROPIN="/etc/NetworkManager/conf.d/zz-sunroom-kiosk-wifi.conf"
# The screen helper's brightness: the backlight's bl_power for the video group (Raspberry Pi
# OS's own 60-backlight.rules covers brightness only), and i2c-dev at every start for DDC/CI.
BACKLIGHT_RULE="/etc/udev/rules.d/90-sunroom-kiosk-backlight.rules"
I2C_MODULES_FILE="/etc/modules-load.d/sunroom-kiosk-i2c.conf"
BLOCK_BEGIN="# >>> sunroom-kiosk"
BLOCK_END="# <<< sunroom-kiosk <<<"
HEALTH_TIMEOUT=300

# Options
MODE="all" # all | display | server
WANT_DISPLAY_ONLY=0
WANT_SERVER_ONLY=0
URL=""
VERSION=""
PORT=8080
PORT_GIVEN=0
OUTPUT=""
OUTPUT_GIVEN=0
ROTATE=0
BRIGHTNESS="auto"
FORCE_HDMI=""
SCREEN_HELPER="yes"
SCREEN_OPTIONS_GIVEN=0
NO_REBOOT=0
FORCE_X11=0
UNINSTALL=0
UNINSTALL_ARGS=()
ORIGINAL_ARGS=()

# Worked out while running
SRC_DIR=""
TMP_DIR=""
CODENAME=""
SESSION="" # wayland | x11
SWITCH_TO_X11=0
DDC_BUS=""   # the monitor's I2C bus for DDC/CI brightness, when one answers
BACKLIGHT="" # the panel's backlight under /sys/class/backlight, when it has one
IMAGE_TAG=""
HAVE_TTY=0
LOGGING=0
STEP="getting started"
SUDO_KEEPALIVE_PID=""
TEE_PID=""

# Remembered between runs for kiosk/uninstall.sh (see save_state)
LABWC_AUTOSTART_CREATED=0
TIME_WAIT_SYNC_BY_US=0
NM_DROPIN_WRITTEN=""
CMDLINE_FILE=""
CMDLINE_BACKUP=""
CMDLINE_KEYS=""
BACKLIGHT_RULE_WRITTEN=""
I2C_MODULES_WRITTEN=""

# ---------------------------------------------------------------------------- messages

say() {
	printf '%s\n' "$*"
}

note() {
	printf '    %s\n' "$*"
}

warn() {
	printf '    Heads up: %s\n' "$*"
}

step() {
	STEP=$2
	printf '\n==> %s\n' "$1"
}

tidy() {
	local path=$1
	if [[ $path == "$HOME"/* ]]; then
		path="~${path#"$HOME"}"
	fi
	printf '%s' "$path"
}

die() {
	printf '\n' >&2
	printf '%s\n' "$@" >&2
	if ((LOGGING)); then
		printf '\nThe full log is in %s\n' "$(tidy "$LOG_FILE")" >&2
	fi
	exit 1
}

usage_error() {
	printf '%s\n' "$@" >&2
	printf 'Run it with --help to see every option.\n' >&2
	exit 2
}

on_error() {
	local status=$1 line=$2
	if ((BASH_SUBSHELL > 0)); then
		return 0
	fi
	printf '\nSomething went wrong while %s (line %s, exit code %s).\n' "$STEP" "$line" "$status" >&2
	printf 'Running the installer again is safe; it picks up where it stopped.\n' >&2
	if ((LOGGING)); then
		printf 'The full log is in %s\n' "$(tidy "$LOG_FILE")" >&2
	fi
}

log_only() {
	if ((LOGGING)); then
		printf '%s\n' "$*" >>"$LOG_FILE"
	fi
}

# Run a command with its chatter going to the log only; on failure, show its last lines.
quietly() {
	local out="$TMP_DIR/quietly.out" status=0
	"$@" >"$out" 2>&1 || status=$?
	cat "$out" >>"$LOG_FILE"
	if ((status != 0)); then
		tail -n 15 "$out"
	fi
	return "$status"
}

# ask_yes_no QUESTION DEFAULT(y|n) ANSWER-WITHOUT-KEYBOARD(y|n)
ask_yes_no() {
	local question=$1 default=$2 fallback=$3 hint answer word="no"
	if [[ $default == y ]]; then hint="[Y/n]"; else hint="[y/N]"; fi
	if ((!HAVE_TTY)); then
		if [[ $fallback == y ]]; then word="yes"; fi
		say "$question $hint (no keyboard to ask, so: $word)"
		[[ $fallback == y ]]
		return
	fi
	while true; do
		printf '%s %s ' "$question" "$hint" >/dev/tty
		answer=""
		IFS= read -r answer </dev/tty || true
		log_only "$question $hint ${answer:-<Enter>}"
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

usage() {
	cat <<EOF
Sunroom installer $KIOSK_VERSION for Raspberry Pi OS (64-bit, Bookworm or Trixie)

Usage: bash install.sh [options]

What to set up (the default is everything on this Pi):
  (no option)               Sunroom and the kitchen screen, both on this Pi
  --display-only --url URL  Only the kitchen screen; Sunroom runs on another computer.
                            URL is that computer's address, for example
                            http://192.168.1.20:8080 or https://calendar.example.com
  --server-only             Only Sunroom, no screen (Raspberry Pi OS Lite)

Options:
  --version X.Y.Z           Install this Sunroom version instead of the newest
  --port N                  The port phones use to reach Sunroom on this Pi (default 8080)
  --output NAME             The screen's connector, for example HDMI-A-1
                            (default: the one with a screen plugged in)
  --rotate 0|90|180|270     Turn the picture for a screen mounted on its side
                            (90 = left, 180 = upside down, 270 = right)
  --force-hdmi WIDTHxHEIGHT Always drive the screen at this size, even when it is off
                            at startup, for example 1920x1080
  --brightness auto|ddc|sysfs|none
                            How the screen helper dims the screen in the evening:
                            ddc for a monitor that takes brightness over HDMI (DDC/CI),
                            sysfs for a panel with a backlight (Raspberry Pi Touch Display),
                            none to leave it to the page; auto (the default) picks
  --no-screen-helper        Never switch the screen itself off or change its brightness;
                            the page goes black or dim instead (for monitors whose touch
                            stops working while the screen is off)
  --x11                     Use the older X11 desktop instead of labwc (Wayland)
  --no-reboot               Don't offer to restart at the end
  --uninstall [--purge] [--yes]
                            Remove the kitchen screen setup; --purge also deletes Sunroom
                            and all its data from this Pi, --yes answers every question
  --help                    Show this help

Examples:
  curl -fsSL https://raw.githubusercontent.com/$SUNROOM_REPO/main/kiosk/install.sh | bash
  curl -fsSL https://raw.githubusercontent.com/$SUNROOM_REPO/main/kiosk/install.sh | bash -s -- --display-only --url http://192.168.1.20:8080
  bash kiosk/install.sh --display-only --url https://calendar.example.com --rotate 90
EOF
}

# ---------------------------------------------------------------------------- options

need_value() {
	if [[ $# -lt 2 || -z $2 || $2 == --* ]]; then
		usage_error "$1 needs a value after it, for example: $1 $(example_for "$1")"
	fi
}

example_for() {
	case $1 in
	--url) printf 'http://192.168.1.20:8080' ;;
	--version) printf '0.1.0' ;;
	--port) printf '8081' ;;
	--output) printf 'HDMI-A-1' ;;
	--rotate) printf '90' ;;
	--brightness) printf 'auto' ;;
	--force-hdmi) printf '1920x1080' ;;
	*) printf 'VALUE' ;;
	esac
}

parse_args() {
	while (($#)); do
		case $1 in
		--display-only) WANT_DISPLAY_ONLY=1 ;;
		--server-only) WANT_SERVER_ONLY=1 ;;
		--url)
			need_value "$@"
			URL=$2
			shift
			;;
		--url=*) URL=${1#*=} ;;
		--version)
			need_value "$@"
			VERSION=$2
			shift
			;;
		--version=*) VERSION=${1#*=} ;;
		--port)
			need_value "$@"
			PORT=$2
			PORT_GIVEN=1
			shift
			;;
		--port=*)
			PORT=${1#*=}
			PORT_GIVEN=1
			;;
		--output)
			need_value "$@"
			OUTPUT=$2
			OUTPUT_GIVEN=1
			SCREEN_OPTIONS_GIVEN=1
			shift
			;;
		--output=*)
			OUTPUT=${1#*=}
			OUTPUT_GIVEN=1
			SCREEN_OPTIONS_GIVEN=1
			;;
		--rotate)
			need_value "$@"
			ROTATE=$2
			SCREEN_OPTIONS_GIVEN=1
			shift
			;;
		--rotate=*)
			ROTATE=${1#*=}
			SCREEN_OPTIONS_GIVEN=1
			;;
		--brightness)
			need_value "$@"
			BRIGHTNESS=$2
			SCREEN_OPTIONS_GIVEN=1
			shift
			;;
		--brightness=*)
			BRIGHTNESS=${1#*=}
			SCREEN_OPTIONS_GIVEN=1
			;;
		--force-hdmi)
			need_value "$@"
			FORCE_HDMI=$2
			SCREEN_OPTIONS_GIVEN=1
			shift
			;;
		--force-hdmi=*)
			FORCE_HDMI=${1#*=}
			SCREEN_OPTIONS_GIVEN=1
			;;
		--no-screen-helper)
			SCREEN_HELPER="no"
			SCREEN_OPTIONS_GIVEN=1
			;;
		--no-reboot) NO_REBOOT=1 ;;
		--x11)
			FORCE_X11=1
			SCREEN_OPTIONS_GIVEN=1
			;;
		--uninstall)
			UNINSTALL=1
			shift
			UNINSTALL_ARGS+=("$@")
			return 0
			;;
		--purge | --yes) UNINSTALL_ARGS+=("$1") ;;
		-h | --help)
			usage
			exit 0
			;;
		*) usage_error "I don't know the option \"$1\"." ;;
		esac
		shift
	done
}

validate_args() {
	local lower
	if ((${#UNINSTALL_ARGS[@]})); then
		usage_error "--purge and --yes only go with --uninstall, for example: bash install.sh --uninstall --purge"
	fi
	if ((WANT_DISPLAY_ONLY && WANT_SERVER_ONLY)); then
		usage_error "--display-only and --server-only can't be used together." \
			"Leave both out to put Sunroom and the kitchen screen on this Pi."
	fi
	if ((WANT_SERVER_ONLY)) && [[ -n $URL ]]; then
		usage_error "--url goes with --display-only (the screen shows Sunroom from another computer)."
	fi
	if ((WANT_DISPLAY_ONLY)) && [[ -z $URL ]]; then
		usage_error "--display-only needs the address of the computer that runs Sunroom," \
			"for example: --display-only --url http://192.168.1.20:8080"
	fi
	if [[ -n $URL ]]; then
		MODE="display"
		if ((!WANT_DISPLAY_ONLY)); then
			say "Note: --url given, so this Pi will only be the kitchen screen (as with --display-only)."
		fi
		URL="${URL%/}"
		URL="${URL%/display}"
		lower=${URL,,}
		if [[ ! $lower =~ ^https?://[a-z0-9.-]+(:[0-9]{1,5})?$ ]]; then
			usage_error "\"$URL\" doesn't look like the address of Sunroom." \
				"Use the address you open on a phone, for example http://192.168.1.20:8080 or https://calendar.example.com"
		fi
		URL=$lower
	fi
	if ((WANT_SERVER_ONLY)); then
		MODE="server"
	fi
	if [[ -n $VERSION ]]; then
		VERSION=${VERSION#v}
		[[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || usage_error "--version wants a version number like 0.1.0 (got \"$VERSION\")."
	fi
	if [[ ! $PORT =~ ^[0-9]{1,5}$ ]] || ((PORT < 1 || PORT > 65535)); then
		usage_error "--port wants a number between 1 and 65535 (got \"$PORT\")."
	fi
	if [[ -n $OUTPUT && ! $OUTPUT =~ ^[A-Za-z0-9-]+$ ]]; then
		usage_error "--output wants a connector name like HDMI-A-1, HDMI-A-2 or DSI-1 (got \"$OUTPUT\")."
	fi
	case $ROTATE in
	0 | 90 | 180 | 270) ;;
	*) usage_error "--rotate wants 0, 90, 180 or 270 (got \"$ROTATE\")." ;;
	esac
	case $BRIGHTNESS in
	auto | ddc | sysfs | none) ;;
	*) usage_error "--brightness wants auto, ddc, sysfs or none (got \"$BRIGHTNESS\")." ;;
	esac
	if [[ -n $FORCE_HDMI && ! $FORCE_HDMI =~ ^[0-9]{3,4}x[0-9]{3,4}$ ]]; then
		usage_error "--force-hdmi wants a screen size like 1920x1080 (got \"$FORCE_HDMI\")."
	fi
	if [[ $MODE == server ]] && ((SCREEN_OPTIONS_GIVEN)); then
		say "Note: --server-only sets up no screen, so the screen options are ignored."
	fi
	if [[ $MODE == display ]] && ((PORT_GIVEN)); then
		say "Note: --port is ignored with --display-only; the port is part of --url."
	fi
}

# ---------------------------------------------------------------------------- plumbing

refuse_root() {
	if [[ $(id -u) -eq 0 ]]; then
		die "Please run the installer as your normal user, without sudo." \
			"It asks for sudo by itself when it needs to. For example:" \
			"  bash kiosk/install.sh"
	fi
}

detect_tty() {
	if { : </dev/tty; } 2>/dev/null; then
		HAVE_TTY=1
	fi
}

setup_logging() {
	mkdir -p "$STATE_DIR"
	printf '\n----- %s  install.sh %s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$KIOSK_VERSION" "${ORIGINAL_ARGS[*]}" >>"$LOG_FILE"
	exec > >(tee -a "$LOG_FILE") 2>&1
	TEE_PID=$!
	LOGGING=1
}

cleanup() {
	if [[ -n $SUDO_KEEPALIVE_PID ]]; then
		kill "$SUDO_KEEPALIVE_PID" 2>/dev/null || true
	fi
	if [[ -n $TMP_DIR && -d $TMP_DIR ]]; then
		rm -rf "$TMP_DIR"
	fi
	# Let tee finish writing, so the last lines don't appear after the shell prompt.
	if [[ -n $TEE_PID ]]; then
		exec 1>&- 2>&-
		wait "$TEE_PID" 2>/dev/null || true
	fi
}

start_sudo() {
	if ! command -v sudo >/dev/null 2>&1; then
		die "This needs sudo, which isn't installed. Raspberry Pi OS includes it; is this Raspberry Pi OS?"
	fi
	if ! sudo -n true 2>/dev/null; then
		note "Some steps need administrator rights, so sudo may ask for your password."
		sudo -v || die "sudo didn't accept the password, so the installer can't continue." \
			"Your account needs to be allowed to use sudo (the first account on a Pi is)."
	fi
	# Keep sudo's timestamp fresh during long downloads; quiet, and gone when we are.
	(
		trap - ERR
		set +e
		while kill -0 "$$" 2>/dev/null; do
			sudo -n -v 2>/dev/null
			sleep 50
		done
	) >/dev/null 2>&1 &
	SUDO_KEEPALIVE_PID=$!
}

user_systemctl() {
	XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}" systemctl --user "$@"
}

header_comment() {
	printf '# Written by the Sunroom installer (kiosk/install.sh %s). Running it again replaces this file.\n' "$KIOSK_VERSION"
}

# Copy a file from the kiosk folder with a version header after any #! line.
stamp_file() {
	local src=$1 first=""
	IFS= read -r first <"$src" || true
	if [[ $first == '#!'* ]]; then
		printf '%s\n' "$first"
		header_comment
		tail -n +2 "$src"
	else
		header_comment
		cat "$src"
	fi
}

# install_stamped SRC DEST MODE [root]
install_stamped() {
	local src=$1 dest=$2 mode=$3 owner=${4:-} tmp
	tmp=$(mktemp "$TMP_DIR/stamped.XXXXXX")
	stamp_file "$src" >"$tmp"
	if [[ $owner == root ]]; then
		sudo install -o root -g root -m "$mode" "$tmp" "$dest"
	else
		mkdir -p "$(dirname "$dest")"
		install -m "$mode" "$tmp" "$dest"
	fi
}

pi_hostname() {
	local name
	name=$(hostname -s 2>/dev/null || hostname)
	printf '%s' "${name,,}"
}

pi_ip() {
	local dev ip=""
	dev=$(ip -4 route show default 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "dev") {print $(i + 1); exit}}')
	if [[ -n $dev ]]; then
		ip=$(ip -4 -o addr show dev "$dev" scope global 2>/dev/null | awk '{split($4, a, "/"); print a[1]; exit}')
	fi
	if [[ -z $ip ]]; then
		ip=$(hostname -I 2>/dev/null | awk '{print $1}')
	fi
	printf '%s' "$ip"
}

load_previous_state() {
	if [[ -r $STATE_FILE ]]; then
		# shellcheck source=/dev/null
		. "$STATE_FILE"
	fi
	LABWC_AUTOSTART_CREATED=${STATE_LABWC_AUTOSTART_CREATED:-0}
	TIME_WAIT_SYNC_BY_US=${STATE_TIME_WAIT_SYNC_BY_US:-0}
	NM_DROPIN_WRITTEN=${STATE_NM_DROPIN:-}
	CMDLINE_FILE=${STATE_CMDLINE_FILE:-}
	CMDLINE_BACKUP=${STATE_CMDLINE_BACKUP:-}
	CMDLINE_KEYS=${STATE_CMDLINE_KEYS:-}
	BACKLIGHT_RULE_WRITTEN=${STATE_BACKLIGHT_RULE:-}
	I2C_MODULES_WRITTEN=${STATE_I2C_MODULES:-}
}

save_state() {
	local tmp="$TMP_DIR/install-state"
	{
		printf '# What the Sunroom installer (kiosk/install.sh %s) changed outside its own files,\n' "$KIOSK_VERSION"
		printf '# read by kiosk/uninstall.sh to put things back. Rewritten on every run.\n'
		printf 'STATE_MODE=%q\n' "$MODE"
		printf 'STATE_SESSION=%q\n' "$SESSION"
		printf 'STATE_LABWC_AUTOSTART_CREATED=%q\n' "$LABWC_AUTOSTART_CREATED"
		printf 'STATE_TIME_WAIT_SYNC_BY_US=%q\n' "$TIME_WAIT_SYNC_BY_US"
		printf 'STATE_NM_DROPIN=%q\n' "$NM_DROPIN_WRITTEN"
		printf 'STATE_CMDLINE_FILE=%q\n' "$CMDLINE_FILE"
		printf 'STATE_CMDLINE_BACKUP=%q\n' "$CMDLINE_BACKUP"
		printf 'STATE_CMDLINE_KEYS=%q\n' "$CMDLINE_KEYS"
		printf 'STATE_BACKLIGHT_RULE=%q\n' "$BACKLIGHT_RULE_WRITTEN"
		printf 'STATE_I2C_MODULES=%q\n' "$I2C_MODULES_WRITTEN"
	} >"$tmp"
	mkdir -p "$STATE_DIR"
	install -m 0644 "$tmp" "$STATE_FILE"
}

# ---------------------------------------------------------------------------- step 0: checks

check_platform() {
	local arch
	arch=$(dpkg --print-architecture 2>/dev/null || uname -m)
	case $arch in
	arm64 | aarch64) ;;
	*)
		die "Sunroom needs the 64-bit version of Raspberry Pi OS (this Pi runs the $arch version)." \
			"Install \"Raspberry Pi OS (64-bit)\" with Raspberry Pi Imager, then run this again."
		;;
	esac
	[[ -r /etc/os-release ]] || die "This doesn't look like Raspberry Pi OS (there is no /etc/os-release)."
	# shellcheck source=/dev/null
	CODENAME=$(. /etc/os-release && printf '%s' "${VERSION_CODENAME:-}")
	case $CODENAME in
	bookworm | trixie) ;;
	*)
		die "This installer works on Raspberry Pi OS Bookworm or Trixie; this Pi runs \"${CODENAME:-something else}\"." \
			"Install the current Raspberry Pi OS (64-bit) with Raspberry Pi Imager, then run this again."
		;;
	esac
	note "Raspberry Pi OS ${CODENAME^}, 64-bit."
}

check_disk() {
	local free_kb
	free_kb=$(df -Pk / | awk 'NR == 2 {print $4}')
	if [[ ! $free_kb =~ ^[0-9]+$ ]] || ((free_kb < 2 * 1024 * 1024)); then
		die "This Pi needs at least 2 GB of free space; it has about $((${free_kb:-0} / 1024)) MB." \
			"Use a bigger memory card or SSD, or remove programs you don't need, then run this again."
	fi
	note "Free space: $((free_kb / 1024 / 1024)) GB."
}

check_internet() {
	local try url
	for try in 1 2 3; do
		for url in https://deb.debian.org/debian/ https://archive.raspberrypi.com/debian/ https://github.com/; do
			if curl -fsS --max-time 10 -o /dev/null "$url" 2>/dev/null; then
				note "Internet: OK."
				return 0
			fi
		done
		if ((try < 3)); then
			sleep 5
		fi
	done
	die "This Pi can't reach the internet." \
		"Check the Wi-Fi or network cable, and that the date and time are right (type: date)," \
		"then run the installer again."
}

check_remote_server() {
	local code
	code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 "$URL/api/health" 2>/dev/null || true)
	if [[ $code == 200 ]]; then
		note "Sunroom answered at $URL."
	else
		warn "Sunroom didn't answer at $URL just now. The kitchen screen keeps trying after the restart;" \
			"if it stays on the desktop picture, check that this address opens on a phone."
	fi
}

# Which desktop session will run after a restart. Mirrors raspi-config, which reads
# lightdm's autologin-session/user-session when switching and pgrep labwc/wayfire for
# the running one: rpd-labwc or LXDE-pi-labwc = labwc, LXDE-pi-wayfire = Wayfire (older
# Bookworm), rpd-x or LXDE-pi-x = X11.
lightdm_value() {
	local key=$1 file found value=""
	for file in /usr/share/lightdm/lightdm.conf.d/*.conf /etc/xdg/lightdm/lightdm.conf.d/*.conf \
		/etc/lightdm/lightdm.conf.d/*.conf /etc/lightdm/lightdm.conf; do
		[[ -r $file ]] || continue
		found=$(sed -n "s/^[[:space:]]*${key}[[:space:]]*=[[:space:]]*//p" "$file" | tail -n 1)
		if [[ -n $found ]]; then
			value=$found
		fi
	done
	printf '%s' "${value%%[[:space:]]*}"
}

lightdm_session() {
	local session
	session=$(lightdm_value autologin-session)
	if [[ -z $session ]]; then
		session=$(lightdm_value user-session)
	fi
	printf '%s' "$session"
}

session_kind() {
	case $1 in
	"") ;;
	*labwc*) printf 'labwc' ;;
	*wayfire*) printf 'wayfire' ;;
	*)
		if [[ -e /usr/share/xsessions/$1.desktop ]]; then
			printf 'x11'
		elif [[ -e /usr/share/wayland-sessions/$1.desktop ]]; then
			printf 'other'
		fi
		;;
	esac
}

running_session_kind() {
	if pgrep -x labwc >/dev/null 2>&1; then
		printf 'labwc'
	elif pgrep -x wayfire >/dev/null 2>&1; then
		printf 'wayfire'
	elif pgrep -x Xorg >/dev/null 2>&1 || pgrep -x openbox >/dev/null 2>&1; then
		printf 'x11'
	fi
}

installed_session_kind() {
	if [[ -e /usr/share/wayland-sessions/rpd-labwc.desktop || -e /usr/share/wayland-sessions/LXDE-pi-labwc.desktop ]]; then
		printf 'labwc'
	elif [[ -e /usr/share/xsessions/rpd-x.desktop || -e /usr/share/xsessions/LXDE-pi-x.desktop ]]; then
		printf 'x11'
	fi
}

has_x11_session() {
	[[ -e /usr/share/xsessions/rpd-x.desktop || -e /usr/share/xsessions/LXDE-pi-x.desktop ]]
}

has_desktop() {
	local file
	[[ -e /etc/init.d/lightdm ]] || return 1
	for file in /usr/share/xsessions/*.desktop /usr/share/wayland-sessions/*.desktop; do
		if [[ -e $file ]]; then
			return 0
		fi
	done
	return 1
}

labwc_switch_command() {
	if [[ $CODENAME == bookworm ]]; then
		if [[ -x /usr/bin/labwc ]]; then
			printf 'sudo raspi-config nonint do_wayland W3'
		else
			printf 'sudo apt update && sudo apt full-upgrade -y && sudo raspi-config nonint do_wayland W3'
		fi
	else
		printf 'sudo raspi-config nonint do_wayland W2'
	fi
}

detect_session() {
	local configured kind
	if ! command -v raspi-config >/dev/null 2>&1 || ! has_desktop; then
		die "This Pi has no desktop, so it can't drive a kitchen screen." \
			"To run only Sunroom here, run the installer again with --server-only." \
			"For a kitchen screen, install \"Raspberry Pi OS (64-bit)\" (the one with desktop) with Raspberry Pi Imager."
	fi
	configured=$(lightdm_session)
	if ((FORCE_X11)); then
		has_x11_session || die "You asked for the X11 desktop (--x11), but it isn't installed on this Pi." \
			"Run the installer without --x11 to use the standard labwc desktop."
		if [[ $(session_kind "$configured") != x11 ]]; then
			SWITCH_TO_X11=1
		fi
		SESSION="x11"
		note "Desktop: X11 (as asked with --x11)."
		return
	fi
	kind=$(session_kind "$configured")
	if [[ -z $kind ]]; then
		kind=$(running_session_kind)
	fi
	if [[ -z $kind ]]; then
		kind=$(installed_session_kind)
	fi
	case $kind in
	labwc)
		SESSION="wayland"
		note "Desktop: labwc (Wayland)."
		;;
	x11)
		SESSION="x11"
		note "Desktop: X11."
		;;
	wayfire)
		die "This Pi's desktop uses Wayfire, which the kitchen screen doesn't support." \
			"Switch to the newer labwc desktop with this one line, restart, then run the installer again:" \
			"  $(labwc_switch_command)"
		;;
	*)
		die "This Pi's desktop (${configured:-unknown}) isn't one the kitchen screen supports." \
			"Switch to the standard labwc desktop with this one line, restart, then run the installer again:" \
			"  $(labwc_switch_command)"
		;;
	esac
}

# The connector with a screen plugged in, by its kernel name (HDMI-A-1, DSI-1, ...).
detect_output() {
	local status name pass
	for pass in hdmi any; do
		for status in /sys/class/drm/card*-*/status; do
			[[ -r $status ]] || continue
			[[ $(<"$status") == connected ]] || continue
			name=${status%/status}
			name=${name##*/}
			name=${name#card*-}
			case $name in
			Writeback-*) continue ;;
			HDMI-*) ;;
			*) [[ $pass == any ]] || continue ;;
			esac
			printf '%s' "$name"
			return 0
		done
	done
	return 1
}

resolve_output() {
	if ((OUTPUT_GIVEN)); then
		note "Screen connector: $OUTPUT (as given)."
	elif OUTPUT=$(detect_output); then
		note "Screen connector: $OUTPUT."
	else
		OUTPUT="HDMI-A-1"
		note "No screen detected right now; assuming it will be on $OUTPUT."
	fi
}

# The first-boot software update (or the desktop's update check) holds apt's locks for a
# while; apt-get would fail on them, so wait.
apt_busy() {
	if command -v python3 >/dev/null 2>&1; then
		sudo python3 - <<'PY'
import fcntl
import os
import sys

for path in ("/var/lib/dpkg/lock-frontend", "/var/lib/dpkg/lock",
             "/var/lib/apt/lists/lock", "/var/cache/apt/archives/lock"):
    try:
        fd = os.open(path, os.O_RDWR)
    except OSError:
        continue
    try:
        fcntl.lockf(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)  # the same fcntl lock apt and dpkg take
        fcntl.lockf(fd, fcntl.LOCK_UN)
    except OSError:
        sys.exit(0)  # busy
    finally:
        os.close(fd)
sys.exit(1)  # free
PY
		return
	fi
	pgrep -x apt-get >/dev/null 2>&1 || pgrep -x apt >/dev/null 2>&1 || pgrep -x dpkg >/dev/null 2>&1 ||
		pgrep -f unattended-upgrade >/dev/null 2>&1
}

wait_for_apt() {
	local waited=0
	if ! apt_busy; then
		return 0
	fi
	note "This Pi is installing its own updates (normal right after the first start). Waiting for it to finish..."
	while apt_busy; do
		sleep 5
		waited=$((waited + 5))
		if ((waited % 60 == 0)); then
			note "Still waiting ($((waited / 60)) min)..."
		fi
		if ((waited >= 1800)); then
			die "The Pi's own software update has been running for 30 minutes." \
				"Restart the Pi (sudo reboot), wait five minutes, then run the installer again."
		fi
	done
	note "The Pi's own update finished."
}

# ---------------------------------------------------------------------------- the kiosk folder

has_kiosk_files() {
	local dir=$1 file
	for file in sunroom-kiosk labwc-rule.py update.sh uninstall.sh \
		systemd/sunroom-kiosk.service systemd/sunroom-kiosk-restart.service systemd/sunroom-kiosk-restart.timer; do
		[[ -f $dir/$file ]] || return 1
	done
}

download_kiosk_files() {
	local ref url tarball args
	if [[ -n $VERSION ]]; then ref="refs/tags/v$VERSION"; else ref="refs/heads/main"; fi
	url="https://codeload.github.com/$SUNROOM_REPO/tar.gz/$ref"
	tarball="$TMP_DIR/kiosk.tar.gz"
	args=""
	if ((${#ORIGINAL_ARGS[@]})); then
		args=$(printf ' %q' "${ORIGINAL_ARGS[@]}")
	fi
	note "Downloading the kitchen-screen files (${VERSION:+version $VERSION}${VERSION:-latest})..."
	if ! curl -fsSL --retry 3 --connect-timeout 15 -o "$tarball" "$url" 2>>"$LOG_FILE"; then
		die "I couldn't download the rest of the kitchen-screen files from GitHub." \
			"Either GitHub can't be reached right now${VERSION:+, version $VERSION is not published}, or the project isn't public yet." \
			"Instead, copy the whole kiosk folder to this Pi (for example: scp -r kiosk YOUR-USER@sunroom.local:)" \
			"and run the installer from that copy:" \
			"  bash kiosk/install.sh${args}"
	fi
	mkdir -p "$TMP_DIR/src"
	if ! tar -xzf "$tarball" -C "$TMP_DIR/src" --strip-components=1 --wildcards '*/kiosk/*' 2>/dev/null; then
		die "The download from GitHub has no kitchen-screen files in it, or it was damaged." \
			"Run the installer again${VERSION:+, or pick another version}."
	fi
	SRC_DIR="$TMP_DIR/src/kiosk"
	has_kiosk_files "$SRC_DIR" || die "The download from GitHub is missing some kitchen-screen files." \
		"Copy the kiosk folder to this Pi and run: bash kiosk/install.sh${args}"
}

get_kiosk_files() {
	local dir
	if [[ -n $SCRIPT_PATH && -f $SCRIPT_PATH ]]; then
		dir=$(cd "$(dirname "$SCRIPT_PATH")" && pwd)
		if has_kiosk_files "$dir"; then
			SRC_DIR=$dir
			note "Using the kitchen-screen files next to this installer ($(tidy "$dir"))."
			return
		fi
	fi
	download_kiosk_files
}

# ---------------------------------------------------------------------------- step 1: packages

pkg_installed() {
	# shellcheck disable=SC2016 # ${Status} is dpkg-query's format, not a shell variable
	[[ $(dpkg-query -W -f='${Status}' "$1" 2>/dev/null || true) == "install ok installed" ]]
}

pkg_available() {
	local candidate
	candidate=$(apt-cache policy "$1" 2>/dev/null | awk '$1 == "Candidate:" {print $2; exit}')
	[[ -n $candidate && $candidate != "(none)" ]]
}

# Callers run wait_for_apt first (so its messages show); the lock timeout is a backstop.
apt_get() {
	sudo env DEBIAN_FRONTEND=noninteractive apt-get -q -o DPkg::Lock::Timeout=600 "$@"
}

install_packages() {
	local -a wanted=(curl ca-certificates jq qrencode) optional=() missing=()
	local pkg need_chromium=0
	if [[ $MODE != server ]]; then
		wanted+=(python3)
		if [[ $SESSION == wayland ]]; then
			wanted+=(wlr-randr)
			optional+=(wlopm) # the screen helper switches the screen off and on with it
		else
			wanted+=(x11-xserver-utils unclutter)
		fi
		if wants_ddc; then
			optional+=(ddcutil) # the screen helper sets a monitor's brightness with it
		fi
		if ! command -v chromium >/dev/null 2>&1 && ! command -v chromium-browser >/dev/null 2>&1; then
			need_chromium=1
		fi
	fi
	for pkg in "${wanted[@]}" "${optional[@]}"; do
		if ! pkg_installed "$pkg"; then
			missing+=("$pkg")
		fi
	done
	if ((${#missing[@]} == 0 && !need_chromium)); then
		note "Everything it needs is already installed."
	else
		wait_for_apt
		note "Refreshing the list of available software..."
		quietly apt_get update || die "Couldn't refresh the list of available software." \
			"Check the internet connection and that the date and time are right (type: date), then run this again."
		if ((need_chromium)); then
			if pkg_available chromium; then
				missing+=(chromium)
			else
				missing+=(chromium-browser)
			fi
		fi
		local -a install_now=()
		for pkg in "${missing[@]}"; do
			if [[ $pkg == wlopm ]] && ! pkg_available wlopm; then
				note "Skipping wlopm (not offered for this Pi); the screen helper uses wlr-randr instead."
				continue
			fi
			if [[ $pkg == ddcutil ]] && ! pkg_available ddcutil; then
				note "Skipping ddcutil (not offered for this Pi); the page dims itself instead."
				continue
			fi
			install_now+=("$pkg")
		done
		if ((${#install_now[@]})); then
			wait_for_apt
			note "Installing: ${install_now[*]}"
			quietly apt_get install -y "${install_now[@]}" || die "Couldn't install: ${install_now[*]}" \
				"Check the internet connection, then run the installer again."
		fi
	fi
	if [[ $MODE != server && $SESSION == wayland ]]; then
		check_labwc_version
	fi
}

check_labwc_version() {
	local version
	# shellcheck disable=SC2016 # ${Version} is dpkg-query's format, not a shell variable
	version=$(dpkg-query -W -f='${Version}' labwc 2>/dev/null || true)
	if [[ -n $version ]] && dpkg --compare-versions "$version" lt 0.8.4; then
		warn "this Pi's desktop (labwc $version) is older than 0.8.4, so the mouse pointer may stay" \
			"visible on the kitchen screen. Bringing the Pi up to date fixes it: sudo apt update && sudo apt full-upgrade"
	fi
}

# ---------------------------------------------------------------------------- steps 2 and 3: Docker and Sunroom

install_docker() {
	local user
	user=$(id -un)
	if command -v docker >/dev/null 2>&1; then
		note "Docker is already installed."
	else
		note "Installing Docker, the tool that runs Sunroom (this takes a few minutes)..."
		curl -fsSL --retry 3 -o "$TMP_DIR/get-docker.sh" https://get.docker.com ||
			die "Couldn't download Docker's installer. Check the internet connection, then run this again."
		wait_for_apt
		quietly sudo sh "$TMP_DIR/get-docker.sh" || die "Docker's installer didn't finish. Its last messages are above." \
			"Running the Sunroom installer again is safe; it tries again."
	fi
	# Only a convenience for later (this script always uses sudo docker).
	if ! getent group docker >/dev/null 2>&1; then
		log_only "No docker group on this system; not adding $user to it."
	elif [[ " $(id -nG "$user") " != *" docker "* ]]; then
		sudo usermod -aG docker "$user"
		note "Added $user to the docker group (takes effect after the next login; until then use sudo docker)."
	fi
	sudo systemctl enable --now docker >/dev/null 2>&1 || die "Docker is installed but won't start." \
		"Restart the Pi (sudo reboot) and run the installer again."
	# Unverified: Docker installed some other way may lack "docker compose"; the plugin
	# package exists in Docker's own apt source, "docker-compose" in Debian's.
	if ! sudo docker compose version >/dev/null 2>&1; then
		note "Adding Docker's compose tool..."
		wait_for_apt
		quietly apt_get install -y docker-compose-plugin || quietly apt_get install -y docker-compose || true
		sudo docker compose version >/dev/null 2>&1 || die "Docker's compose tool is missing and couldn't be installed." \
			"Install it with:  sudo apt install docker-compose-plugin  then run the installer again."
	fi
}

compose() {
	sudo docker compose --project-directory "$SERVER_DIR" -f "$SERVER_DIR/docker-compose.yml" "$@"
}

# The tag in "image: scopexl/sunroom:<tag>" of an earlier install; empty when there is none.
existing_tag() {
	sudo test -f "$SERVER_DIR/docker-compose.yml" || return 0
	sudo awk -v image="$SUNROOM_IMAGE" '
		$1 == "image:" {
			value = $2
			gsub(/["\047]/, "", value)
			if (index(value, image ":") == 1) { print substr(value, length(image) + 2); exit }
		}' "$SERVER_DIR/docker-compose.yml"
}

render_compose() {
	local tz=$1 advertised=$2
	header_comment
	cat <<EOF
# Sunroom on this Raspberry Pi: one container, its data in the sunroom_data volume.
# Update with: sudo /opt/sunroom/update.sh   (or a version: sudo /opt/sunroom/update.sh 0.2.0)
# Optional settings (household password, your own HTTPS address) go in .env next to this file.
name: sunroom
services:
  sunroom:
    image: $SUNROOM_IMAGE:$IMAGE_TAG
    container_name: sunroom
    restart: unless-stopped
    env_file: .env
    environment:
      TZ: "$tz"
      SUNROOM_ADVERTISED_URL: "$advertised"
      SUNROOM_INSTALL_KIND: "pi"
    ports:
      - "$PORT:8080"
    volumes:
      - sunroom_data:/data
    read_only: true
    tmpfs:
      - /tmp
    cap_drop: [ALL]
    security_opt: ["no-new-privileges:true"]
    stop_grace_period: 30s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  sunroom_data:
    name: sunroom_data
EOF
}

render_env() {
	header_comment | sed 's/ Running it again replaces this file./ It is created once and never overwritten./'
	cat <<'EOF'
# Optional settings for Sunroom on this Pi. To use one, remove the "# " in front of it,
# then restart Sunroom:  cd /opt/sunroom && sudo docker compose up -d
#
# A household password that always wins over the one chosen in the setup wizard
# (12 or more characters; single quotes keep symbols such as $ as they are):
# APP_PASSWORD='a long family passphrase'
#
# Your own address for Sunroom, if you reach it through your own HTTPS proxy
# (comma-separated; *.example.com works too):
# APP_ALLOWED_HOSTS=calendar.example.com
EOF
}

write_stack() {
	local tz host previous
	previous=$(existing_tag || true)
	if [[ -n $VERSION ]]; then
		IMAGE_TAG=$VERSION
	elif [[ -n $previous ]]; then
		IMAGE_TAG=$previous
		if [[ $previous != latest ]]; then
			note "Keeping the Sunroom version this Pi already has ($previous). To change it: sudo /opt/sunroom/update.sh"
		fi
	else
		IMAGE_TAG="latest"
	fi
	tz=$(timedatectl show -p Timezone --value 2>/dev/null || true)
	if [[ ! $tz =~ ^[A-Za-z0-9_+/-]+$ ]]; then
		tz=$(cat /etc/timezone 2>/dev/null || true)
	fi
	if [[ ! $tz =~ ^[A-Za-z0-9_+/-]+$ ]]; then
		tz="Etc/UTC"
	fi
	host=$(pi_hostname)

	sudo install -d -m 0755 -o root -g root "$SERVER_DIR"
	render_compose "$tz" "http://$host.local:$PORT" >"$TMP_DIR/docker-compose.yml"
	if sudo test -f "$SERVER_DIR/docker-compose.yml" && ! sudo cmp -s "$TMP_DIR/docker-compose.yml" "$SERVER_DIR/docker-compose.yml"; then
		sudo cp -p "$SERVER_DIR/docker-compose.yml" "$SERVER_DIR/docker-compose.yml.previous"
		note "Saved the previous settings as $SERVER_DIR/docker-compose.yml.previous."
	fi
	sudo install -m 0644 -o root -g root "$TMP_DIR/docker-compose.yml" "$SERVER_DIR/docker-compose.yml"
	if sudo test -f "$SERVER_DIR/.env"; then
		sudo chown root:root "$SERVER_DIR/.env"
		sudo chmod 0600 "$SERVER_DIR/.env"
	else
		render_env >"$TMP_DIR/env"
		sudo install -m 0600 -o root -g root "$TMP_DIR/env" "$SERVER_DIR/.env"
	fi
	install_stamped "$SRC_DIR/update.sh" "$SERVER_DIR/update.sh" 0755 root
	note "Wrote $SERVER_DIR/docker-compose.yml (Sunroom $IMAGE_TAG, port $PORT, time zone $tz)."
}

wait_for_health() {
	local url="http://localhost:$PORT/api/health" waited=0 code
	note "Waiting for Sunroom to answer (the first start can take a minute or two)..."
	while ((waited < HEALTH_TIMEOUT)); do
		code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 2 "$url" 2>/dev/null || true)
		if [[ $code == 200 ]]; then
			note "Sunroom is up."
			return 0
		fi
		sleep 2
		waited=$((waited + 2))
		if ((waited % 30 == 0)); then
			note "Still starting ($waited seconds)..."
		fi
	done
	say "Sunroom's last 40 log lines:"
	sudo docker logs --tail 40 sunroom 2>&1 || true
	die "Sunroom didn't answer within $((HEALTH_TIMEOUT / 60)) minutes. Its last log lines are above." \
		"Running the installer again is safe; it continues from here."
}

start_stack() {
	local image="$SUNROOM_IMAGE:$IMAGE_TAG" output
	if sudo docker image inspect "$image" >/dev/null 2>&1; then
		note "Sunroom $IMAGE_TAG is already downloaded."
	else
		note "Downloading Sunroom ($image); the first time takes a few minutes..."
		compose pull || die "Couldn't download Sunroom ($image) from Docker Hub." \
			"Check the internet connection${VERSION:+ and that version $VERSION exists}, then run the installer again."
	fi
	note "Starting Sunroom..."
	if ! output=$(compose up -d 2>&1); then
		printf '%s\n' "$output"
		if grep -qiE 'address already in use|port is already allocated' <<<"$output"; then
			die "Another program on this Pi already uses port $PORT." \
				"Run the installer again with another port, for example: --port 8081"
		fi
		if grep -qi 'is already in use by container' <<<"$output"; then
			die "A container called sunroom already exists, perhaps from an earlier docker run." \
				"Remove it (your data in the sunroom_data volume stays):  sudo docker rm -f sunroom" \
				"then run the installer again."
		fi
		die "Sunroom didn't start; Docker's message is above." "Running the installer again is safe."
	fi
	printf '%s\n' "$output"
	wait_for_health
}

# ---------------------------------------------------------------------------- step 4: the kitchen screen

install_helper_copies() {
	install_stamped "$SRC_DIR/uninstall.sh" "$SHARE_DIR/uninstall.sh" 0755
	install_stamped "$SRC_DIR/labwc-rule.py" "$SHARE_DIR/labwc-rule.py" 0755
}

write_kiosk_config() {
	local url tmp="$TMP_DIR/kiosk-config"
	if [[ $MODE == display ]]; then url=$URL; else url="http://localhost:$PORT"; fi
	{
		header_comment
		printf '# Read by ~/.local/bin/sunroom-kiosk and ~/.local/bin/sunroom-screen at every start.\n'
		printf '# After a change: systemctl --user restart sunroom-kiosk sunroom-screen\n'
		printf 'SUNROOM_URL=%q\n' "$url"
		printf 'SUNROOM_SESSION=%q\n' "$SESSION"
		printf 'SUNROOM_OUTPUT=%q\n' "$OUTPUT"
		printf 'SUNROOM_ROTATE=%q\n' "$ROTATE"
		printf '# The screen helper (yes or no) switches the screen off at night. How it dims it:\n'
		printf '# auto, ddc (DDC/CI on I2C bus SUNROOM_DDC_BUS), sysfs (the backlight SUNROOM_BACKLIGHT\n'
		printf '# under /sys/class/backlight) or none (the page dims itself). See docs/KIOSK.md.\n'
		printf 'SUNROOM_SCREEN_HELPER=%q\n' "$SCREEN_HELPER"
		printf 'SUNROOM_BRIGHTNESS=%q\n' "$BRIGHTNESS"
		printf 'SUNROOM_DDC_BUS=%q\n' "$DDC_BUS"
		printf 'SUNROOM_BACKLIGHT=%q\n' "$BACKLIGHT"
		printf 'SUNROOM_MODE=%q\n' "$MODE"
	} >"$tmp"
	mkdir -p "$CONFIG_DIR"
	install -m 0644 "$tmp" "$CONFIG_DIR/config"
	note "Saved the kitchen screen's settings in $(tidy "$CONFIG_DIR/config") (it opens $url/display)."
}

install_units() {
	local unit
	install_stamped "$SRC_DIR/sunroom-kiosk" "$BIN_DIR/sunroom-kiosk" 0755
	for unit in sunroom-kiosk.service sunroom-kiosk-restart.service sunroom-kiosk-restart.timer; do
		install_stamped "$SRC_DIR/systemd/$unit" "$UNIT_DIR/$unit" 0644
	done
	if [[ $SCREEN_HELPER == yes ]]; then
		install_stamped "$SRC_DIR/sunroom-screen" "$BIN_DIR/sunroom-screen" 0755
		install_stamped "$SRC_DIR/systemd/sunroom-screen.service" "$UNIT_DIR/sunroom-screen.service" 0644
	else
		remove_screen_helper
	fi
	if user_systemctl daemon-reload >/dev/null 2>&1 &&
		user_systemctl enable --now sunroom-kiosk-restart.timer >/dev/null 2>&1; then
		note "Installed the kitchen screen's service and its nightly restart at about 04:00."
	else
		mkdir -p "$UNIT_DIR/timers.target.wants"
		ln -sfn "$UNIT_DIR/sunroom-kiosk-restart.timer" "$UNIT_DIR/timers.target.wants/sunroom-kiosk-restart.timer"
		note "Installed the kitchen screen's service; its nightly restart starts after the Pi restarts."
	fi
	if [[ $SCREEN_HELPER == yes ]]; then
		# A helper already running from an earlier install switches to this version now.
		user_systemctl try-restart sunroom-screen.service >/dev/null 2>&1 || true
		note "Installed the screen helper, which puts the screen to sleep and dims it on Sunroom's schedule."
	fi
}

# Print FILE without the managed block. An unfinished block is printed back unchanged.
strip_block() {
	awk -v begin="$BLOCK_BEGIN" -v end="$BLOCK_END" '
		index($0, begin) == 1 && !inblock { inblock = 1; held = $0; next }
		inblock { held = held "\n" $0; if ($0 == end) { inblock = 0; held = "" } next }
		{ print }
		END { if (inblock) print held }
	' "$1"
}

drop_trailing_blank_lines() {
	awk '{ line[NR] = $0 } END { n = NR; while (n > 0 && line[n] ~ /^[ \t]*$/) n--; for (i = 1; i <= n; i++) print line[i] }' "$1"
}

# Unverified: kanshi, started from /etc/xdg/labwc/autostart, may re-apply a screen layout
# saved in the desktop's screen settings after the wlr-randr line below runs; if so, the
# rotation should be set there instead (docs/KIOSK.md).
labwc_block() {
	printf '%s (Sunroom kitchen screen, installer %s; kiosk/install.sh rewrites this block) >>>\n' "$BLOCK_BEGIN" "$KIOSK_VERSION"
	printf 'systemctl --user import-environment WAYLAND_DISPLAY DISPLAY XAUTHORITY XDG_CURRENT_DESKTOP XDG_SESSION_TYPE >/dev/null 2>&1\n'
	if [[ $ROTATE != 0 ]]; then
		printf 'wlr-randr --output %s --transform %s >/dev/null 2>&1\n' "$OUTPUT" "$ROTATE"
	fi
	printf 'systemctl --user --no-block restart %s\n' "$(session_units)"
	printf '%s\n' "$BLOCK_END"
}

# The user units the desktop session starts: the browser, and the screen helper when it's on.
session_units() {
	if [[ $SCREEN_HELPER == yes ]]; then
		printf 'sunroom-kiosk.service sunroom-screen.service'
	else
		printf 'sunroom-kiosk.service'
	fi
}

# labwc runs ~/.config/labwc/autostart with sh at login; Raspberry Pi OS starts labwc with
# --merge-config, so this file runs in addition to /etc/xdg/labwc/autostart.
write_labwc_autostart() {
	local file="$LABWC_DIR/autostart" base="$TMP_DIR/autostart.base" new="$TMP_DIR/autostart.new"
	mkdir -p "$LABWC_DIR"
	if [[ -f $file ]]; then
		strip_block "$file" >"$base"
	else
		: >"$base"
		LABWC_AUTOSTART_CREATED=1
	fi
	drop_trailing_blank_lines "$base" >"$new"
	if [[ -s $new ]]; then
		printf '\n' >>"$new"
	fi
	labwc_block >>"$new"
	if [[ -f $file ]] && cmp -s "$new" "$file"; then
		note "The desktop already starts the kitchen screen."
		return 0
	fi
	if [[ -f $file ]]; then
		cat "$new" >"$file"
	else
		install -m 0644 "$new" "$file"
	fi
	note "The desktop now starts the kitchen screen at login ($(tidy "$file"))."
}

remove_labwc_block() {
	local file="$LABWC_DIR/autostart"
	if [[ -f $file ]] && grep -q "^$BLOCK_BEGIN" "$file"; then
		strip_block "$file" >"$TMP_DIR/autostart.stripped"
		cat "$TMP_DIR/autostart.stripped" >"$file"
	fi
}

# raspi-config's do_blanking only edits the labwc autostart when labwc is running; on a
# labwc desktop, blanking is the swayidle line it adds there, so remove it ourselves too.
remove_swayidle() {
	local file="$LABWC_DIR/autostart"
	if [[ -f $file ]] && grep -q swayidle "$file"; then
		sed '/swayidle/d' "$file" >"$TMP_DIR/autostart.noidle"
		cat "$TMP_DIR/autostart.noidle" >"$file"
		note "Turned off the desktop's screen blanking (swayidle) in $(tidy "$file")."
	fi
}

# Unverified on hardware: that the Pi's X11 session (lxsession: rpd-x on Trixie, LXDE-pi-x
# on Bookworm) runs ~/.config/autostart entries, as XDG autostart says it should.
write_xdg_autostart() {
	{
		header_comment
		printf '[Desktop Entry]\n'
		printf 'Type=Application\n'
		printf 'Name=Sunroom kitchen screen\n'
		printf 'Comment=Starts the Sunroom kitchen screen\n'
		printf 'Exec=sh -c "systemctl --user import-environment DISPLAY XAUTHORITY; systemctl --user --no-block restart %s"\n' "$(session_units)"
		printf 'NoDisplay=true\n'
		printf 'X-GNOME-Autostart-enabled=true\n'
	} >"$TMP_DIR/sunroom-kiosk.desktop"
	mkdir -p "$(dirname "$XDG_AUTOSTART_FILE")"
	install -m 0644 "$TMP_DIR/sunroom-kiosk.desktop" "$XDG_AUTOSTART_FILE"
	note "The desktop now starts the kitchen screen at login ($(tidy "$XDG_AUTOSTART_FILE"))."
}

apply_labwc_settings() {
	local status=0
	python3 "$SHARE_DIR/labwc-rule.py" --installer-version "$KIOSK_VERSION" 2>&1 | sed 's/^/    /' || status=$?
	if ((status != 0 && status != 2)); then
		warn "couldn't adjust the pointer and touch settings (labwc rc.xml); the kitchen screen still works."
	fi
	pkill -HUP -u "$(id -u)" -x labwc 2>/dev/null || true # reload labwc's settings if it is running
}

write_wifi_dropin() {
	if [[ ! -d /etc/NetworkManager/conf.d ]]; then
		note "This Pi doesn't use NetworkManager; leaving Wi-Fi power saving as it is."
		return 0
	fi
	{
		header_comment
		printf '# Wi-Fi power saving drops the kitchen screen'"'"'s live updates, so it stays off.\n'
		printf '[connection]\n'
		printf 'wifi.powersave = 2\n'
	} >"$TMP_DIR/wifi.conf"
	NM_DROPIN_WRITTEN=$NM_DROPIN
	if sudo cmp -s "$TMP_DIR/wifi.conf" "$NM_DROPIN"; then
		note "Wi-Fi power saving is already off."
		return 0
	fi
	sudo install -m 0644 -o root -g root "$TMP_DIR/wifi.conf" "$NM_DROPIN"
	note "Turned off Wi-Fi power saving (it drops live updates)."
}

# Unverified: that every Raspberry Pi OS image ships systemd-time-wait-sync (it comes with
# systemd-timesyncd, which Raspberry Pi OS uses); it is checked for before enabling.
enable_time_wait_sync() {
	if ! systemctl cat systemd-time-wait-sync.service >/dev/null 2>&1; then
		note "systemd-time-wait-sync isn't available here; the screen waits for the clock by itself."
		return 0
	fi
	if systemctl is-enabled --quiet systemd-time-wait-sync.service 2>/dev/null; then
		return 0
	fi
	sudo systemctl enable systemd-time-wait-sync.service >/dev/null 2>&1 ||
		{
			warn "couldn't turn on systemd-time-wait-sync; the screen still waits for the clock itself."
			return 0
		}
	TIME_WAIT_SYNC_BY_US=1
	note "At startup, the Pi now sets its clock from the internet before relying on it."
}

# Where the firmware reads the kernel command line from, as raspi-config (Trixie) works it out.
cmdline_path() {
	local firmware=/boot/firmware prefix="" name=""
	[[ -e $firmware/config.txt ]] || firmware=/boot
	if [[ -r /proc/device-tree/chosen/os_prefix ]]; then
		prefix=$(tr -d '\0' </proc/device-tree/chosen/os_prefix)
	fi
	if command -v vcgencmd >/dev/null 2>&1; then
		name=$(vcgencmd get_config cmdline 2>/dev/null | sed -n 's/^cmdline=//p' || true)
	fi
	printf '%s/%s%s' "$firmware" "$prefix" "${name:-cmdline.txt}"
}

add_cmdline_key() {
	local key
	local -a keys=()
	read -ra keys <<<"$CMDLINE_KEYS"
	for key in "${keys[@]}"; do
		if [[ $key == "$1" ]]; then
			return 0
		fi
	done
	CMDLINE_KEYS="${CMDLINE_KEYS:+$CMDLINE_KEYS }$1"
}

# --force-hdmi: video=<output>:<mode>M@60D forces the mode and keeps the output on, and
# vc4.force_hotplug (a bit mask: 1 = HDMI0, 2 = HDMI1) ignores a monitor that is off at
# boot. The file is one line; tokens are replaced, never duplicated, and the first-ever
# original is kept as <file>.sunroom-backup so kiosk/uninstall.sh can restore them.
apply_force_hdmi() {
	local output=HDMI-A-1 bit file line backup video token new_line hotplug_old placed_video=0 placed_hotplug=0
	local -a tokens new_tokens=()
	if ((OUTPUT_GIVEN)) || [[ $OUTPUT == HDMI-A-[12] ]]; then
		output=$OUTPUT
	fi
	case $output in
	HDMI-A-1) bit=1 ;;
	HDMI-A-2) bit=2 ;;
	*)
		warn "--force-hdmi only works for HDMI screens (HDMI-A-1 or HDMI-A-2), not $output; skipped."
		return 0
		;;
	esac
	file=$(cmdline_path)
	if ! sudo test -f "$file"; then
		warn "couldn't find $file, so --force-hdmi was skipped."
		return 0
	fi
	line=$(sudo cat "$file")
	if [[ -z $line || $line == *$'\n'* || $line != *root=* ]]; then
		warn "$file doesn't look like the usual single line, so it was left alone (--force-hdmi skipped)."
		return 0
	fi
	backup="$file.sunroom-backup"
	if ! sudo test -e "$backup"; then
		sudo cp -p "$file" "$backup"
	fi
	video="video=$output:${FORCE_HDMI}M@60D"
	read -ra tokens <<<"$line"
	for token in "${tokens[@]}"; do
		case $token in
		"video=$output:"*)
			if ((!placed_video)); then
				new_tokens+=("$video")
				placed_video=1
			fi
			;;
		vc4.force_hotplug=*)
			if ((!placed_hotplug)); then
				hotplug_old=${token#*=}
				[[ $hotplug_old =~ ^[0-9]+$ ]] || hotplug_old=0
				new_tokens+=("vc4.force_hotplug=$((hotplug_old | bit))")
				placed_hotplug=1
			fi
			;;
		*) new_tokens+=("$token") ;;
		esac
	done
	if ((!placed_video)); then
		new_tokens+=("$video")
	fi
	if ((!placed_hotplug)); then
		new_tokens+=("vc4.force_hotplug=$bit")
	fi
	new_line="${new_tokens[*]}"
	CMDLINE_FILE=$file
	CMDLINE_BACKUP=$backup
	add_cmdline_key "video=$output:"
	add_cmdline_key "vc4.force_hotplug="
	if [[ $new_line == "$line" ]]; then
		note "The screen is already forced to $FORCE_HDMI on $output."
		return 0
	fi
	printf '%s\n' "$new_line" >"$TMP_DIR/cmdline.txt"
	sudo cp "$TMP_DIR/cmdline.txt" "$file"
	sync
	note "The Pi now always drives $output at $FORCE_HDMI, even if the screen is off at startup ($file)."
}

# ---------------------------------------------------------------------------- the screen helper

# Kitchen-screen files from before Sunroom 0.6.0 (--version 0.5.0 downloads those) have no
# screen helper; the page then goes dark at night by itself.
check_screen_helper_files() {
	if [[ $SCREEN_HELPER == yes ]] &&
		[[ ! -f $SRC_DIR/sunroom-screen || ! -f $SRC_DIR/systemd/sunroom-screen.service ]]; then
		SCREEN_HELPER="no"
		note "These kitchen-screen files have no screen helper; at night the page goes dark by itself."
	fi
}

# The first backlight under /sys/class/backlight: DSI panels such as the Touch Display have
# one, HDMI monitors don't.
backlight_device() {
	local device
	for device in /sys/class/backlight/*; do
		if [[ -e $device/brightness ]]; then
			printf '%s' "${device##*/}"
			return 0
		fi
	done
	return 1
}

# ddcutil: for --brightness ddc, and for auto when the screen has no backlight of its own.
wants_ddc() {
	[[ $SCREEN_HELPER == yes ]] || return 1
	case $BRIGHTNESS in
	ddc) return 0 ;;
	auto) ! backlight_device >/dev/null ;;
	*) return 1 ;;
	esac
}

# add_to_group GROUP, when it exists and this user isn't in it yet. It counts from the next
# login, which the restart at the end brings. (The Pi's first user is usually in video and
# i2c already.)
add_to_group() {
	local group=$1 user
	user=$(id -un)
	getent group "$group" >/dev/null 2>&1 || return 0
	if [[ " $(id -nG "$user") " != *" $group "* ]]; then
		sudo usermod -aG "$group" "$user"
		note "Added $user to the $group group (it counts from the next restart)."
	fi
}

# A panel with a backlight (the Touch Display): the video group may write its brightness and
# bl_power, so the helper needs no sudo. udev runs the rule as each backlight appears; the
# trigger runs it now.
setup_backlight() {
	local rule="$TMP_DIR/backlight.rules"
	{
		header_comment
		printf '# Lets the video group dim the screen and switch its backlight off, for the Sunroom screen helper.\n'
		# shellcheck disable=SC2016 # $sys$devpath is udev's, not the shell's
		printf '%s\n' 'SUBSYSTEM=="backlight", ACTION=="add", RUN+="/bin/chgrp video $sys$devpath/brightness $sys$devpath/bl_power", RUN+="/bin/chmod g+w $sys$devpath/brightness $sys$devpath/bl_power"'
	} >"$rule"
	BACKLIGHT_RULE_WRITTEN=$BACKLIGHT_RULE
	if ! sudo cmp -s "$rule" "$BACKLIGHT_RULE"; then
		sudo install -m 0644 -o root -g root "$rule" "$BACKLIGHT_RULE"
		sudo udevadm control --reload >/dev/null 2>&1 || true
	fi
	sudo udevadm trigger --action=add --subsystem-match=backlight >/dev/null 2>&1 || true
	add_to_group video
	if BACKLIGHT=$(backlight_device); then
		note "The screen helper dims the screen with its backlight ($BACKLIGHT)."
	else
		BACKLIGHT=""
		warn "this Pi has no screen backlight right now (/sys/class/backlight is empty)."
		note "The screen helper looks again each time it starts; until it finds one, the page dims itself."
	fi
}

# A monitor with DDC/CI takes brightness commands over the HDMI cable. ddcutil reaches it
# through /dev/i2c-N, which needs the i2c-dev module (loaded now and at every start) and the
# i2c group. The bus is found once, here, and saved for the helper.
setup_ddc() {
	local conf="$TMP_DIR/i2c.conf" detected
	if ! command -v ddcutil >/dev/null 2>&1; then
		note "Without ddcutil the screen helper can't set the brightness; the page dims itself."
		return 0
	fi
	{
		header_comment
		printf '# Lets ddcutil reach the screen over HDMI (DDC/CI), for the Sunroom screen helper.\n'
		printf 'i2c-dev\n'
	} >"$conf"
	I2C_MODULES_WRITTEN=$I2C_MODULES_FILE
	if ! sudo cmp -s "$conf" "$I2C_MODULES_FILE"; then
		sudo install -m 0644 -o root -g root "$conf" "$I2C_MODULES_FILE"
	fi
	sudo modprobe i2c-dev >/dev/null 2>&1 || true
	add_to_group i2c
	note "Asking the screen whether it takes brightness commands (DDC/CI); this takes a few seconds..."
	detected=$(sudo ddcutil detect --brief 2>&1 || true)
	printf '%s\n' "$detected" >>"$LOG_FILE"
	DDC_BUS=$(python3 "$SRC_DIR/sunroom-screen" --ddc-bus "$OUTPUT" <<<"$detected" 2>>"$LOG_FILE" || true)
	if [[ $DDC_BUS =~ ^[0-9]+$ ]]; then
		note "The screen helper dims the screen over HDMI (DDC/CI, I2C bus $DDC_BUS)."
	else
		DDC_BUS=""
		note "The screen doesn't take brightness commands (DDC/CI), so the page dims itself in the evening."
		note "Many monitors have DDC/CI switched off in their own menu: turn it on there, then run the installer again."
	fi
}

# How the screen helper sets the brightness (--brightness), worked out here and saved in the
# kitchen screen's settings; the helper checks it again each time it starts.
setup_brightness() {
	DDC_BUS=""
	BACKLIGHT=""
	[[ $SCREEN_HELPER == yes ]] || return 0
	case $BRIGHTNESS in
	none) note "The screen helper leaves the brightness alone (--brightness none); the page dims itself." ;;
	sysfs) setup_backlight ;;
	ddc) setup_ddc ;;
	auto)
		if backlight_device >/dev/null; then
			setup_backlight
		else
			setup_ddc
		fi
		;;
	esac
}

# --no-screen-helper after an install that had it: stopping it switches the screen back on.
remove_screen_helper() {
	if [[ -e $UNIT_DIR/sunroom-screen.service || -e $BIN_DIR/sunroom-screen ]]; then
		user_systemctl stop sunroom-screen.service >/dev/null 2>&1 || true
		rm -f "$UNIT_DIR/sunroom-screen.service" "$BIN_DIR/sunroom-screen"
		note "Removed the screen helper (--no-screen-helper); the screen itself now stays on."
	fi
}

setup_kiosk() {
	if ((SWITCH_TO_X11)); then
		note "Switching the desktop to X11, as asked..."
		sudo raspi-config nonint do_wayland W1 || die "Couldn't switch the desktop to X11." \
			"Run the installer without --x11 to keep the standard labwc desktop."
	fi
	sudo raspi-config nonint do_boot_behaviour B4 || die "Couldn't set the Pi to log in to the desktop by itself." \
		"Set it in Raspberry Pi Configuration (System: Auto login), then run the installer again."
	note "The Pi now starts the desktop and logs in by itself."
	if sudo raspi-config nonint do_blanking 1; then
		note "Screen blanking is off."
	else
		warn "couldn't turn off screen blanking; turn it off in Raspberry Pi Configuration (Display)."
	fi
	if [[ $SESSION == wayland ]]; then
		remove_swayidle
	fi
	setup_brightness
	write_kiosk_config
	install_units
	if [[ $SESSION == wayland ]]; then
		write_labwc_autostart
		rm -f "$XDG_AUTOSTART_FILE"
		apply_labwc_settings
	else
		write_xdg_autostart
		remove_labwc_block
	fi
	write_wifi_dropin
	enable_time_wait_sync
	if [[ -n $FORCE_HDMI ]]; then
		apply_force_hdmi
	fi
	if [[ $ROTATE != 0 ]]; then
		note "The picture on $OUTPUT will be turned $ROTATE degrees."
		if [[ $SESSION == wayland ]]; then
			# Unverified: whether touch follows a rotated output on Raspberry Pi OS's labwc;
			# labwc-config(5) says touch rotation needs a libinput calibrationMatrix.
			note "If taps land in the wrong place on the turned screen, see docs/KIOSK.md for the touch fix."
		fi
	fi
	if [[ $SCREEN_HELPER == yes ]]; then
		note "Set the screen's sleep times in Sunroom: Settings → Display → Sleep."
	else
		note "No screen helper (--no-screen-helper): at night the page goes black or dim, and the screen itself stays on." \
			"Set the times in Sunroom: Settings → Display → Sleep."
	fi
}

# ---------------------------------------------------------------------------- step 5: summary

show_qr() {
	if command -v qrencode >/dev/null 2>&1; then
		say ""
		qrencode -t ANSIUTF8 -m 2 "$1" || true
	fi
}

on_sd_card() {
	[[ $(findmnt -no SOURCE / 2>/dev/null || true) == /dev/mmcblk* ]]
}

summary() {
	local host ip phone
	say ""
	case $MODE in
	display)
		say "The kitchen screen is set up. It will show Sunroom from $URL"
		say ""
		say "Next:"
		say "  1. After the restart, the kitchen screen shows a six-character code."
		say "  2. On a phone signed in to Sunroom, open More → Pair a display and type that code."
		say ""
		say "Phones use the same address: $URL"
		say "If the screen stays on the desktop picture, check that this address opens on a phone."
		show_qr "$URL"
		;;
	all | server)
		host=$(pi_hostname)
		ip=$(pi_ip)
		phone="http://$host.local:$PORT"
		say "Sunroom is running on this Pi."
		say ""
		say "On your phone, open:   $phone"
		if [[ -n $ip ]]; then
			say "If that doesn't open:  http://$ip:$PORT"
			say "(Phones on a VPN or on mobile data can't see .local names; use the second address.)"
		fi
		show_qr "$phone"
		say ""
		say "Next:"
		say "  1. Open that address on your phone and follow the setup (about three minutes)."
		if [[ $MODE == all ]]; then
			say "  2. After the restart, the kitchen screen shows a six-character code."
			say "     Type it on your phone under More → Pair a display."
		fi
		say ""
		say "Update Sunroom later with:  sudo /opt/sunroom/update.sh"
		if on_sd_card; then
			say "Tip: Sunroom keeps your family's calendar on this Pi's memory card. A good card (A2) or a"
			say "USB SSD and the official power supply keep it safe; Sunroom also backs up every night."
		fi
		;;
	esac
	if [[ $MODE == server ]]; then
		say "Remove Sunroom and its data with:  bash ~/.local/share/sunroom-kiosk/uninstall.sh --purge"
	else
		say "Remove the kitchen screen setup with:  bash ~/.local/share/sunroom-kiosk/uninstall.sh"
	fi
	say "This install's log:  $(tidy "$LOG_FILE")"
}

offer_reboot() {
	say ""
	if ((NO_REBOOT)); then
		say "Restart the Pi when you're ready (sudo reboot)."
		return 0
	fi
	if [[ $MODE == server ]]; then
		say "A restart is optional; it checks that Sunroom comes back by itself."
	else
		say "A restart turns on the kitchen screen."
	fi
	if ask_yes_no "Reboot now?" y n; then
		say "Restarting now. Give it a minute or two."
		sleep 2
		sudo systemctl reboot
	else
		say "OK. Restart later with: sudo reboot"
	fi
}

# ---------------------------------------------------------------------------- uninstall

run_uninstall() {
	local script="" dir status=0
	VERSION=${VERSION#v}
	if [[ -n $SCRIPT_PATH && -f $SCRIPT_PATH ]]; then
		dir=$(cd "$(dirname "$SCRIPT_PATH")" && pwd)
		if [[ -f $dir/uninstall.sh ]]; then
			script="$dir/uninstall.sh"
		fi
	fi
	if [[ -z $script && -f $SHARE_DIR/uninstall.sh ]]; then
		script="$SHARE_DIR/uninstall.sh"
	fi
	if [[ -z $script ]]; then
		TMP_DIR=$(mktemp -d)
		trap cleanup EXIT
		download_kiosk_files
		script="$SRC_DIR/uninstall.sh"
	fi
	bash "$script" "${UNINSTALL_ARGS[@]}" || status=$?
	exit "$status"
}

# ---------------------------------------------------------------------------- main

print_plan() {
	case $MODE in
	all) say "This sets up Sunroom and the kitchen screen on this Pi. It takes about 10 to 20 minutes." ;;
	display) say "This sets up the kitchen screen on this Pi, showing Sunroom from $URL. It takes a few minutes." ;;
	server) say "This sets up Sunroom on this Pi, without a screen. It takes about 10 minutes." ;;
	esac
}

main() {
	ORIGINAL_ARGS=("$@")
	parse_args "$@"
	refuse_root
	detect_tty
	if ((UNINSTALL)); then
		run_uninstall
	fi
	validate_args
	setup_logging
	trap 'on_error $? $LINENO' ERR
	trap cleanup EXIT
	TMP_DIR=$(mktemp -d)
	load_previous_state
	say "Sunroom installer $KIOSK_VERSION"
	print_plan

	step "Checking this Pi" "checking this Pi"
	start_sudo
	check_platform
	check_disk
	check_internet
	if [[ $MODE == display ]]; then
		check_remote_server
	fi
	if [[ $MODE != server ]]; then
		detect_session
		resolve_output
	fi
	wait_for_apt
	get_kiosk_files
	if [[ $MODE != server ]]; then
		check_screen_helper_files
	fi

	step "Installing what it needs" "installing software"
	install_packages

	if [[ $MODE != display ]]; then
		step "Installing Docker" "installing Docker"
		install_docker
		step "Starting Sunroom" "starting Sunroom"
		write_stack
		start_stack
	fi

	install_helper_copies
	if [[ $MODE != server ]]; then
		step "Setting up the kitchen screen" "setting up the kitchen screen"
		setup_kiosk
	fi
	save_state

	step "All done" "finishing"
	summary
	offer_reboot
}

main "$@"
