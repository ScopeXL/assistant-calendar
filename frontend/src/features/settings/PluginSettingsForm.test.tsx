import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api, notSaved, ApiError } from "../../api/client";
import { qk } from "../../api/keys";
import type { components } from "../../api/schema";
import { toasts } from "../../lib/toast";
import { PluginSettingsForm } from "./PluginSettingsForm";

type Field = components["schemas"]["FieldOut"];
type PluginInfo = components["schemas"]["PluginOut"];

function field(overrides: Partial<Field> & Pick<Field, "key" | "label" | "type">): Field {
  return {
    help: "",
    default: null,
    required: false,
    min: null,
    max: null,
    step: null,
    unit: null,
    group: "",
    choices: null,
    choice_labels: null,
    max_length: null,
    ...overrides,
  };
}

const SPEC = [
  field({ key: "interval", label: "How often", type: "int", unit: "minutes" }),
  field({ key: "on", label: "Show it", type: "bool" }),
  field({ key: "key", label: "API key", type: "secret" }),
  field({
    key: "mode",
    label: "Mode",
    type: "choice",
    choices: ["calm", "busy"],
    choice_labels: ["Calm", "Busy"],
  }),
];
const SAVED = { interval: 30, on: true, key: "***", mode: "busy" };

/** The form over the plugins query, as on the Features page: what it shows is the server's.
 * A refetch (after each save) answers with what the cache holds. */
function Form() {
  const client = useQueryClient();
  const { data: plugins = [] } = useQuery({
    queryKey: qk.plugins(),
    queryFn: () => client.getQueryData<PluginInfo[]>(qk.plugins()) ?? [],
    staleTime: Infinity,
  });
  const plugin = plugins[0];
  return plugin ? (
    <PluginSettingsForm pluginId="sample" spec={SPEC} values={plugin.settings} />
  ) : null;
}

function draw(values: Record<string, unknown> = SAVED) {
  const client = new QueryClient();
  client.setQueryData(qk.plugins(), [{ id: "sample", settings: values }]);
  render(
    <QueryClientProvider client={client}>
      <Form />
    </QueryClientProvider>,
  );
  return { client };
}

/** Stand in for PUT /api/plugins/{id}/settings. */
function serverAnswers(
  answer: (values: Record<string, unknown>) => Record<string, unknown> | ApiError,
) {
  const sent: Record<string, unknown>[] = [];
  const put = vi.spyOn(api, "PUT").mockImplementation(((_path: string, init: unknown) => {
    const values = (init as { body: { values: Record<string, unknown> } }).body.values;
    sent.push(values);
    const result = answer(values);
    if (result instanceof ApiError) {
      return Promise.resolve({
        error: { error: { code: result.code, message: result.message, problems: result.problems } },
        response: new Response(null, { status: result.status }),
      });
    }
    return Promise.resolve({ data: result, response: new Response(null, { status: 200 }) });
  }) as never);
  return { sent, put };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  toasts.set([]);
});

