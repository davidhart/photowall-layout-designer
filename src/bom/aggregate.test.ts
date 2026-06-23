import { describe, expect, it } from "vitest";
import { defaultProject } from "../model/defaults";
import type { Frame, Photo } from "../model/types";
import { buildBillOfMaterials } from "./aggregate";

function frame(id: string, overrides: Partial<Frame> = {}): Frame {
  return {
    id,
    x: 0,
    y: 0,
    aperture: { width: 21, height: 29.7 },
    standardSizeId: "A4",
    thickness: 1,
    passpartout: null,
    color: "#000",
    rotation: 0,
    photoId: null,
    ...overrides,
  };
}

function photo(id: string): Photo {
  return {
    id,
    name: `${id}.jpg`,
    dataUrl: "data:,full",
    thumbnailDataUrl: "data:,thumb",
    pixelWidth: 2100,
    pixelHeight: 2970,
  };
}

describe("buildBillOfMaterials", () => {
  it("counts frames per size", () => {
    const p = defaultProject();
    p.frames.push(frame("a"), frame("b"), frame("c", { standardSizeId: "A3", aperture: { width: 29.7, height: 42 } }));
    const bom = buildBillOfMaterials(p);
    const a4 = bom.frames.find((f) => f.label === "A4");
    const a3 = bom.frames.find((f) => f.label === "A3");
    expect(a4?.quantity).toBe(2);
    expect(a3?.quantity).toBe(1);
  });

  it("labels custom frames by their aperture", () => {
    const p = defaultProject();
    p.frames.push(frame("a", { standardSizeId: null, aperture: { width: 30, height: 20 } }));
    const bom = buildBillOfMaterials(p);
    expect(bom.frames[0]?.label).toBe("Custom 30×20 cm");
  });

  it("lists photos to print at the effective print size, grouped + counted", () => {
    const p = defaultProject();
    p.photos.push(photo("p1"));
    p.frames.push(frame("a", { photoId: "p1" }), frame("b", { photoId: "p1" }));
    const bom = buildBillOfMaterials(p);
    expect(bom.prints).toHaveLength(1);
    expect(bom.prints[0]?.quantity).toBe(2);
    expect(bom.prints[0]).toMatchObject({
      width: 21,
      height: 29.7,
      sizeName: "A4",
    });
  });

  it("uses passpartout inner window as the print size and counts passpartouts", () => {
    const p = defaultProject();
    p.photos.push(photo("p1"));
    p.frames.push(
      frame("a", {
        photoId: "p1",
        passpartout: { id: "A5", name: "A5", width: 14.8, height: 21 },
      }),
    );
    const bom = buildBillOfMaterials(p);
    expect(bom.prints[0]).toMatchObject({
      width: 14.8,
      height: 21,
      sizeName: "A5",
    });
    expect(bom.passpartouts[0]).toMatchObject({ label: "A5", quantity: 1 });
  });

  it("leaves sizeName null for custom-aperture and custom-passpartout prints", () => {
    const p = defaultProject();
    p.photos.push(photo("p1"), photo("p2"));
    p.frames.push(
      frame("a", {
        photoId: "p1",
        standardSizeId: null,
        aperture: { width: 25, height: 35 },
      }),
      frame("b", {
        photoId: "p2",
        passpartout: {
          id: "custom:14.8x21",
          name: "14.8×21",
          width: 14.8,
          height: 21,
        },
      }),
    );
    const bom = buildBillOfMaterials(p);
    expect(bom.prints.find((x) => x.photoId === "p1")?.sizeName).toBeNull();
    expect(bom.prints.find((x) => x.photoId === "p2")?.sizeName).toBeNull();
  });

  it("ignores empty frames for the print list", () => {
    const p = defaultProject();
    p.frames.push(frame("a"));
    expect(buildBillOfMaterials(p).prints).toHaveLength(0);
  });
});
