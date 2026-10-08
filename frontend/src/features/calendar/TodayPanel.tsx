import { useMinute } from "../../lib/time";

/**
 * The display's Today panel (UX §3): Now, Up next, Later today, Tomorrow, then each enabled
 * plugin's block. Events arrive in M1; until then it says today is clear (UX §8).
 */
export function TodayPanel() {
  useMinute(); // re-render at midnight with the new day
  return (
    <aside aria-label="Today" className="flex flex-col gap-8 overflow-y-auto px-6 py-6">
      <section aria-labelledby="up-next">
        <h2 id="up-next" className="text-d-title font-bold">
          Up next
        </h2>
        <p className="mt-3 text-d-glance font-bold">Nothing on today.</p>
      </section>
    </aside>
  );
}