describe("the generic plugin settings form (PLAN §6.2)", () => {
  it("draws each field from the spec, and never shows a saved secret", () => {
    draw();
    expect(screen.getByLabelText<HTMLInputElement>("How often (minutes)").value).toBe("30");
    expect(screen.getByRole<HTMLInputElement>("switch", { name: /Show it/ }).checked).toBe(true);
    const secret = screen.getByLabelText<HTMLInputElement>("API key");
    expect(secret.value).toBe("");
    expect(secret.type).toBe("password");
    expect(screen.getByText("Saved. Type a new one to replace it.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Busy" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("has no Save button: a setting saves itself (ADR 0029)", () => {
    draw();
    expect(screen.queryByRole("button", { name: /save/i })).toBeNull();
  });

  it("draws up to six short choices side by side, and more or longer ones as chips", () => {
    const times = ["Never", "5 min", "15 min", "30 min", "1 hour"];
    const long = ["After a very long while", "After an even longer while"];
    render(
      <QueryClientProvider client={new QueryClient()}>
        <PluginSettingsForm
          pluginId="sample"
          spec={[
            field({ key: "after", label: "Start after", type: "choice", choices: times }),
            field({ key: "when", label: "Clear", type: "choice", choices: long }),
          ]}
          values={{ after: "15 min", when: long[0] }}
        />
      </QueryClientProvider>,
    );
    const side = screen.getByRole("group", { name: "Start after" });
    expect(side.hasAttribute("data-segmented")).toBe(true);
    expect(side.querySelectorAll("button")).toHaveLength(5);
    expect(screen.getByRole("group", { name: "Clear" }).hasAttribute("data-segmented")).toBe(false);
  });

  it("leaves out the groups a plugin draws itself", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <PluginSettingsForm
          pluginId="sample"
          spec={[
            field({ key: "id", label: "Client ID", type: "string", group: "Sign in with Google" }),
            field({ key: "on", label: "Show it", type: "bool" }),
          ]}
          values={{ id: "abc", on: false }}
          skipGroups={["Sign in with Google"]}
        />
      </QueryClientProvider>,
    );
    expect(screen.queryByLabelText("Client ID")).toBeNull();
    expect(screen.getByRole("switch", { name: /Show it/ })).toBeTruthy();
  });
});

describe("settings that save themselves", () => {
  it("saves a switch and a choice the moment they change, with the whole set of values", async () => {
    const { sent } = serverAnswers((values) => values);
    draw();
    fireEvent.click(screen.getByRole("switch", { name: /Show it/ }));
    // The switch moves without waiting for the server's answer.
    await waitFor(() => {
      expect(screen.getByRole<HTMLInputElement>("switch", { name: /Show it/ }).checked).toBe(false);
    });
    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    // The secret goes back masked, which keeps it.
    expect(sent[0]).toEqual({ interval: 30, on: false, key: "***", mode: "busy" });
    fireEvent.click(screen.getByRole("button", { name: "Calm" }));
    await waitFor(() => {
      expect(sent).toHaveLength(2);
    });
    expect(sent[1]?.mode).toBe("calm");
  });

  it("saves a typed field when it's left or on ↵, only if it changed, and says Saved", async () => {
    const { sent } = serverAnswers((values) => ({ ...values, interval: Number(values.interval) }));
    draw();
    const input = screen.getByLabelText<HTMLInputElement>("How often (minutes)");
    // Typing alone saves nothing.
    fireEvent.change(input, { target: { value: "45" } });
    expect(input.value).toBe("45");
    expect(sent).toHaveLength(0);
    fireEvent.blur(input);
    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]?.interval).toBe("45");
    await waitFor(() => {
      expect(screen.getByText("Saved")).toBeTruthy();
    });
    // Leaving it unchanged saves nothing more.
    fireEvent.focus(input);
    fireEvent.blur(input);
    fireEvent.change(input, { target: { value: "60" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      expect(sent).toHaveLength(2);
    });
    expect(sent[1]?.interval).toBe("60");
  });

  it("puts a control back and says why when the server refuses", async () => {
    serverAnswers(() => new ApiError(403, "parent_required", "Ask a parent to change this."));
    draw();
    fireEvent.click(screen.getByRole("switch", { name: /Show it/ }));
    await waitFor(() => {
      expect(toasts.get().map((toast) => toast.message)).toEqual([
        "Not saved — ask a parent to change this.",
      ]);
    });
    await waitFor(() => {
      expect(screen.getByRole<HTMLInputElement>("switch", { name: /Show it/ }).checked).toBe(true);
    });
  });

  it("lists a refused value's problems under the form, and keeps what was typed", async () => {
    serverAnswers(
      () =>
        new ApiError(422, "invalid", "Check these settings.", false, [
          "How often must be at least 1",
        ]),
    );
    draw();
    const input = screen.getByLabelText<HTMLInputElement>("How often (minutes)");
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe("How often must be at least 1");
    });
    expect(input.value).toBe("0");
    // The problem is on the page, so no toast repeats it.
    expect(toasts.get()).toEqual([]);
  });
});

describe("the words for a setting that wasn't saved (UX §2)", () => {
  it("puts the server's sentence after the dash", () => {
    expect(
      notSaved(new ApiError(0, "offline", "You're offline. Try again when you have signal.")),
    ).toBe("Not saved — you're offline. Try again when you have signal.");
    expect(notSaved(new ApiError(422, "invalid", "That time zone isn't one Sunroom knows."))).toBe(
      "Not saved — that time zone isn't one Sunroom knows.",
    );
    // An acronym or "I" keeps its capital.
    expect(notSaved(new ApiError(403, "pin", "PIN needed."))).toBe("Not saved — PIN needed.");
  });
});
