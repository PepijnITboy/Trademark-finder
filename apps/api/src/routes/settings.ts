import { organizationSettingsSchema } from '@merkwacht/validation';
import type { FastifyInstance, FastifyRequest } from 'fastify';

const updateSettingsSchema = organizationSettingsSchema.partial();

/** `/api/v1/settings` - organization-level notification/locale preferences. */
export async function registerSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request) => {
    const organizationId = request.tenant!.organizationId;
    const settings = await app.store.getOrganizationSettings(organizationId);
    return { settings };
  });

  app.patch('/', async (request: FastifyRequest) => {
    const organizationId = request.tenant!.organizationId;
    const patch = updateSettingsSchema.parse(request.body);
    const settings = await app.store.updateOrganizationSettings(organizationId, patch);
    return { settings };
  });
}
