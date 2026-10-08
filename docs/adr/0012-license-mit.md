# ADR 0012: MIT license

- **Status:** Accepted
- **Date:** 2026-10-07

## Context

- Sunroom is published for other families to run (PLAN §1), and people embed apps like it in their home dashboards.
- Dinner Bell is MIT-licensed (Dinner Bell's ADR 0013), and Sunroom copies its skeleton, `LICENSE` included (ADR 0001).

## Decision

Sunroom is MIT-licensed, the same as Dinner Bell. `LICENSE` carries the MIT text with the owner as the copyright holder.

## Consequences

- Others may deploy, modify and embed it with no copyleft surprises.
- Because anyone may copy it, nothing household-specific may ever be committed. The privacy guardrails come over from Dinner Bell: gitleaks, the private-terms scan, synthetic fixtures (PLAN §14.5).
- The copyright line in `LICENSE` is an intended public identity, so the private-terms scan allows it, as in Dinner Bell.
