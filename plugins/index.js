const path = require('path');

const builtIn = {
  mock: () => require('./mock'),
  'tcp-check': () => require('./tcp-check'),
  http: () => require('./http'),
};

function resolve(pluginName) {
  if (builtIn[pluginName]) {
    return builtIn[pluginName]();
  }

  const customPath = path.isAbsolute(pluginName)
    ? pluginName
    : path.join(__dirname, pluginName);

  return require(customPath);
}

async function runStatusPlugin(pluginName, options = {}) {
  const plugin = resolve(pluginName);
  if (typeof plugin.getStatus !== 'function') {
    throw new Error(`Status plugin "${pluginName}" must export getStatus()`);
  }
  return plugin.getStatus(options);
}

module.exports = { runStatusPlugin };
