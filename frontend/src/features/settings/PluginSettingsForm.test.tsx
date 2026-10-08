import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { components } from "../../api/schema";
import { PluginSettingsForm } from "./PluginSettingsForm";

type Field = components["schemas"]["FieldOut"];

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

afterEach(cleanup);

describe("the generic plugin settings form (PLAN §6.2)", () => {
  it("draws each field from the spec, and never shows a saved secret", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <PluginSettingsForm
          pluginId="sample"
          spec={[
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
          ]}
          values={{ interval: 30, on: true, key: "***", mode: "busy" }}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByLabelText<HTMLInputElement>("How often (minutes)").value).toBe("30");
    expect(screen.getByRole<HTMLInputElement>("switch", { name: /Show it/ }).checked).toBe(true);
    const secret = screen.getByLabelText<HTMLInputElement>("API key");
    expect(secret.value).toBe("");
    expect(secret.type).toBe("password");
    expect(screen.getByText("Saved. Type a new one to replace it.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Busy" }).getAttribute("aria-pressed")).toBe("true");
  });
});
