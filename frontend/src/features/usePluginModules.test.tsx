import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { qk } from "../api/keys";
import { usePluginRooms } from "./usePluginModules";

/** The rail's part: the rooms, and every list of them it was ever drawn with. */
function Rooms({ drawn }: { drawn: string[][] }) {
  const rooms = usePluginRooms();
  drawn.push(rooms.map((room) => room.label));
  return (
    <ul>
      {rooms.map((room) => (
        <li key={room.key}>{room.label}</li>
      ))}
    </ul>
  );
}

const listed = (...on: string[]) =>
  ["lists", "meals", "countdowns"].map((id) => ({ id, enabled: on.includes(id) }));

afterEach(cleanup);

describe("the plugins' rooms (PLAN §6.5)", () => {
  it("keeps the rooms it had while a plugin is switched off or on, never an empty rail", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    client.setQueryData(qk.plugins(), listed("lists", "meals"));
    const drawn: string[][] = [];
    render(
      <QueryClientProvider client={client}>
        <Rooms drawn={drawn} />
      </QueryClientProvider>,
    );
    await waitFor(() => {
      expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
        "Lists",
        "Meals",
      ]);
    });
    // A parent's phone turns Meals off, then Countdowns on: the list of plugins changes.
    drawn.length = 0;
    act(() => {
      client.setQueryData(qk.plugins(), listed("lists"));
    });
    await waitFor(() => {
      expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Lists"]);
    });
    act(() => {
      client.setQueryData(qk.plugins(), listed("lists", "countdowns"));
    });
    await waitFor(() => {
      expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
        "Lists",
        "Countdowns",
      ]);
    });
    // In between, the rail showed what it had: Lists never left it.
    expect(drawn.length).toBeGreaterThan(1);
    expect(drawn.every((rooms) => rooms.includes("Lists"))).toBe(true);
  });
});
