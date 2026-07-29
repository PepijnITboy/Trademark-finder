import type { RegisterCatalogEntry } from '@merkwacht/domain';
import type { FastifyInstance } from 'fastify';
import { isRegisterMonitoringOk } from '../platform/connector-cockpit-store.js';
import type { WatchedTrademarkRecord } from '../store/types.js';

export type WatchedTrademarkApiRecord = WatchedTrademarkRecord & {
  readonly registerMonitoringOk: boolean;
};

/**
 * Enrich persisted watches with live register-monitoring truth from the cockpit.
 */
export function enrichWatchedTrademark(
  app: FastifyInstance,
  watch: WatchedTrademarkRecord,
): WatchedTrademarkApiRecord {
  const entry =
    app.nameResearchStore.listCatalog().find((r: RegisterCatalogEntry) => r.code === watch.registryCode) ??
    null;
  const runtime = app.connectorCockpitStore.getRuntime(watch.registryCode);
  return {
    ...watch,
    registerMonitoringOk: entry ? isRegisterMonitoringOk(entry, runtime) : false,
  };
}

export function enrichWatchedTrademarks(
  app: FastifyInstance,
  watches: readonly WatchedTrademarkRecord[],
): readonly WatchedTrademarkApiRecord[] {
  return watches.map((w) => enrichWatchedTrademark(app, w));
}
