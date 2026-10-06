const fs = require('node:fs');
const path = require('node:path');

// expo-router 55.0.18 needs this availability guard when built with Xcode 27.
const unpatched = `    if let subtitle = subtitle {
      baseUiAction.subtitle = subtitle
    }`;
const patched = `    if #available(iOS 16.0, *), let subtitle = subtitle {
      baseUiAction.subtitle = subtitle
    }`;
const count = (source, block) => source.split(block).length - 1;

try {
  const packagePath = require.resolve('expo-router/package.json', {
    paths: [path.resolve(__dirname, '..')],
  });
  const { version } = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  if (version !== '55.0.18') {
    throw new Error(`Expected expo-router 55.0.18, found ${version}; review this compatibility patch.`);
  }

  const file = path.join(path.dirname(packagePath), 'ios/LinkPreview/LinkPreviewNativeActionView.swift');
  const source = fs.readFileSync(file, 'utf8');
  const unpatchedCount = count(source, unpatched);
  const patchedCount = count(source, patched);
  const assignmentCount = count(source, 'baseUiAction.subtitle = subtitle');

  if (unpatchedCount === 0 && patchedCount === 1 && assignmentCount === 1) {
    console.log('expo-router subtitle compatibility patch already applied; no rewrite.');
  } else if (unpatchedCount === 1 && patchedCount === 0 && assignmentCount === 1) {
    fs.writeFileSync(file, source.replace(unpatched, patched));
    console.log('Applied expo-router 55.0.18 subtitle availability patch.');
  } else {
    throw new Error(`Unexpected Swift source: unpatched=${unpatchedCount}, patched=${patchedCount}, assignments=${assignmentCount}; refusing to modify.`);
  }
} catch (error) {
  console.error(`expo-router subtitle patch failed: ${error.message}`);
  process.exitCode = 1;
}
