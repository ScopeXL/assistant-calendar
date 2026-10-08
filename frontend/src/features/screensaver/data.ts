/**
 * Photos and the screensaver's data (PLAN §11.1 Photos, §11.3 screensaver): what the screensaver
 * shows (its manifest and settings), the household's photos a page at a time, the photo
 * sources, and every change, each with the toast UX §2 names and Undo where it applies.
 * Removing and hiding photos are a parent's (the wall asks for the PIN).
 */
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import { api, errorMessage, unwrap } from "../../api/client";
import type { components } from "../../api/schema";
import { asParent } from "../../lib/parent";
import { showToast } from "../../lib/toast";
import { uploadPicture } from "../../lib/upload";

export type Manifest = components["schemas"]["ManifestOut"];
export type SaverPhoto = components["schemas"]["ManifestPhoto"];
export type PhotoSource = components["schemas"]["SourceOut"];
export type LibraryPhoto = components["schemas"]["PhotoOut"];

export const saverKeys = {
  manifest: () => ["screensaver", "manifest"] as const,
  sources: () => ["screensaver", "sources"] as const,
  library: () => ["photos", "library"] as const,
};

export function useManifest({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: saverKeys.manifest(),
    queryFn: async () => unwrap(await api.GET("/api/screensaver/manifest")),
    staleTime: 5 * 60_000,
    enabled,
  });
}

/** The household's photos, newest first, a page at a time. */
export function useLibrary() {
  return useInfiniteQuery({
    queryKey: saverKeys.library(),
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET("/api/photos", {
          params: { query: { kind: "library", ...(pageParam ? { cursor: pageParam } : {}) } },
        }),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next_cursor,
  });
}

export function useSources({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: saverKeys.sources(),
    queryFn: async () => unwrap(await api.GET("/api/screensaver/sources")),
    enabled,
  });
}

async function refresh(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["photos"] }),
    queryClient.invalidateQueries({ queryKey: ["screensaver"] }),
  ]);
}

const photosText = (count: number) => (count === 1 ? "1 photo" : `${String(count)} photos`);

export function usePhotoChanges() {
  const queryClient = useQueryClient();

  /** Several at once, one after another (memory stays flat on a Pi). */
  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      let added = 0;
      let failed: string | null = null;
      for (const file of files) {
        try {
          await uploadPicture<LibraryPhoto>("/api/photos", "POST", file, null);
          added += 1;
        } catch (error) {
          failed = errorMessage(error);
        }
      }
      return { added, failed };
    },
    onSuccess: async ({ added, failed }) => {
      await refresh(queryClient);
      if (added) showToast(`Added ${photosText(added)}`);
      if (failed) showToast(added ? `Some didn't make it. ${failed}` : failed);
    },
  });

  const restore = async (id: string) => {
    await asParent(async () =>
      unwrap(
        await api.POST("/api/photos/{photo_id}/restore", { params: { path: { photo_id: id } } }),
      ),
    );
    await refresh(queryClient);
  };

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await asParent(async () => {
        unwrap(await api.DELETE("/api/photos/{photo_id}", { params: { path: { photo_id: id } } }));
      });
      return id;
    },
    onSuccess: async (id) => {
      await refresh(queryClient);
      showToast("Removed the photo", {
        label: "Undo",
        onAction: () => {
          void restore(id).catch(() => {
            showToast("Couldn't undo that. It may have changed since.");
          });
        },
      });
    },
  });

  const hide = useMutation({
    mutationFn: async ({ id, hidden }: { id: string; hidden: boolean }) =>
      asParent(async () =>
        unwrap(
          await api.POST("/api/photos/{photo_id}/hide", {
            params: { path: { photo_id: id }, query: { hidden } },
          }),
        ),
      ),
    onSuccess: async (photo) => {
      await refresh(queryClient);
      showToast(photo.hidden ? "Hidden from the screensaver" : "Back on the screensaver", {
        label: "Undo",
        onAction: () => {
          hide.mutate({ id: photo.id, hidden: !photo.hidden });
        },
      });
    },
  });

  /** Start screensaver on the wall, from a phone (PLAN §11.1 kiosk/command). */
  const startOnWall = useMutation({
    mutationFn: async () =>
      asParent(async () => {
        unwrap(await api.POST("/api/kiosk/command", { body: { command: "screensaver" } }));
      }),
    onSuccess: () => {
      showToast("Started the screensaver on the kitchen screen");
    },
  });

  const scan = useMutation({
    mutationFn: async (id: string) =>
      asParent(async () =>
        unwrap(
          await api.POST("/api/screensaver/sources/{source_id}/scan", {
            params: { path: { source_id: id } },
          }),
        ),
      ),
    onSuccess: async (result) => {
      await refresh(queryClient);
      showToast(
        result.imported ? `Added ${photosText(result.imported)}` : "Checked. Nothing new there.",
      );
    },
  });

  const setSource = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) =>
      asParent(async () =>
        unwrap(
          await api.PATCH("/api/screensaver/sources/{source_id}", {
            params: { path: { source_id: id } },
            body: { enabled },
          }),
        ),
      ),
    onSuccess: async (source) => {
      await refresh(queryClient);
      showToast(source.enabled ? `Turned on ${source.label}` : `Turned off ${source.label}`);
    },
  });

  return { upload, remove, hide, startOnWall, scan, setSource };
}
