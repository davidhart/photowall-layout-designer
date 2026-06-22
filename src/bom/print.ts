import { buildWallSvg } from "../render/wall";
import type { Project } from "../model/types";
import { fitViewBox } from "../view/viewport";
import { h } from "../ui/dom";
import {
  buildBillOfMaterials,
  type BillOfMaterials,
} from "./aggregate";

// A4 content area aspect (portrait) used to fit the layout reference.
const A4_W = 210;
const A4_H = 297;

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function table(
  headers: string[],
  rows: Array<Array<string | Node>>,
): HTMLElement {
  return h("table", { class: "bom-table" }, [
    h("thead", {}, [h("tr", {}, headers.map((t) => h("th", { text: t })))]),
    h(
      "tbody",
      {},
      rows.map((cells) =>
        h("tr", {}, cells.map((c) => h("td", {}, [c]))),
      ),
    ),
  ]);
}

function buildLayoutPage(project: Project): HTMLElement {
  const viewBox = fitViewBox(project.wall, A4_W, A4_H);
  const svg = buildWallSvg(project, viewBox, new Set());
  svg.removeAttribute("class");
  const holder = h("div", { class: "bom-layout" }, [svg]);
  return h("section", { class: "bom-page" }, [
    h("h1", { text: "Photo Wall — Layout Reference" }),
    holder,
  ]);
}

function buildMaterialsPage(bom: BillOfMaterials): HTMLElement {
  const printRows = bom.prints.map((p) => [
    h("img", { class: "bom-thumb", src: p.thumbnailDataUrl, alt: p.name }),
    p.name,
    `${fmt(p.width)} × ${fmt(p.height)} cm`,
    String(p.quantity),
  ]);
  const frameRows = bom.frames.map((f) => [
    f.label,
    `${fmt(f.width)} × ${fmt(f.height)} cm`,
    String(f.quantity),
  ]);
  const ppRows = bom.passpartouts.map((p) => [
    p.label,
    `${fmt(p.width)} × ${fmt(p.height)} cm`,
    String(p.quantity),
  ]);

  const sections: Node[] = [
    h("h1", { text: "Materials List" }),
    h("h2", { text: "Photos to print" }),
    bom.prints.length
      ? table(["Thumbnail", "Photo", "Print size", "Qty"], printRows)
      : h("p", { class: "hint", text: "No photos to print." }),
    h("h2", { text: "Frames to buy" }),
    bom.frames.length
      ? table(["Frame size", "Aperture", "Qty"], frameRows)
      : h("p", { class: "hint", text: "No frames." }),
  ];
  if (bom.passpartouts.length) {
    sections.push(
      h("h2", { text: "Passpartouts" }),
      table(["Passpartout", "Inner window", "Qty"], ppRows),
    );
  }
  return h("section", { class: "bom-page" }, sections);
}

/**
 * Opens a print-styled Bill of Materials overlay (two A4 pages: layout
 * reference + materials list) with Print and Close controls. Print uses the
 * browser's native print / save-as-PDF; Close restores the app view.
 */
export function generateBillOfMaterials(project: Project): void {
  const bom = buildBillOfMaterials(project);

  const overlay = h("div", { class: "bom-overlay" });
  const close = (): void => overlay.remove();

  const toolbar = h("div", { class: "bom-toolbar" }, [
    h("button", { type: "button", text: "Print / Save PDF", onclick: () => window.print() }),
    h("button", { type: "button", text: "Close", onclick: close }),
  ]);

  overlay.append(toolbar, buildLayoutPage(project), buildMaterialsPage(bom));
  document.body.appendChild(overlay);
}
