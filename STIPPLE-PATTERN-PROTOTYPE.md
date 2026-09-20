# Optional offline periodic stipple prototype

This is an **experiment only**, not a new rendering mode or a production/UI change. Nothing imports this script from the library or app. It does not modify source, build configuration, tests, or distribution files.

## Run

From the repository root, with an existing `dist/molplotter.mjs`:

```sh
node scripts/prototype-stipple-pattern.mjs
node scripts/prototype-stipple-pattern.mjs sphere
node scripts/prototype-stipple-pattern.mjs c60
```

Default model: ethanol. No dependencies, browser automation, image libraries, screenshots, network requests, or build step are involved. Run again after a parent build to compare the updated distribution. The manifest records the exact distribution SHA-256; each run overwrites only that model's experimental outputs.

Outputs under `experiments/stipple-pattern/`, with `<model>` equal to `ethanol`, `sphere`, or `c60`:

- `<model>-comparison.html`: standalone offline side-by-side comparison with embedded SVGs.
- `<model>-stipple.svg`: existing non-repeating stipple reference.
- `<model>-halftone.svg`: original halftone reference, showing the geometry reused.
- `<model>-tile-12.svg` and `<model>-tile-24.svg`: periodic random-dot alternatives.
- `<model>-manifest.json`: inputs, distribution fingerprint, SVG sizes, and per-level expected versus realized point counts (not measured coverage).

All panels use the same default camera, **scene scale**, 900 × 700 viewBox, white backgrounds, and `#161616` ink. `quality: 'export'`, `textureScale: 1`, `colorWash: false`, and `castShadows: false` are explicit. Responsive HTML panels scale all SVGs equally; standalone SVGs retain native dimensions. There are no opacity attributes, raster images, or SVG filters. Reference SVGs are unmodified render results except for namespacing their IDs and references.

## Construction

The script imports the existing distribution and renders **halftone** to obtain its geometric tone clips, visible-surface clips, silhouettes, outlines, and backgrounds. It replaces only `<pattern>` definitions, inserting shared dot groups into the same `<defs>`. An internal assertion checks that all content outside those definitions is byte-for-byte unchanged before ID namespacing. The halftone pattern's alignment and rotation are retained.

Each tile uses equal-radius black circles with **r = 0.3 SVG units** at textureScale 1, matching the current default stipple mark size. Tiles have side lengths 12 and 24 SVG units. Each tile realization is seeded deterministically; the same random stream seed is used for both sizes, but each size has its own process. All tone levels **within one tile** are subsets of that single process; they are not independently randomized.

This is a homogeneous **Poisson point process**, not a minimum-distance/Poisson-disc process. Overlaps and clumps are required, not rejected. For desired union-area coverage `c < 1`, the inclusion intensity (points per square SVG unit) is:

```text
lambda(c) = -log(1 - c) / (pi * r * r)
```

For tile area `A`, exponential arrival increments with rate `A` define increasing intensity marks. Each arrival receives an independent uniform position on the tile. Retaining arrivals with mark at most `lambda(c)` gives Poisson count with mean `A * lambda(c)`, and monotonically nested spatial subsets. The Boolean union of radius-r disks has **expected** coverage `1 - exp(-lambda*pi*r*r)`, accounting for overlaps instead of simply summing disk areas. This expectation is valid on these toroidal tiles because the radius is much smaller than half their side length.

New arrivals between tone thresholds are stored once in rank-band `<g>` definitions. Cumulative groups use `<use>` to reference the previous cumulative group and the new band; each pattern references the appropriate cumulative group. Dots whose disks touch tile borders receive translated copies on the opposite border, including diagonal copies at corners. Pattern overflow is hidden, producing seamless toroidal wrapping. All dots retain the same radius, including wrapped copies.

At `c = 1`, the Poisson intensity is infinite: no finite random point set gives exact 100% coverage. The prototype therefore uses a **solid-ink rectangle endpoint**, interpreted as the infinite-intensity limit, rather than claiming a finite all-dot construction at full coverage. Zero coverage needs no painted pattern. This exception is explicit; all intermediate levels are nested finite Poisson subsets.

Every SVG gets a model-and-variant namespace for IDs, `url(#...)`, `<use href>`, and accessibility references, preventing collisions among the panels. The same saved SVG embedded multiple times by another document would still need an additional per-instance namespace.

## Limitations — do not infer equivalence or performance

- **Deliberately periodic.** The entire random tile repeats, including its clumps and voids. Rotation does not remove repetition. A 24-unit tile repeats less often than a 12-unit tile but remains periodic at every tone. This is not the existing non-repeating stipple field.
- **Cut/half dots.** Wrapping avoids missing dot portions at tile seams. Geometric tone, surface, and silhouette clips can still cut dots into halves or smaller pieces. Reusing clips does not reproduce the production stipple renderer's mark-placement/boundary decisions.
- **Tone bins.** The existing halftone's discrete coverage levels and geometric threshold boundaries are reused, not a continuous per-dot shading evaluation. Nested patterns keep lower-tone points present at higher tones but cannot erase quantization contours. Any geometric approximation in the original clips remains.
- **Finite-tile error.** The formula matches ensemble-expected union coverage, not the exact union area of this seeded finite realization. Poisson count variation and overlaps create deviations; repeating a tile repeats those deviations. Partial tiles and tiny clipped regions can have larger local errors. The manifest's point counts do not measure union area, and no raster coverage measurement is made. Six-decimal coordinate serialization adds tiny numerical error.
- **Different appearance.** Poisson clumps, repeat phase, inherited halftone binning, and clipped marks differ from non-repeating stipple. Matching radius does not imply matching tone or appearance. White backgrounds, black ink, and scene geometry are held fixed to make those differences interpretable.
- **No speed claim.** Shared `<use>` groups reduce template duplication across levels, but viewers still resolve patterns, group references, and clips. SVG size is reported only as bytes; it is not a paint-time or memory benchmark. No browser has been run or visual equivalence asserted.

The generator performs structural validation: unique cross-panel IDs, resolved local paint/use references, no raster/filter/opacity attributes, and preservation of all halftone content outside replaced patterns. These checks are not a browser rendering test. C60 is supported as an optional larger example; ethanol keeps the default output manageable.
