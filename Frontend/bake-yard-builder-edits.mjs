// Bakes a Yard Builder edits.json (removedWalls/addedWalls/etc, see
// tools/WallEditor.jsx's applyEdits) permanently into
// public/yard-layout-sahnewal.json. Mirrors applyEdits' logic exactly so the
// baked result matches what the dev tool showed on screen.
//
// IMPORTANT: wall ids like "f:4:1" are (fence-ring-index, segment-index)
// against whatever layout.json looked like AT EXPORT TIME. If you've baked
// edits since, the ring indices will have shifted — always bake edits in
// the same order they were exported, against the file state they were
// actually drawn against.
import fs from 'fs';

const editsFile = process.argv[2];
const layoutFile = process.argv[3] || 'public/yard-layout-sahnewal.json';
if (!editsFile) {
    console.error('Usage: node bake-yard-builder-edits.mjs <edits.json> [layout.json] [--no-masts]');
    process.exit(1);
}

const editsDoc = JSON.parse(fs.readFileSync(editsFile, 'utf-8'));
const edits = editsDoc.edits || editsDoc;
const layout = JSON.parse(fs.readFileSync(layoutFile, 'utf-8'));

const key = (...p) => p.join(':');

const gone = new Set(edits.removedWalls || []);
const fences = [];
(layout.fences || []).forEach((ls, fi) => {
    let run = [];
    for (let i = 0; i + 1 < ls.length; i++) {
        if (gone.has(key('f', fi, i))) {
            if (run.length >= 2) fences.push(run);
            run = [];
        } else {
            if (!run.length) run.push(ls[i]);
            run.push(ls[i + 1]);
        }
    }
    if (run.length >= 2) fences.push(run);
});
for (const w of (edits.addedWalls || [])) fences.push([[w[0], w[1]], [w[2], w[3]]]);

const drop = new Set(edits.removedObstacles || []);
const dropProps = new Set(edits.removedProps || []);
const includeMasts = !process.argv.includes('--no-masts');
const masts = includeMasts ? (edits.masts || []) : [];

const result = {
    ...layout,
    fences,
    masts: [...(layout.masts || []), ...masts],
    warehouses: (layout.warehouses || []).filter((_, i) => !drop.has(key('w', i))),
    buildings: (layout.buildings || []).filter((_, i) => !drop.has(key('b', i))),
    props: (layout.props || []).filter(p => !dropProps.has(p.id)),
};

fs.writeFileSync(layoutFile, JSON.stringify(result, null, 2));
console.log(`Baked edits into ${layoutFile}:`);
console.log(`  fences: ${layout.fences?.length || 0} -> ${result.fences.length} rings`);
console.log(`  removedWalls applied: ${edits.removedWalls?.length || 0}`);
console.log(`  addedWalls applied: ${edits.addedWalls?.length || 0}`);
console.log(`  masts: ${layout.masts?.length || 0} -> ${result.masts.length}`);
console.log(`  warehouses: ${layout.warehouses?.length || 0} -> ${result.warehouses.length}`);
console.log(`  buildings: ${layout.buildings?.length || 0} -> ${result.buildings.length}`);
