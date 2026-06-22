import { describe, expect, it } from "vitest";
import { defaultPasspartoutOptions } from "./geometry";
import { reconcilePasspartoutOptions, sizeToPasspartout } from "./settings";
import { defaultStandardSizes } from "./sizes";
import type { StandardSize } from "./types";

describe("reconcilePasspartoutOptions", () => {
  const sizes = defaultStandardSizes();

  it("keeps existing customized entries for surviving sizes", () => {
    const existing = { A3: [] as never[] }; // user cleared A3's options
    const out = reconcilePasspartoutOptions(sizes, {
      ...defaultPasspartoutOptions(sizes),
      ...existing,
    });
    expect(out["A3"]).toEqual([]);
  });

  it("seeds a new size with its default smaller-size options", () => {
    const extended: StandardSize[] = [
      ...sizes,
      { id: "B0", name: "Big", width: 90, height: 130 },
    ];
    const out = reconcilePasspartoutOptions(extended, defaultPasspartoutOptions(sizes));
    // B0 is larger than all A-series, so it offers them all
    expect(out["B0"]?.length).toBe(sizes.length);
  });

  it("drops entries for removed sizes", () => {
    const fewer = sizes.filter((s) => s.id !== "A6");
    const out = reconcilePasspartoutOptions(fewer, defaultPasspartoutOptions(sizes));
    expect(out["A6"]).toBeUndefined();
    expect(Object.keys(out)).toHaveLength(fewer.length);
  });
});

describe("sizeToPasspartout", () => {
  it("maps a standard size to a passpartout option", () => {
    expect(sizeToPasspartout({ id: "A4", name: "A4", width: 21, height: 29.7 })).toEqual({
      id: "A4",
      name: "A4",
      width: 21,
      height: 29.7,
    });
  });
});
