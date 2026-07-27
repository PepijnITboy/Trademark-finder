import type { FastifyInstance } from 'fastify';
import type { RegisterSourceStatusRecord } from '../store/types.js';

const NOT_YET_SUPPORTED: ReadonlyArray<{ registryCode: string; displayName: string }> = [
  { registryCode: 'EUIPO', displayName: 'EUIPO (Europese Unie)' },
  { registryCode: 'WIPO', displayName: 'WIPO (internationaal, Madrid-systeem)' },
  { registryCode: 'USPTO', displayName: 'USPTO (Verenigde Staten)' },
];

/**
 * `/api/v1/register-sources` - live connector health per trademark
 * register, so the product is honest about which registers actually back
 * its matches (BOIP only at launch) rather than implying broader coverage.
 * See `docs/connectors/connector-contract.md`.
 */
export async function registerRegisterSourceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async () => {
    const boipHealth = await app.boipConnector.healthCheck();

    const sources: RegisterSourceStatusRecord[] = [
      {
        registryCode: app.boipConnector.registryCode,
        displayName: 'BOIP (Benelux)',
        status: boipHealth.status,
        message: boipHealth.message,
        checkedAt: boipHealth.checkedAt,
      },
      ...NOT_YET_SUPPORTED.map((source) => ({
        ...source,
        status: 'not_yet_supported',
        message: `${source.displayName} wordt nog niet ondersteund door Merkwacht.`,
        checkedAt: new Date().toISOString(),
      })),
    ];

    return { sources };
  });
}
