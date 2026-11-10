const test = require('node:test');
const assert = require('node:assert/strict');
const { patchMainApplication } = require('../withNativeErrors');

test('prebuild initializes the filtered native SDK before React Native starts, exactly once', () => {
  const source = `package com.arcanasense.app
class MainApplication : Application() {
  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}`;
  const updated = patchMainApplication(source, 'kt');
  assert.equal(patchMainApplication(updated, 'kt'), updated);
  assert.equal(updated.split('ArcanaNativeErrors.init(this)').length, 2);
  assert.ok(updated.indexOf('ArcanaNativeErrors.init(this)') > updated.indexOf('super.onCreate()'));
  assert.ok(updated.indexOf('ArcanaNativeErrors.init(this)') < updated.indexOf('loadReactNative(this)'));
});

test('Java templates retain valid semicolons and repeated prebuild is stable', () => {
  const source = 'package com.arcanasense.app;\nclass MainApplication {\n  public void onCreate() {\n    super.onCreate();\n  }\n}';
  const updated = patchMainApplication(source, 'java');
  assert.match(updated, /ArcanaNativeErrors\.init\(this\);/);
  assert.equal(patchMainApplication(updated, 'java'), updated);
});

test('an incompatible template or competing unfiltered initializer fails the build', () => {
  assert.throws(() => patchMainApplication('class MainApplication {}', 'kt'), /Cannot safely locate/);
  assert.throws(() => patchMainApplication('RNSentrySDK.init(this)', 'kt'), /Remove useNativeInit/);
  assert.throws(() => patchMainApplication('', 'swift'), /Kotlin or Java/);
});
