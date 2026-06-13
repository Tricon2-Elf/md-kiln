import path from 'path';
import type { StatusOptions, StatusPluginName } from '../types/config';
import type { StatusPlugin, StatusResult } from '../types/plugins';
import * as mockPlugin from './mock';
import * as tcpCheckPlugin from './tcp-check';
import * as httpPlugin from './http';

const builtIn: Record<StatusPluginName, StatusPlugin> = {
  mock: mockPlugin,
  'tcp-check': tcpCheckPlugin,
  http: httpPlugin,
};

function isStatusPlugin(value: unknown): value is StatusPlugin {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getStatus' in value &&
    typeof value.getStatus === 'function'
  );
}

function resolve(pluginName: string): StatusPlugin {
  if (pluginName in builtIn) {
    return builtIn[pluginName as StatusPluginName];
  }

  const customPath = path.isAbsolute(pluginName)
    ? pluginName
    : path.join(__dirname, pluginName);

  const plugin: unknown = require(customPath);
  if (!isStatusPlugin(plugin)) {
    throw new Error(`Status plugin "${pluginName}" must export getStatus()`);
  }
  return plugin;
}

export async function runStatusPlugin(
  pluginName: string,
  options: StatusOptions = {},
): Promise<StatusResult> {
  const plugin = resolve(pluginName);
  return plugin.getStatus(options);
}
