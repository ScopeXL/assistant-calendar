# shellcheck shell=bash disable=SC2034 # sourced: the scripts that source it use these names
# Shared by smoke_image.sh, image_build.sh and image_verify.sh (sourced, not run).
# Docker comes from OrbStack; its CLI may not be on PATH in every shell.
export PATH="$HOME/.orbstack/bin:$PATH"
IMAGE="scopexl/sunroom"
BUILDER="orbstack"
CSRF=(-H "X-Sunroom: 1")

# image_args REF: sets V (version at REF) and ARGS (buildx arguments) from the commit itself.
image_args() {
  local ref="$1"
  V="$(git show "$ref:VERSION" | tr -d '[:space:]')"
  local rev epoch created
  rev="$(git rev-parse "$ref^{commit}")"
  epoch="$(git log -1 --format=%ct "$ref")"
  created="$(TZ=UTC git log -1 --date=format-local:%Y-%m-%dT%H:%M:%SZ --format=%cd "$ref")"
  ARGS=(--builder "$BUILDER" --build-arg "VERSION=$V" --build-arg "REVISION=$rev"
        --build-arg "CREATED=$created" --build-arg "SOURCE_DATE_EPOCH=$epoch")
}

# wait_healthy NAME SECONDS: wait for the container's HEALTHCHECK to pass.
wait_healthy() {
  local name="$1" limit="$2" status
  for _ in $(seq 1 "$limit"); do
    status="$(docker inspect -f '{{.State.Health.Status}}' "$name" 2>/dev/null || echo missing)"
    [ "$status" = "healthy" ] && return 0
    [ "$(docker inspect -f '{{.State.Running}}' "$name" 2>/dev/null)" = "false" ] && break
    sleep 1
  done
  echo "container $name did not become healthy (status: $status)" >&2
  docker logs --tail 40 "$name" >&2 || true
  return 1
}

# fail MESSAGE: print it and stop.
fail() {
  echo "$1" >&2
  exit 1
}

# probe PORT VERSION: the checks every image must pass, before and after setup.
probe() {
  local base="http://127.0.0.1:$1" version="$2"
  curl -fsS "$base/api/health" | grep -q '"ok"' || fail "health didn't answer ok"
  [ "$(curl -fsS "$base/api/version" | jq -r .version)" = "$version" ] || fail "wrong version"
  curl -fsS "$base/some/deep/link" | grep -q 'id="root"' || fail "a deep link didn't get the app"
  [ "$(curl -so /dev/null -w '%{http_code}' "$base/api/nope")" = 404 ] || fail "/api/nope wasn't 404"
  [ "$(curl -so /dev/null -w '%{http_code}' "$base/assets/missing-123.js")" = 404 ] \
    || fail "a missing asset wasn't 404"
  curl -fsS -D - -o /dev/null "$base/" | grep -qi 'content-security-policy' || fail "no CSP header"
  # The Host rule (ADR 0017) and the CSRF header.
  [ "$(curl -so /dev/null -w '%{http_code}' -H 'Host: evil.example' "$base/api/health")" = 421 ] \
    || fail "an unknown Host wasn't refused with 421"
  [ "$(curl -so /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
      -d '{}' "$base/api/auth/login")" = 403 ] || fail "a change without X-Sunroom wasn't refused"
}

# set_up PORT JAR: finish setup through the API as a phone would, keeping the cookie in JAR,
# then check that the plugins that ship are on and running (synced calendars since M2), and
# that the export lists every exported table.
set_up() {
  local base="http://127.0.0.1:$1" jar="$2" status
  [ "$(curl -fsS "$base/api/setup/status" | jq -r .setup_complete)" = false ] \
    || fail "a fresh volume says setup is complete"
  status="$(curl -s -o /dev/null -w '%{http_code}' -c "$jar" "${CSRF[@]}" \
    -H 'Content-Type: application/json' \
    -d '{"password":"smoke-password-0000","household_name":"Smoke Test Home","timezone":"Etc/UTC"}' \
    "$base/api/setup")"
  [ "$status" = 201 ] || fail "setup through the API answered $status"
  [ "$(curl -fsS "$base/api/setup/status" | jq -r .setup_complete)" = true ] \
    || fail "setup didn't stick"
  [ "$(curl -fsS -b "$jar" "$base/api/plugins" | jq -r '[.[] | "\(.id):\(.status)"] | join(",")')" \
    = "calendar_sync:running" ] || fail "synced calendars aren't on and running"
  [ "$(curl -fsS -b "$jar" "$base/api/export" | jq -r '.data | keys | join(",")')" \
    = "calendars,event_members,event_reminders,events,household,kiosk_panels,members,network_allowlist,photos,plugin_state,remote_calendars,sync_accounts" ] \
    || fail "the export doesn't list every exported table"
}

# timeout_wait NAME SECONDS: print the exit code once the container stops, or "running".
timeout_wait() {
  local name="$1" limit="$2"
  for _ in $(seq 1 "$limit"); do
    if [ "$(docker inspect -f '{{.State.Running}}' "$name")" = "false" ]; then
      docker inspect -f '{{.State.ExitCode}}' "$name"
      return 0
    fi
    sleep 1
  done
  echo running
}
