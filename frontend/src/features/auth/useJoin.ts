import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { api, unwrap } from "../../api/client";
import { qk } from "../../api/keys";
import { rememberSignedIn } from "../../lib/session";

/** Sign this phone in with a code from a signed-in one (Settings → Phones & screens → Add a
 * phone). */
export function useJoinWithCode() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (code: string) =>
      unwrap(await api.POST("/api/auth/join", { body: { code } })),
    onSuccess: async (session) => {
      rememberSignedIn(true);
      queryClient.setQueryData(qk.session(), session);
      await navigate({ to: session.member ? "/" : "/who" });
    },
  });
}
