const fs = require('fs');
const path = require('path');
const root = path.resolve('node_modules');
let patched = 0;
const changed = [];

function patchPublication(publication, version, label) {
  if (publication && !publication.version && version) {
    publication.version = version;
    patched += 1;
    changed.push(label + ' -> ' + version);
  }
}

function walk(directory) {
  let entries;
  try { entries = fs.readdirSync(directory, { withFileTypes: true }); }
  catch { return; }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === '.bin') continue;
    const child = path.join(directory, entry.name);
    if (entry.name === 'node_modules') {
      walk(child);
      continue;
    }

    let version = null;
    try { version = JSON.parse(fs.readFileSync(path.join(child, 'package.json'), 'utf8')).version || null; }
    catch {}

    for (const fileName of ['expo-module.config.json', 'unimodule.json']) {
      const configPath = path.join(child, fileName);
      if (!fs.existsSync(configPath)) continue;
      let config;
      try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); }
      catch { continue; }
      const before = patched;
      if (config.android) {
        patchPublication(config.android.publication, version, child + ':' + fileName + ':android.publication');
        for (const [index, project] of (config.android.projects || []).entries()) {
          patchPublication(project.publication, version, child + ':' + fileName + ':android.projects[' + index + '].publication');
        }
      }
      if (patched !== before) fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    }
    walk(child);
  }
}

walk(root);
console.log('Expo publication metadata: ' + patched + ' missing version field(s) repaired.');
for (const item of changed) console.log('  ' + item);
