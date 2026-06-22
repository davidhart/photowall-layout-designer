export const SVG_NS = "http://www.w3.org/2000/svg";
export const XLINK_NS = "http://www.w3.org/1999/xlink";

export type SvgAttrs = Record<string, string | number>;

/** Creates an SVG element with the given attributes. */
export function svgEl<K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: SvgAttrs = {},
  children: SVGElement[] = [],
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, String(value));
  }
  for (const child of children) node.appendChild(child);
  return node;
}

/** Sets an image href (modern + xlink for broad compatibility). */
export function setHref(image: SVGImageElement, href: string): void {
  image.setAttribute("href", href);
  image.setAttributeNS(XLINK_NS, "xlink:href", href);
}
