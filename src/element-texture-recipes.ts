/** Reviewed categorical patterns. Custom design, not a universal element standard.
 * Grid FACES have area 81 screen units² at scale 1; ink coverage is not equalized.
 * No lighting, geometry, palette or random state is consulted here.
 */
export interface ElementTextureRecipe {
  readonly key: string;
  readonly width: number;
  readonly height: number;
  readonly angle: number;
  readonly body: string;
}
type Family = readonly [number, number, number];
const recipe = (key: string, width: number, height: number, angle: number, body: string): ElementTextureRecipe =>
  Object.freeze({ key, width, height, angle, body });
const strokes = (body: string, width = .55): string =>
  `<g fill="none" stroke="#161616" stroke-width="${width}" stroke-linecap="butt" stroke-linejoin="round">${body}</g>`;
const line = (key: string, angle = 0): ElementTextureRecipe =>
  recipe(key, 7, 7, angle, strokes('<path d="M0 3.5H7"/>'));
const wave = (key: string, angle = 0): ElementTextureRecipe =>
  recipe(key, 12, 12, angle, strokes('<path d="M0 6Q3 0 6 6T12 6"/>'));
const doubleLine = (key: string, angle = 0): ElementTextureRecipe =>
  recipe(key, 10, 10, angle, strokes('<path d="M0 3H10M0 6H10"/>'));

/** Continuous lattice: a*x + b*y = k*d. Include both tile edges so strokes
 * crossing a boundary retain both half-widths. Integer tile periods avoid seams. */
function lattice(key: string, width: number, height: number, families: readonly Family[], angle = 0, ink = .55): ElementTextureRecipe {
  const paths: string[] = [];
  for (const [a, b, d] of families) {
    const max = Math.ceil((Math.abs(a) * width * 3 + Math.abs(b) * height * 3) / d) + 2;
    for (let k = -max; k <= max; k++) {
      if (!b) paths.push(`M${k * d / a} ${-height}L${k * d / a} ${2 * height}`);
      else paths.push(`M${-width} ${(k * d + a * width) / b}L${2 * width} ${(k * d - a * 2 * width) / b}`);
    }
  }
  return recipe(key, width, height, angle, strokes(`<path d="${paths.join('')}"/>`, ink));
}
const short = Math.sqrt(27), long = 3 * short;
function rectangle(key: string, width: number, height: number, angle = 0, ink = .55): ElementTextureRecipe {
  return lattice(key, width, height, [[1, 0, width], [0, 1, height]], angle, ink);
}
function brick(key: string, angle: number): ElementTextureRecipe {
  const w = long, h = 2 * short;
  const body = `<path d="M0 0H${w}M0 ${h / 2}H${w}M0 ${h}H${w}M${w / 4} 0V${h / 2}M${3 * w / 4} ${h / 2}V${h}"/>`;
  return recipe(key, w, h, angle, strokes(body));
}
const diamondHeight = Math.sqrt(54), diamondWidth = 3 * diamondHeight;
const triangleSide = Math.sqrt(324 / Math.sqrt(3)), triangleHeight = triangleSide * Math.sqrt(3);
const approved: Readonly<Record<string, ElementTextureRecipe>> = Object.freeze({
  H: recipe('blank', 6, 6, 0, ''),
  C: rectangle('crosshatch', 9, 9, 45),
  O: line('diagonal-hatch', 45),
  N: line('horizontal-lines'),
  S: recipe('dots', 6, 6, 0, '<circle cx="3" cy="3" r="1.15" fill="#161616"/>'),
  P: line('vertical-lines', 90),
  F: wave('horizontal-waves'),
  Cl: wave('vertical-waves', 90),
  Br: wave('diagonal-waves', 45),
  I: doubleLine('double-horizontal-lines'),
  B: rectangle('horizontal-rectangle-grid', long, short),
  Si: rectangle('square-grid', 9, 9),
  Se: lattice('rhombus-grid', diamondWidth, diamondHeight, [[-1 / 3, 1, diamondHeight], [1 / 3, 1, diamondHeight]]),
  Li: rectangle('vertical-rectangle-grid', short, long),
  Na: doubleLine('double-vertical-lines', 90),
  K: lattice('triangle-grid', triangleSide, triangleHeight, [[0, 1, triangleHeight / 2], [Math.sqrt(3), 1, triangleHeight], [-Math.sqrt(3), 1, triangleHeight]]),
  Mg: doubleLine('double-diagonal-lines', 45),
  Ca: brick('vertical-brickwork', 90),
  Al: brick('horizontal-brickwork', 0)
});
/** Other supported elements retain the older deterministic fallback recipes. */
export function approvedElementRecipe(element: string): ElementTextureRecipe | undefined {
  return Object.hasOwn(approved, element) ? approved[element] : undefined;
}
