"""Build a traceable research table from original text files, not application code.
No external dependencies. Does not execute or emulate any installer.
Inputs were recovered from the cited archives under build/texture-references.
"""
from pathlib import Path
from decimal import Decimal, ROUND_HALF_UP
import csv
import hashlib
import json
import re

root = Path(__file__).resolve().parent.parent
scratch = root / 'build/texture-references'
out = root / 'references/ortep-colors'
out.mkdir(parents=True, exist_ok=True)
inputs = {
    'atomcols.def': scratch / 'stdlib-atomcols.def',
    'rgbcols-overrides.def': scratch / 'stdlib-rgbcols.def',
    'rgbcols-base-1998.def': scratch / 'public-table-search/1998-RGBCOLS.DEF',
}
source_hashes = {}
for name, source in inputs.items():
    raw = source.read_bytes()
    source_hashes[name] = hashlib.sha256(raw).hexdigest()
    (out / name).write_bytes(raw)

def entries(path):
    for number, line in enumerate(path.read_text(encoding='ascii').splitlines(), 1):
        line = line.strip()
        if line and not line.startswith('#'):
            fields = line.split()
            assert len(fields) == 4, (path, number, fields)
            yield number, fields

def colors(path):
    result = {}
    for line, (name, *values) in entries(path):
        assert name not in result
        decimals = tuple(Decimal(v) for v in values)
        assert all(0 <= v <= 1 for v in decimals)
        result[name] = (values, decimals, line)
    return result

base = colors(inputs['rgbcols-base-1998.def'])
overrides = colors(inputs['rgbcols-overrides.def'])
assert len(base) == 126 and len(overrides) == 4
palette = {**base, **overrides}  # Deliberately case-sensitive, as documented.

# Independently check every used base color against the v2 manual Table 6.4.
manual = (scratch / 'ortep3.txt').read_text(encoding='utf-8')
manual = manual.split('Table 6.4.  Colour names and RGB values defined in Ortep-3 for Windows', 1)[1].split('PAGE 38', 1)[0]
number = r'([01](?:\.\d+)?)'
manual_colors = {name: tuple(Decimal(v) for v in (r,g,b)) for name,r,g,b in
                 re.findall(r'\b([A-Za-z][A-Za-z0-9]*)\s+' + number + r'\s+' + number + r'\s+' + number, manual)}
rows = []
seen = set()
for line, (symbol, name, _radius, _vdw) in entries(inputs['atomcols.def']):
    assert symbol not in seen
    seen.add(symbol)
    values, decimals, rgb_line = palette[name]
    if name not in overrides:
        assert name in manual_colors, ('Missing manual color', name)
        assert decimals == manual_colors[name], ('Manual mismatch', name, decimals, manual_colors[name])
    rgb8 = [int((v * 255).to_integral_value(rounding=ROUND_HALF_UP)) for v in decimals]
    kind = 'legacy-element-symbol' if symbol == 'Ha' else 'isotope' if symbol == 'D' else 'non-element-entry' if symbol in ('Ct', 'Q') else 'element'
    rows.append({'symbol': symbol, 'kind': kind, 'color_name': name,
                 'r': values[0], 'g': values[1], 'b': values[2],
                 'hex': '#' + ''.join(f'{v:02X}' for v in rgb8),
                 'atomcols_line': line,
                 'rgb_source': 'rgbcols-overrides.def' if name in overrides else 'rgbcols-base-1998.def + manual Table 6.4',
                 'rgb_line': rgb_line})
assert len(rows) == 108
assert sum(r['kind'] in ('element', 'legacy-element-symbol') for r in rows) == 105
expected = {'H':'#FFFFFF','C':'#007FFF','N':'#DB70DB','O':'#FF0000','P':'#FF8000','S':'#FFFF00'}
for row in rows:
    if row['symbol'] in expected:
        assert row['hex'] == expected[row['symbol']]
with (out / 'element-colors.csv').open('w', encoding='utf-8', newline='') as file:
    writer = csv.DictWriter(file, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
metadata = {
    'description': 'Actual non-comment rows of shipped ORTEP atomcols.def, not the CPK mapping in its header comments',
    'package_url': 'https://www.chem.gla.ac.uk/~louis/software/downloads/ortep_2026.1.zip',
    'configuration_header': 'Ortep-3 for Windows Version 2.0 (April 2008)',
    'base_rgb_url': 'https://web.archive.org/web/19980712194749id_/http://www.chem.gla.ac.uk:80/~louis/software/ortep3/ortep32.zip',
    'manual_url': 'https://www.chem.gla.ac.uk/~louis/software/ortep/ortep3.pdf#page=37',
    'conversion': 'round(255 * component), positive ties rounded up, consistent with Math.round; source decimal values preserved',
    'validation': 'All referenced non-override color RGB triples exactly match manual Table 6.4; all used names resolved case-sensitively',
    'unknown_note': 'Header says unknown = Pink; no application execution or binary default verification performed',
    'special_symbols': {'Ha':'Historical symbol, retained as written; not silently renamed to Db', 'D':'Isotope entry', 'Ct':'Non-periodic-table entry, retained without interpreting its purpose', 'Q':'Non-periodic-table entry, retained'},
    'source_sha256': source_hashes,
    'archive_verification': json.loads((scratch / 'stdlib-extraction-report.json').read_text(encoding='utf-8')),
    'entries': rows,
}
(out / 'element-colors.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(f'Wrote {len(rows)} entries; 105 element/historical-element entries plus Ct/D/Q. All used RGB verified against original text and manual.')
for row in rows:
    if row['symbol'] in ['H','C','N','O','F','P','S','Cl','Br','I','Fe']:
        print(row['symbol'], row['color_name'], row['hex'])
