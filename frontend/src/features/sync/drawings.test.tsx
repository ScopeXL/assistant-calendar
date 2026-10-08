import { cleanup, render } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, describe, expect, it } from "vitest";

import {
  GoogleIntegrateArt,
  GoogleSecretAddressArt,
  GoogleSettingsArt,
  HelperCalendarApiArt,
  HelperKeyArt,
  HelperProjectArt,
  HelperServiceAccountArt,
  ICloudCopyPasswordArt,
  ICloudNewPasswordArt,
  ICloudSignInArt,
} from "./drawings";

afterEach(cleanup);

/** Each step's drawing, and the words from its step that it must show. */
const DRAWINGS: [string, ComponentType, string[]][] = [
  ["iCloud: sign in", ICloudSignInArt, ["appleid.apple.com", "Sign in"]],
  [
    "iCloud: a new app-specific password",
    ICloudNewPasswordArt,
    ["Sign-In and Security", "App-Specific Passwords", "Sunroom"],
  ],
  ["iCloud: copy the password", ICloudCopyPasswordArt, ["xxxx-xxxx-xxxx-xxxx", "Copy"]],
  ["Google: settings", GoogleSettingsArt, ["Settings"]],
  [
    "Google: integrate calendar",
    GoogleIntegrateArt,
    ["Settings for my calendars", "Integrate calendar"],
  ],
  ["Google: the secret address", GoogleSecretAddressArt, ["Secret address in iCal format"]],
  ["helper: a project", HelperProjectArt, ["console.cloud.google.com", "Sunroom", "Create"]],
  [
    "helper: the calendar API",
    HelperCalendarApiArt,
    ["APIs & Services", "Google Calendar API", "Enable"],
  ],
  [
    "helper: a service account",
    HelperServiceAccountArt,
    ["IAM & Admin", "Service accounts", "Create", "sunroom"],
  ],
  ["helper: the key", HelperKeyArt, ["Keys", "Add key", "JSON"]],
];

describe("the account steps' drawings", () => {
  it.each(DRAWINGS)("%s: hidden from screen readers, with its words", (_name, Art, words) => {
    const { container } = render(<Art />);
    const drawing = container.firstElementChild;
    expect(drawing?.tagName).toBe("svg");
    // The step's text is what a screen reader reads; the drawing only shows it.
    expect(drawing?.getAttribute("aria-hidden")).toBe("true");
    const shown = [...(drawing?.querySelectorAll("text") ?? [])].map((text) => text.textContent);
    for (const word of words) expect(shown).toContain(word);
  });
});
