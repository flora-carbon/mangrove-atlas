#!/usr/bin/env node
/**
 * Builds a self-contained Earth Engine Code Editor script from
 * src/lib/server/ee/recipes.ts so reviewers can run the exact analysis logic
 * at https://code.earthengine.google.com — no server or credentials needed
 * beyond an Earth Engine account.
 *
 *   node scripts/ee/build-code-editor-script.mjs > atlas-recipes.js
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const src = readFileSync(fileURLToPath(new URL("../../src/lib/server/ee/recipes.ts", import.meta.url)), "utf8");
let js = ts.transpileModule(src, {
  compilerOptions: { target: ts.ScriptTarget.ES5, module: ts.ModuleKind.ESNext, removeComments: false },
}).outputText;
js = js.replace(/^import .*$/gm, "").replace(/^export /gm, "");

const harness = `
// ---------------------------------------------------------------------------
// Harness: runs every Atlas statistic for a test area and adds the map layers.
// Edit AOI to test elsewhere.
// ---------------------------------------------------------------------------
var AOI = ee.Geometry.Rectangle([88.75, 21.95, 88.88, 22.05], null, false); // Sundarbans test box
var GMW_YEARS = [1996, 2007, 2008, 2009, 2010, 2015, 2016, 2017, 2018, 2019, 2020];
var CGMD_YEARS = []; for (var y = 1984; y <= 2023; y++) CGMD_YEARS.push(y);
var pairs = []; for (var i = 1; i < GMW_YEARS.length; i++) pairs.push([GMW_YEARS[i - 1], GMW_YEARS[i]]);

Map.centerObject(AOI, 11);
Map.addLayer(cgmdExtent(ee, 2023), {palette: ['13a36b']}, 'CGMD 2023');
Map.addLayer(gmwV3Extent(ee, 2020), {palette: ['0f766e']}, 'GMW v3 2020', false);
Map.addLayer(gmwV4_2020(ee), {palette: ['22c55e']}, 'GMW 10 m 2020', false);
Map.addLayer(gmwV3Change(ee, 1996, 2020), {min: 1, max: 2, palette: ['2563eb', 'dc2626']}, 'GMW change 1996-2020', false);
Map.addLayer(tandemxHeight(ee), {min: 0, max: 30, palette: ['440154', '3b528b', '21918c', '5ec962', 'fde725']}, 'TanDEM-X height', false);
Map.addLayer(murrayTidalChange(ee), {min: 1, max: 4, palette: ['dc2626', '2563eb', 'f59e0b', 'a855f7']}, 'Tidal change', false);
Map.addLayer(AOI, {color: 'white'}, 'AOI');

print('AOI ha', AOI.area(1).divide(1e4));
print('GMW v3 area m2 by year', gmwV3AreaByYear(ee, AOI, GMW_YEARS));
print('CGMD area m2 by year', cgmdAreaByYear(ee, AOI, CGMD_YEARS));
print('GMW 10 m 2020 area m2', gmwV4AreaM2(ee, AOI, 10));
print('GMW v3 change m2', gmwV3ChangeAreas(ee, AOI, pairs.concat([[1996, 2020]])));
print('TanDEM-X stats', tandemxStats(ee, AOI));
print('Simard stats', simardStats(ee, AOI));
print('Coastal stats m2', coastalStats(ee, AOI));
print('Mask pixels (20 m)', maskPixelCount(ee, AOI));
var start = ee.Date(Date.now()).advance(-23, 'month').format('YYYY-MM-01');
print('Condition series', conditionSeries(ee, AOI, start.getInfo(), 24, true));
`;

process.stdout.write(`// Generated from src/lib/server/ee/recipes.ts — do not edit by hand.\n${js}\n${harness}`);
