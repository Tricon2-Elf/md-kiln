import type { StatusOptions } from './config';

export interface StatusMetrics {
  players: number;
  [key: string]: number;
}

export interface StatusResult {
  online: boolean;
  metrics: StatusMetrics;
}

export interface StatusPlugin {
  getStatus(options?: StatusOptions): Promise<StatusResult>;
}
