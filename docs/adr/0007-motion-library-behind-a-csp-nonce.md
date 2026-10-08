# ADR 0007: The `motion` library is allowed, behind a per-request CSP style nonce

- **Status:** Accepted (the owner's answer to Q2)
- **Date:** 2026-10-07

## Context

- Rich, physical animation is a core requirement of this app: chips that arrive and leave, a week that follows the finger, a chip that lifts and drops, the Done stamp and burst ([UX §9](../UX.md#9-motion-spec)).
- Dinner Bell's ADR 0027 made motion CSS only: no animation library, no `style={}`, no `element.animate()`. Its ADR 0023 says no dependency may inject styles at runtime, because the strict CSP (`style-src 'self'`) blocks them and the e2e tests fail on any CSP violation.
- `motion` gives layout, exit, gesture and spring animation in a few lines. It does insert `<style>` blocks on some paths; that is what its `nonce` option is for. Under a strict CSP the nonce is required, not optional.
- Q2 asked whether to use `motion` behind a nonce or keep Dinner Bell's CSS-only rule. The owner chose `motion` (PLAN §20).

## Decision

- **JavaScript motion is allowed:** the `motion` library (version 13), the Web Animations API, and a canvas layer for celebrations. This revisits Dinner Bell's ADR 0027 for Sunroom only.
- **The CSP stays strict, with a per-request style nonce:**
  1. Every response from the SPA route (any GET answered with `index.html`) gets a fresh random nonce.
  2. The server stamps it into that copy of `index.html` as `<meta name="csp-nonce" content="…">`, and into the same response's header as `Content-Security-Policy: … style-src 'self' 'nonce-…'`.
  3. At startup the app reads the meta tag and passes the value to `<MotionConfig nonce={…} reducedMotion="user">` at the root, so every `<style>` block `motion` inserts carries it.
- **Who animates what** (UX §9). State toggles (presses, selection, sheets and panels, toasts, the list strike, crossfades, the PIN shake, placeholders) stay CSS in `styles/motion.css`. Moves between layouts and anything that follows a finger use `motion`. The bursts are a canvas layer.
- **Dinner Bell's ADR 0023 rule holds for everything else:** no other dependency may inject styles. `style={}` is allowed: React applies it through the CSSOM, which `style-src` doesn't govern. What `style-src` blocks is `<style>` elements and `style` attributes in markup.
- **The e2e CSP guard stays on.** M0's verify line requires it to pass with a `motion` animation on screen.
- **Fallback.** If the nonce can't be made to work, motion falls back to CSS plus the Web Animations API, recorded in a new ADR (PLAN §17, risk 8).

## Consequences

- `index.html` is no longer a static file. The server stamps every copy it sends, `/index.html` requested by name included, and still serves it `no-cache` (PLAN §5.1).
- The service worker comes from Dinner Bell, whose navigation fallback answers with the `index.html` it cached at install. If Sunroom keeps that fallback, the nonce on a device with the service worker is per install rather than per request, and the cached copy must still pair a matching meta tag and header.
- The design-rules test bans raw hex and runtime style injection, and fails any `motion` use outside `MotionConfig` (PLAN §14.6).
- `reducedMotion="user"` follows only the operating system. The display's own "Reduce motion" setting must switch `motion` to always reduce as well as turning off the CSS transitions (UX §7).
- Animations stay on transforms and opacity, so the week board holds up on a Pi 4 (PLAN §17, risk 4). The burst library, `canvas-confetti` or a small one written here, is chosen in M3 by bundle size.
- Dinner Bell's other motion rules carry over: nothing animates on first paint or a room switch, and sheets don't use `overlay` or `allow-discrete` for their exit, because Safari doesn't support `overlay`.
