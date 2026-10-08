# ADR 0018: Landscape first; the owner's server runs behind the HTTPS proxy and the Pi is the display only

- **Status:** Accepted (the owner's answer to Q3)
- **Date:** 2026-10-07

## Context

- Q3 asked which way the kitchen screen is mounted and where the server runs (PLAN §20).
- Sunroom supports three install paths (PLAN §13.1): (a) everything on one Pi; (b) the server elsewhere, with the Pi as the screen; (c) any computer, with no Pi.
- The owner already runs Dinner Bell in a container on a Portainer host, behind the owner's HTTPS reverse proxy (Dinner Bell's ADR 0003).
- Every milestone is reviewed on the owner's real wall and phone, so the owner's setup is the first one deployed (PLAN §15).

## Decision

- **Orientation: landscape first, portrait supported.** Screens are designed at 1920×1080 first. Portrait (1080×1920) has its own layout (UX §3), its own e2e project and screenshots, and a pass on a real panel in M5 if one is available. Settings → Display can force either orientation; Auto follows the viewport.
- **The owner's deployment is path b:**
  - the container runs on the owner's Portainer host, behind the owner's HTTPS reverse proxy, with `APP_ALLOWED_HOSTS` set to a public proxy name and the proxy listed in `TRUSTED_PROXIES`; Dinner Bell's `docs/DEPLOY.md` steps apply unchanged;
  - the Pi is the display only, installed with `kiosk/install.sh --display-only --url https://<public name>`, and drives a landscape touchscreen in the kitchen.
- **The all-on-one-Pi path stays first-class for other households.** The README shows paths a and b side by side after one question: "Do you already run Docker somewhere at home?" Path a is verified on a spare card when one is available, in M5 at the latest.

## Consequences

- The display reaches the server over HTTPS, so it has a secure context without Chromium's insecure-origin flag, and the service worker and Wake Lock work.
- The proxy makes Google's OAuth web flow usable for the owner from M2 (ADR 0004, ADR 0020).
- The wall depends on the server host and the network. When it can't reach the server, the display keeps showing what it had, with a quiet "Can't reach Sunroom" pill (UX §8).
- The app is reachable from the internet through the proxy, as Dinner Bell is. Setup is finished, or `APP_PASSWORD` set, before the proxy route goes live (PLAN §12.1; §17, risk 10), and the login hardening matters as much as it does there.
- Performance budgets are still measured on a Pi 4 (ADR 0003), so path a stays honest even though the owner doesn't run it every day.
