# Performance

What Sunroom has to be fast at, how to measure it, and what was measured. Synthetic data only.

## The occurrence endpoint (PLAN §7.3)

Every view of the calendar asks the server for the occurrences in a range of days, and every
change to a calendar empties that calendar's cache. The budget, on a Raspberry Pi 4 running the
server, for one week of 500 events of which 100 repeat:

| | Budget |
|---|---|
| Cold (cache empty, as after a change) | under 100 ms |
| Warm (cached) | under 10 ms |

### How to measure

`sunroom bench occurrences` builds a throwaway database in a temporary folder, fills it with
synthetic events, and prints the median of five runs. It never touches the household's data, so
it's safe to run in the server's own container:

```sh
docker compose exec sunroom sunroom bench occurrences --events 500 --recurring 100 --weeks 1
```

On a Pi without Sunroom installed, the arm64 image runs it on its own:

```sh
docker run --rm scopexl/sunroom:latest bench occurrences --events 500 --recurring 100 --weeks 1
```

From a checkout: `cd backend && uv run sunroom bench occurrences`.

### Results

| Date | Version | Machine | Weeks | Occurrences | Cold | Warm |
|---|---|---|---|---|---|---|
| 2026-10-08 | 0.2.0 (unreleased) | Apple M5 Max laptop | 1 | 281 | 5.0 ms | 0.4 ms |
| 2026-10-08 | 0.2.0 (unreleased) | Apple M5 Max laptop | 5 | 1347 | 29.4 ms | 2.4 ms |
| | | Raspberry Pi 4 | 1 | | not measured yet | |

The Pi row is the one the budget is for. The laptop rows are a reference: a Pi 4 is usually 10
to 20 times slower at this kind of work, which would put a cold week at 50 to 100 ms.

## The recurrence engine (ADR 0023)

Measured on the laptop by the engine's tests and a one-off timing; the test suite fails if the
first line goes over 1 ms.

| What | Time |
|---|---|
| A ten-year-old daily rule, one week | about 21 µs |
| 500 series (100 repeating), one week, parse cache cleared | 1.1 ms median |
| `validate_rrule` / `split` / `describe` | 4 / 6 / 1.4 µs |
| `count_before` on a ten-year-old daily rule (walks from the start) | 1.2 ms |
