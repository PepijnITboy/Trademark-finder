import { createBoipConnector } from '../boip/boip.connector.js';
import type { TrademarkRegisterConnector } from '../core/register-connector.js';
import { REGISTER_CODES, type RegisterCode } from '../core/register-types.js';
import { createEuipoConnector } from '../euipo/euipo.connector.js';
import { createConfiguredHttpConnector } from '../generic/configured-http.connector.js';
import { createUsptoConnector } from '../uspto/uspto.connector.js';
import { createWipoMadridConnector } from '../wipo/wipo.connector.js';

/** Register codes with a deep, register-specific connector implementation (their own folder under `src/`). Every other {@link RegisterCode} is wired through `createConfiguredHttpConnector`. */
const DEEP_CODES: ReadonlySet<RegisterCode> = new Set<RegisterCode>(['BOIP', 'EUIPO', 'USPTO', 'WIPO']);

/**
 * Builds every register connector Merkwacht knows about (one per
 * `REGISTER_CODES` entry): `BOIP`/`EUIPO`/`USPTO`/`WIPO` get their deep,
 * register-specific implementations; every other catalog code is wired
 * through the generic HTTP factory
 * (`../generic/configured-http.connector.ts`) with `{code}_API_BASE_URL` /
 * `{code}_API_KEY` / `{code}_USE_FIXTURES` env vars. This is the single
 * place `apps/worker` and `apps/api` should call to get a full connector
 * map - see `docs/connectors/connector-contract.md`.
 *
 * Accepts an explicit `env` record (defaults to `process.env`) so callers
 * with a validated, typed env object (`@merkwacht/config`'s `ApiEnv`/
 * `WorkerEnv`) can pass it through directly, and so tests can build an
 * isolated connector map without mutating global `process.env`.
 */
export function createAllConnectors(env: NodeJS.ProcessEnv = process.env): Map<RegisterCode, TrademarkRegisterConnector> {
  const map = new Map<RegisterCode, TrademarkRegisterConnector>();

  map.set(
    'BOIP',
    createBoipConnector({
      apiBaseUrl: env['BOIP_API_BASE_URL'],
      apiKey: env['BOIP_API_KEY'],
      useFixtures: env['BOIP_USE_FIXTURES'] === 'true',
    }),
  );
  map.set(
    'EUIPO',
    createEuipoConnector({
      clientId: env['EUIPO_CLIENT_ID'],
      clientSecret: env['EUIPO_CLIENT_SECRET'],
      apiBaseUrl: env['EUIPO_API_BASE_URL'],
      tokenUrl: env['EUIPO_TOKEN_URL'],
      openDataBaseUrl: env['EUIPO_OPEN_DATA_BASE_URL'],
      useFixtures: env['EUIPO_USE_FIXTURES'] === 'true',
    }),
  );
  map.set(
    'USPTO',
    createUsptoConnector({
      apiKey: env['USPTO_API_KEY'],
      apiBaseUrl: env['USPTO_API_BASE_URL'],
      gazetteFeedUrl: env['USPTO_GAZETTE_FEED_URL'],
      useFixtures: env['USPTO_USE_FIXTURES'] === 'true',
    }),
  );
  map.set(
    'WIPO',
    createWipoMadridConnector({
      useFixtures: env['WIPO_USE_FIXTURES'] === 'true',
    }),
  );

  for (const code of REGISTER_CODES) {
    if (DEEP_CODES.has(code)) continue;
    map.set(
      code,
      createConfiguredHttpConnector({
        registryCode: code,
        envPrefix: code,
        apiBaseUrl: env[`${code}_API_BASE_URL`],
        apiKey: env[`${code}_API_KEY`],
        useFixtures: env[`${code}_USE_FIXTURES`] === 'true',
      }),
    );
  }

  return map;
}

/** Looks up the connector for `code`, throwing a clear error if none is registered (a programming/config error, not a runtime connector failure). */
export function getConnector(
  connectors: ReadonlyMap<RegisterCode, TrademarkRegisterConnector>,
  code: RegisterCode,
): TrademarkRegisterConnector {
  const connector = connectors.get(code);
  if (!connector) {
    throw new Error(`No connector registered for register code "${code}".`);
  }
  return connector;
}
