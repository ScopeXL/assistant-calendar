/**
 * Countdowns' data (PLAN §11.3): what's coming up (countdowns and birthdays), the countdowns
 * themselves, the removed ones, and every change with the toast UX §2 names and Undo. On the
 * wall screen a new countdown says who made it when someone tapped their avatar first.
 */
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { api, asMember, unwrap } from "../../api/client";
import type { components } from "../../api/schema";
import { showToast } from "../../lib/toast";

export type Upcoming = components["schemas"]["UpcomingOut"];
export type Countdown = components["schemas"]["CountdownOut"];
export type CountdownIn = components["schemas"]["CountdownIn"];
/** A change: only what's sent changes (the clear_ flags default to false). */
export type CountdownPatch = Omit<
  components["schemas"]["CountdownPatch"],
  "clear_color" | "clear_time" | "clear_member"
> & { clear_color?: boolean; clear_time?: boolean; clear_member?: boolean };

export const countdownKeys = {
  upcoming: (limit: number | null) => ["countdowns", "upcoming", limit] as const,
  all: () => ["countdowns", "all"] as const,
  removed: () => ["countdowns", "removed"] as const,
};

/** Soonest first: countdowns and birthdays; `limit` for the Today panel's three. */
export function useUpcoming(limit: number | null = null) {
  return useQuery({
    queryKey: countdownKeys.upcoming(limit),
    queryFn: async () =>
      unwrap(
        await api.GET("/api/countdowns/upcoming", {
          params: { query: limit ? { limit } : {} },
        }),
      ),
  });
}

export function useCountdowns() {
  return useQuery({
    queryKey: countdownKeys.all(),
    queryFn: async () => unwrap(await api.GET("/api/countdowns")),
  });
}

export function useRemovedCountdowns() {
  return useQuery({
    queryKey: countdownKeys.removed(),
    queryFn: async () => unwrap(await api.GET("/api/countdowns/removed")),
  });
}

async function refresh(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["countdowns"] }),
    queryClient.invalidateQueries({ queryKey: ["occurrences"] }),
  ]);
}

export function useCountdownChanges() {
  const queryClient = useQueryClient();

  const restoreNow = async (id: string) => {
    unwrap(
      await api.POST("/api/countdowns/{countdown_id}/restore", {
        params: { path: { countdown_id: id } },
      }),
    );
    await refresh(queryClient);
  };

  const add = useMutation({
    mutationFn: async ({ body, member }: { body: CountdownIn; member?: string | null }) =>
      unwrap(await api.POST("/api/countdowns", { body, ...asMember(member) })),
    onSuccess: async (countdown) => {
      await refresh(queryClient);
      showToast(`Added ${countdown.title}`, {
        label: "Undo",
        onAction: () => {
          remove.mutate({ countdown, quiet: true });
        },
      });
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: CountdownPatch }) =>
      unwrap(
        await api.PATCH("/api/countdowns/{countdown_id}", {
          params: { path: { countdown_id: id } },
          body: { clear_color: false, clear_time: false, clear_member: false, ...patch },
        }),
      ),
    onSuccess: async (countdown) => {
      await refresh(queryClient);
      showToast(`Saved ${countdown.title}`);
    },
  });

  const remove = useMutation({
    mutationFn: async ({ countdown }: { countdown: Countdown; quiet?: boolean }) => {
      unwrap(
        await api.DELETE("/api/countdowns/{countdown_id}", {
          params: { path: { countdown_id: countdown.id } },
        }),
      );
    },
    onSuccess: async (_done, { countdown, quiet }) => {
      await refresh(queryClient);
      if (quiet) return;
      showToast(`Removed ${countdown.title}`, {
        label: "Undo",
        onAction: () => {
          void restoreNow(countdown.id).catch(() => {
            showToast("Couldn't undo that. It may have changed since.");
          });
        },
      });
    },
  });

  const restore = useMutation({
    mutationFn: async ({ id }: { id: string; title: string }) => {
      await restoreNow(id);
    },
    onSuccess: (_done, { title }) => {
      showToast(`Put back ${title}`);
    },
  });

  return { add, update, remove, restore };
}
