/**
 * Chores' data (PLAN §11.3, ADR 0025): a day's columns, the week, the chores, stars and rewards,
 * routines, and every change with the toast UX §2 names. On the wall screen a tick or a request
 * says who with X-Sunroom-Member (the column's person, or the "Who did it?" answer); parent
 * things ask for the PIN there (lib/parent).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, asMember, unwrap } from "../../api/client";
import type { components } from "../../api/schema";
import { qk } from "../../api/keys";
import { usePlugins } from "../../lib/household";
import { asParent } from "../../lib/parent";
import { showToast } from "../../lib/toast";

export type Day = components["schemas"]["DayOut"];
export type Column = components["schemas"]["ColumnOut"];
export type Box = components["schemas"]["BoxOut"];
export type Completion = components["schemas"]["CompletionOut"];
export type Stars = components["schemas"]["StarsOut"];
export type RoutineRun = components["schemas"]["RoutineRunOut"];
export type Redemption = components["schemas"]["RedemptionOut"];
export type Waiting = components["schemas"]["WaitingOut"];
export type Week = components["schemas"]["WeekOut"];
export type Chore = components["schemas"]["ChoreOut"];
export type ChoreIn = components["schemas"]["ChoreIn"];
/** A change to a chore: only what's sent changes (the clear_ flags default to false). */
export type ChorePatch = Omit<
  components["schemas"]["ChorePatch"],
  "clear_due_time" | "clear_requires_approval" | "clear_rrule"
> & { clear_due_time?: boolean; clear_requires_approval?: boolean; clear_rrule?: boolean };
export type Reward = components["schemas"]["RewardOut"];
export type Routine = components["schemas"]["RoutineOut"];
export type RoutineIn = components["schemas"]["RoutineIn"];
export type StepIn = components["schemas"]["StepIn"];

const PARENT_CHANGE = "Changing chores on this screen asks for the parent PIN.";
const PARENT_ANSWER = "Only a parent can say yes or no. Enter the parent PIN.";

export function useChoresDay(day: string) {
  return useQuery({
    queryKey: qk.choresDay(day),
    queryFn: async () =>
      unwrap(await api.GET("/api/chores/today", { params: { query: { date: day } } })),
  });
}

export function useChoresWeek(start: string, { enabled = true } = {}) {
  return useQuery({
    queryKey: qk.choresWeek(start),
    queryFn: async () =>
      unwrap(await api.GET("/api/chores/week", { params: { query: { start } } })),
    enabled,
  });
}

export function useChores() {
  return useQuery({
    queryKey: qk.chores(),
    queryFn: async () => unwrap(await api.GET("/api/chores")),
  });
}

export function useRewards({ enabled = true } = {}) {
  return useQuery({
    queryKey: qk.rewards(),
    queryFn: async () => unwrap(await api.GET("/api/chores/rewards")),
    enabled,
  });
}

export function useRoutines(day: string) {
  return useQuery({
    queryKey: qk.routines(day),
    queryFn: async () =>
      unwrap(await api.GET("/api/chores/routines", { params: { query: { date: day } } })),
  });
}

export function useRemovedChores() {
  return useQuery({
    queryKey: qk.choresRemoved(),
    queryFn: async () => unwrap(await api.GET("/api/chores/removed")),
  });
}

