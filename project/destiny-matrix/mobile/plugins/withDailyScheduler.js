const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

module.exports = function withDailyScheduler(config) {
  config = withAndroidManifest(config, mod => {
    const manifest = mod.modResults.manifest;
    manifest['uses-permission'] ??= [];
    for (const permission of ['POST_NOTIFICATIONS', 'RECEIVE_BOOT_COMPLETED']) {
      const name = `android.permission.${permission}`;
      if (!manifest['uses-permission'].some(item => item.$['android:name'] === name)) {
        manifest['uses-permission'].push({ $: { 'android:name': name } });
      }
    }
    const app = manifest.application[0];
    app.receiver ??= [];
    const name = 'com.arcanasense.daily.DailyReceiver';
    app.receiver = app.receiver.filter(item => item.$['android:name'] !== name);
    app.receiver.push({ $: { 'android:name': name, 'android:exported': 'false' },
      'intent-filter': [{ action: ['BOOT_COMPLETED', 'TIME_SET', 'TIMEZONE_CHANGED', 'DATE_CHANGED', 'MY_PACKAGE_REPLACED']
        .map(action => ({ $: { 'android:name': `android.intent.action.${action}` } })) }],
    });
    return mod;
  });
  return withDangerousMod(config, ['android', async mod => {
    const dir = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res/drawable');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'ic_daily_notification.xml'),
      '<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">' +
      '<path android:fillColor="#FFFFFFFF" android:fillType="evenOdd" android:pathData="M12,1 L23,12 L12,23 L1,12 Z M12,4 L4,12 L12,20 L20,12 Z M12,8 L16,12 L12,16 L8,12 Z"/></vector>');
    return mod;
  }]);
};
