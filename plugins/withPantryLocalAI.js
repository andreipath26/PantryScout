const fs = require('node:fs');
const path = require('node:path');
const {
  withAppBuildGradle,
  withDangerousMod,
  withGradleProperties,
  withMainApplication,
} = require('expo/config-plugins');

const LITERT_DEPENDENCY = 'implementation("com.google.ai.edge.litertlm:litertlm-android:0.18.1")';

module.exports = function withPantryLocalAI(config) {
  config = withGradleProperties(config, (mod) => {
    const property = mod.modResults.find((item) => item.type === 'property' && item.key === 'android.kotlinVersion');
    if (property) property.value = '2.3.10';
    else mod.modResults.push({ type: 'property', key: 'android.kotlinVersion', value: '2.3.10' });
    return mod;
  });

  config = withAppBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes(LITERT_DEPENDENCY)) {
      mod.modResults.contents = mod.modResults.contents.replace(
        'implementation("com.facebook.react:react-android")',
        `implementation("com.facebook.react:react-android")\n    ${LITERT_DEPENDENCY}`,
      );
    }
    if (!mod.modResults.contents.includes("noCompress += ['litertlm']")) {
      mod.modResults.contents = mod.modResults.contents.replace(
        /androidResources\s*\{\s*/,
        "androidResources {\n        noCompress += ['litertlm']\n",
      );
    }
    return mod;
  });

  config = withMainApplication(config, (mod) => {
    const registration = 'add(PantryLocalAiPackage())';
    if (!mod.modResults.contents.includes(registration)) {
      const marker = '// add(MyReactNativePackage())';
      if (!mod.modResults.contents.includes(marker)) throw new Error('Could not find React Native package registration point');
      mod.modResults.contents = mod.modResults.contents.replace(marker, `${marker}\n          ${registration}`);
    }
    return mod;
  });

  config = withDangerousMod(config, ['android', async (mod) => {
    const sourceDir = path.join(mod.modRequest.projectRoot, 'native', 'android');
    const targetDir = path.join(mod.modRequest.platformProjectRoot, 'app', 'src', 'main', 'java', 'com', 'andreipath26', 'pantryscout');
    fs.mkdirSync(targetDir, { recursive: true });
    for (const filename of ['PantryLocalAiModule.kt', 'PantryLocalAiPackage.kt']) {
      fs.copyFileSync(path.join(sourceDir, filename), path.join(targetDir, filename));
    }
    return mod;
  }]);

  return config;
};