export function useChoreChanges() {
  const queryClient = useQueryClient();
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["chores"] });
  };

  const undo = useMutation({
    mutationFn: async ({ box, member }: { box: Box; member: string | null }) => {
      unwrap(
        await api.POST("/api/chores/{chore_id}/undo", {
          params: { path: { chore_id: box.chore_id } },
          body: { due_date: box.due_date, member_id: member },
          ...asMember(member),
        }),
      );
    },
    onSettled: refresh,
  });

  /** Tick a box for `member` (the column's person, or who did it). */
  const complete = useMutation({
    mutationFn: async ({ box, member }: { box: Box; member: string | null; name: string }) =>
      unwrap(
        await api.POST("/api/chores/{chore_id}/complete", {
          params: { path: { chore_id: box.chore_id } },
          body: { due_date: box.due_date, member_id: member },
          ...asMember(member),
        }),
      ),
    onSuccess: (done, { box, member, name }) => {
      showToast(
        done.completion.status === "pending"
          ? `Done by ${name}. A parent will check.`
          : `Done by ${name}`,
        {
          label: "Undo",
          onAction: () => {
            undo.mutate({ box, member });
          },
        },
      );
    },
    onSettled: refresh,
  });

  const answer = useMutation({
    mutationFn: async ({ waiting, yes }: { waiting: Waiting; yes: boolean }) =>
      asParent(
        async () =>
          unwrap(
            yes
              ? await api.POST("/api/chores/completions/{completion_id}/approve", {
                  params: { path: { completion_id: waiting.completion.id } },
                })
              : await api.POST("/api/chores/completions/{completion_id}/reject", {
                  params: { path: { completion_id: waiting.completion.id } },
                }),
          ),
        PARENT_ANSWER,
      ),
    onSuccess: (_data, { waiting, yes }) => {
      showToast(yes ? `${waiting.title}: done` : `${waiting.title}: not done yet`);
    },
    onSettled: refresh,
  });

  const addChore = useMutation({
    mutationFn: async ({ chore, member }: { chore: ChoreIn; member?: string | null }) =>
      unwrap(await api.POST("/api/chores", { body: chore, ...asMember(member) })),
    onSuccess: (chore) => {
      showToast(`Added ${chore.title}`, {
        label: "Undo",
        onAction: () => {
          removeChore.mutate({ chore, quiet: true });
        },
      });
    },
    onSettled: refresh,
  });

  const changeChore = useMutation({
    mutationFn: async ({ chore, change }: { chore: Chore; change: ChorePatch }) =>
      asParent(
        async () =>
          unwrap(
            await api.PATCH("/api/chores/{chore_id}", {
              params: { path: { chore_id: chore.id } },
              body: {
                clear_due_time: false,
                clear_requires_approval: false,
                clear_rrule: false,
                ...change,
              },
            }),
          ),
        PARENT_CHANGE,
      ),
    onSuccess: () => {
      showToast("Changes saved");
    },
    onSettled: refresh,
  });

  const restoreChore = useMutation({
    mutationFn: async ({ choreId }: { choreId: string }) =>
      asParent(
        async () =>
          unwrap(
            await api.POST("/api/chores/{chore_id}/restore", {
              params: { path: { chore_id: choreId } },
            }),
          ),
        PARENT_CHANGE,
      ),
    onSuccess: (chore) => {
      showToast(`Put back ${chore.title}`);
    },
    onSettled: refresh,
  });

  const removeChore = useMutation({
    mutationFn: async ({ chore }: { chore: { id: string; title: string }; quiet?: boolean }) => {
      await asParent(async () => {
        unwrap(
          await api.DELETE("/api/chores/{chore_id}", { params: { path: { chore_id: chore.id } } }),
        );
      }, PARENT_CHANGE);
    },
    onSuccess: (_data, { chore, quiet }) => {
      if (quiet) return;
      showToast(`Removed ${chore.title}`, {
        label: "Undo",
        onAction: () => {
          restoreChore.mutate({ choreId: chore.id });
        },
      });
    },
    onSettled: refresh,
  });

  const unskip = useMutation({
    mutationFn: async ({ choreId, day }: { choreId: string; day: string }) =>
      asParent(
        async () =>
          unwrap(
            await api.POST("/api/chores/{chore_id}/unskip", {
              params: { path: { chore_id: choreId } },
              body: { date: day },
            }),
          ),
        PARENT_CHANGE,
      ),
    onSettled: refresh,
  });

  const skip = useMutation({
    mutationFn: async ({ choreId, day }: { choreId: string; day: string; title: string }) =>
      asParent(
        async () =>
          unwrap(
            await api.POST("/api/chores/{chore_id}/skip", {
              params: { path: { chore_id: choreId } },
              body: { date: day },
            }),
          ),
        PARENT_CHANGE,
      ),
    onSuccess: (_data, { choreId, day, title }) => {
      showToast(`Skipped ${title} today`, {
        label: "Undo",
        onAction: () => {
          unskip.mutate({ choreId, day });
        },
      });
    },
    onSettled: refresh,
  });

  const cancelAsk = useMutation({
    mutationFn: async ({ redemption }: { redemption: Redemption }) =>
      unwrap(
        await api.POST("/api/chores/redemptions/{redemption_id}/cancel", {
          params: { path: { redemption_id: redemption.id } },
          ...asMember(redemption.member_id),
        }),
      ),
    onSettled: refresh,
  });

  const redeem = useMutation({
    mutationFn: async ({ reward, member }: { reward: Reward; member: string; name: string }) =>
      unwrap(
        await api.POST("/api/chores/rewards/{reward_id}/redeem", {
          params: { path: { reward_id: reward.id } },
          body: { member_id: member },
          ...asMember(member),
        }),
      ),
    onSuccess: (redemption, { reward }) => {
      showToast(`Asked for ${reward.title}. A parent will say yes or no.`, {
        label: "Take it back",
        onAction: () => {
          cancelAsk.mutate({ redemption });
        },
      });
    },
    onSettled: refresh,
  });

  const decide = useMutation({
    mutationFn: async ({
      redemption,
      yes,
    }: {
      redemption: Redemption;
      yes: boolean;
      name: string;
    }) =>
      asParent(
        async () =>
          unwrap(
            yes
              ? await api.POST("/api/chores/redemptions/{redemption_id}/approve", {
                  params: { path: { redemption_id: redemption.id } },
                })
              : await api.POST("/api/chores/redemptions/{redemption_id}/deny", {
                  params: { path: { redemption_id: redemption.id } },
                }),
          ),
        PARENT_ANSWER,
      ),
    onSuccess: (_data, { redemption, yes, name }) => {
      showToast(yes ? `${name} got ${redemption.reward_title}` : `Told ${name} not now`);
    },
    onSettled: refresh,
  });

  const saveReward = useMutation({
    mutationFn: async ({
      reward,
      title,
      cost,
    }: {
      reward: Reward | null;
      title: string;
      cost: number;
    }) =>
      asParent(
        async () =>
          unwrap(
            reward
              ? await api.PATCH("/api/chores/rewards/{reward_id}", {
                  params: { path: { reward_id: reward.id } },
                  body: { title, cost_points: cost },
                })
              : await api.POST("/api/chores/rewards", { body: { title, cost_points: cost } }),
          ),
        PARENT_CHANGE,
      ),
    onSuccess: (saved, { reward }) => {
      showToast(reward ? "Changes saved" : `Added ${saved.title}`);
    },
    onSettled: refresh,
  });

  const removeReward = useMutation({
    mutationFn: async ({ reward }: { reward: Reward }) => {
      await asParent(async () => {
        unwrap(
          await api.DELETE("/api/chores/rewards/{reward_id}", {
            params: { path: { reward_id: reward.id } },
          }),
        );
      }, PARENT_CHANGE);
    },
    onSuccess: (_data, { reward }) => {
      showToast(`Removed ${reward.title}`);
    },
    onSettled: refresh,
  });

  const checkStep = useMutation({
    mutationFn: async ({
      run,
      stepId,
      day,
      checked,
    }: {
      run: RoutineRun;
      stepId: string;
      day: string;
      checked: boolean;
    }) =>
      unwrap(
        await api.POST("/api/chores/routines/{routine_id}/steps/{step_id}/check", {
          params: { path: { routine_id: run.routine_id, step_id: stepId } },
          body: { date: day, member_id: run.member_id, checked },
          ...asMember(run.member_id),
        }),
      ),
    onSettled: refresh,
  });

  const finish = useMutation({
    mutationFn: async ({ run, day }: { run: RoutineRun; day: string }) =>
      unwrap(
        await api.POST("/api/chores/routines/{routine_id}/finish", {
          params: { path: { routine_id: run.routine_id } },
          body: { date: day, member_id: run.member_id },
          ...asMember(run.member_id),
        }),
      ),
    onSuccess: (_data, { run }) => {
      showToast(`${run.title} done`);
    },
    onSettled: refresh,
  });

  const saveRoutine = useMutation({
    mutationFn: async ({
      routine,
      fields,
      steps,
    }: {
      routine: Routine | null;
      fields: Omit<RoutineIn, "steps">;
      steps: StepIn[];
    }) =>
      asParent(async () => {
        if (!routine) {
          return unwrap(await api.POST("/api/chores/routines", { body: { ...fields, steps } }));
        }
        unwrap(
          await api.PATCH("/api/chores/routines/{routine_id}", {
            params: { path: { routine_id: routine.id } },
            body: { ...fields, every_kid: fields.member_id === null },
          }),
        );
        return unwrap(
          await api.PUT("/api/chores/routines/{routine_id}/steps", {
            params: { path: { routine_id: routine.id } },
            body: { steps },
          }),
        );
      }, PARENT_CHANGE),
    onSuccess: (saved, { routine }) => {
      showToast(routine ? "Changes saved" : `Added ${saved.title}`);
    },
    onSettled: refresh,
  });

  const removeRoutine = useMutation({
    mutationFn: async ({ routine }: { routine: Routine }) => {
      await asParent(async () => {
        unwrap(
          await api.DELETE("/api/chores/routines/{routine_id}", {
            params: { path: { routine_id: routine.id } },
          }),
        );
      }, PARENT_CHANGE);
    },
    onSuccess: (_data, { routine }) => {
      showToast(`Removed ${routine.title}`);
    },
    onSettled: refresh,
  });

  const adjust = useMutation({
    mutationFn: async ({
      member,
      points,
      reason,
    }: {
      member: string;
      points: number;
      reason: string;
      name: string;
    }) =>
      asParent(
        async () =>
          unwrap(
            await api.POST("/api/chores/points/adjust", {
              body: { member_id: member, points, reason },
            }),
          ),
        PARENT_CHANGE,
      ),
    onSuccess: (_data, { points, name }) => {
      showToast(
        points > 0
          ? `Gave ${name} ${String(points)} ${points === 1 ? "star" : "stars"}`
          : `Took ${String(-points)} ${points === -1 ? "star" : "stars"} from ${name}`,
      );
    },
    onSettled: refresh,
  });

  return {
    complete,
    undo,
    answer,
    addChore,
    changeChore,
    removeChore,
    restoreChore,
    skip,
    unskip,
    redeem,
    cancelAsk,
    decide,
    saveReward,
    removeReward,
    checkStep,
    finish,
    saveRoutine,
    removeRoutine,
    adjust,
  };
}

/** The chores plugin's switches (Settings → Features or Settings → Chores). */
export function useChoreSettings(): {
  stars: boolean;
  rewards: boolean;
  routines: boolean;
  approval: boolean;
} {
  const { data: plugins = [] } = usePlugins();
  const settings = plugins.find((plugin) => plugin.id === "chores")?.settings ?? {};
  return {
    stars: settings.stars !== false,
    rewards: settings.rewards !== false,
    routines: settings.routines !== false,
    approval: settings.approval === true,
  };
}
