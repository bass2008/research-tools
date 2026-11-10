const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The web and mobile apps have separate package trees, not npm workspaces.
// Make shared source files visible and supply this app's dependencies as a fallback.
config.watchFolders = [path.resolve(__dirname, '../web/lib'), path.resolve(__dirname, '../web/content'), path.resolve(__dirname, '../web/public/img/arcana')];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
const webRoot = path.resolve(__dirname, '../web');
config.resolver.resolveRequest = (context, name, platform) => {
  const resolved = context.resolveRequest(context, name, platform);
  // Shared calculation code is allowed; server content and the web's React tree are not.
  if (resolved.type === 'sourceFile' && (resolved.filePath.startsWith(path.join(webRoot, 'content') + path.sep) && !/^content\/(ru|en)\/arcana-catalog\.json$/.test(path.relative(webRoot, resolved.filePath))
    || resolved.filePath.startsWith(path.join(webRoot, 'node_modules') + path.sep))) {
    throw new Error(`Server/browser dependency crossed the mobile boundary: ${name}`);
  }
  return resolved;
};

module.exports = config;
