import { Cloud, CloudMoon, CloudRain, CloudSnow, Moon, Sun } from "lucide-react";
import { describe, expect, it } from "vitest";

import { degrees, highLow, rainChance, sky } from "./sky";

describe("the weather's words", () => {
  it("names the sky from its WMO code, by day and by night", () => {
    expect(sky(0)).toEqual({ icon: Sun, words: "Sunny" });
    expect(sky(0, false)).toEqual({ icon: Moon, words: "Clear" });
    expect(sky(2, false)).toEqual({ icon: CloudMoon, words: "Partly cloudy" });
    expect(sky(3).words).toBe("Cloudy");
    expect(sky(45).words).toBe("Fog");
    expect(sky(53).words).toBe("Drizzle");
    expect(sky(57).words).toBe("Freezing rain");
    expect(sky(63)).toEqual({ icon: CloudRain, words: "Rain" });
    expect(sky(81).words).toBe("Showers");
    expect(sky(75)).toEqual({ icon: CloudSnow, words: "Snow" });
    expect(sky(99).words).toBe("Thunderstorms");
    expect(sky(42)).toEqual({ icon: Cloud, words: "Cloudy" });
  });

  it("writes temperatures and rain plainly", () => {
    expect(degrees(63.6)).toBe("64°");
    expect(degrees(-2.4)).toBe("-2°");
    expect(highLow(70, 52)).toBe("High 70°, low 52°");
    expect(rainChance(20)).toBeNull();
    expect(rainChance(60)).toBe("60%");
    expect(rainChance(null)).toBeNull();
  });
});
