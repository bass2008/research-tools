const { withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

// Reuse the website's licensed font files. Android's ReactFontManager resolves these
// asset names directly; no runtime download or additional font library is required.
module.exports = function withBrandFonts(config) {
  return withDangerousMod(config, ['android', async mod => {
    const source = path.resolve(mod.modRequest.projectRoot, '../web/public/fonts/og');
    const target = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/assets/fonts');
    await fs.mkdir(target, { recursive: true });
    for (const [input, output] of [
      ['manrope-400.ttf', 'Manrope-Regular.ttf'],
      ['manrope-700.ttf', 'Manrope-Bold.ttf'],
      ['cormorant-garamond-600.ttf', 'CormorantGaramond-SemiBold.ttf'],
    ]) await fs.copyFile(path.join(source, input), path.join(target, output));
    await fs.copyFile(path.join(source, '../OFL.txt'), path.join(target, 'OFL.txt'));
    return mod;
  }]);
};
