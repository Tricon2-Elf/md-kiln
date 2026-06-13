import type { MockStatusOptions, StatusOptions } from '../types/config';
import type { StatusResult } from '../types/plugins';

export async function getStatus(options: StatusOptions = {}): Promise<StatusResult> {
  const mockOptions = options as MockStatusOptions;
  const online = mockOptions.online ?? true;
  const players = mockOptions.players ?? 0;

  return {
    online,
    metrics: { players: online ? players : 0 },
  };
}
