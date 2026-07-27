import {
  addressParseSchema,
  createMemberSchema,
  organizationProfileSchema,
  updateMemberSchema,
} from '@merkwacht/validation';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getOrganizationId, resolveDemoRequestContext } from '../org/demo-request-context.js';

const updateProfileSchema = organizationProfileSchema.partial();

/** `/api/v1/organization` — org profile and member management (demo identity via `x-demo-role` / `x-demo-user-id`). */
export async function registerOrganizationRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async () => {
    const organizationId = getOrganizationId(app);
    const profile = app.orgStore.getProfile(organizationId);
    return { profile };
  });

  app.patch('/', async (request: FastifyRequest) => {
    const organizationId = getOrganizationId(app);
    const patch = updateProfileSchema.parse(request.body);
    const profile = app.orgStore.updateProfile(organizationId, {
      ...(patch.legalName !== undefined ? { legalName: patch.legalName } : {}),
      ...(patch.addressLine !== undefined ? { addressLine: patch.addressLine } : {}),
      ...(patch.postalCode !== undefined ? { postalCode: patch.postalCode } : {}),
      ...(patch.city !== undefined ? { city: patch.city } : {}),
      ...(patch.country !== undefined ? { country: patch.country } : {}),
      ...(patch.kvkNumber !== undefined ? { kvkNumber: patch.kvkNumber } : {}),
      ...(patch.contactEmail !== undefined ? { contactEmail: patch.contactEmail } : {}),
      ...(patch.billingEmail !== undefined ? { billingEmail: patch.billingEmail } : {}),
      ...(patch.contactEmail !== undefined ? { contactEmail: patch.contactEmail } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
    });
    return { profile };
  });

  app.post('/parse-address', async (request: FastifyRequest) => {
    const input = addressParseSchema.parse(request.body);
    const parsed = app.orgStore.parseAddress(input.addressLine);
    return { parsed };
  });

  app.get('/members', async () => {
    const organizationId = getOrganizationId(app);
    const members = app.orgStore.listMembers(organizationId);
    return { members };
  });

  app.post('/members', async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = getOrganizationId(app);
    const input = createMemberSchema.parse(request.body);
    const { actorRole } = resolveDemoRequestContext(request);
    const member = app.orgStore.createMember(
      organizationId,
      {
        email: input.email,
        displayName: input.displayName,
        role: input.role,
        ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
      },
      actorRole,
    );
    return reply.status(201).send({ member });
  });

  app.patch('/members/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const organizationId = getOrganizationId(app);
    const patch = updateMemberSchema.parse(request.body);
    const { actorRole, actorUserId } = resolveDemoRequestContext(request);
    const member = app.orgStore.updateMember(
      organizationId,
      request.params.id,
      {
        ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
        ...(patch.role !== undefined ? { role: patch.role } : {}),
        ...(patch.jobTitle !== undefined ? { jobTitle: patch.jobTitle } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
      },
      actorRole,
      actorUserId,
    );
    if (!member) {
      return reply.status(404).send({
        code: 'MEMBER_NOT_FOUND',
        messageNl: 'Deze gebruiker bestaat niet binnen uw organisatie.',
        referenceCode: request.params.id,
      });
    }
    return { member };
  });

  app.delete('/members/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const organizationId = getOrganizationId(app);
    const { actorRole, actorUserId } = resolveDemoRequestContext(request);
    const removed = app.orgStore.removeMember(organizationId, request.params.id, actorRole, actorUserId);
    if (!removed) {
      return reply.status(404).send({
        code: 'MEMBER_NOT_FOUND',
        messageNl: 'Deze gebruiker bestaat niet binnen uw organisatie.',
        referenceCode: request.params.id,
      });
    }
    return reply.status(204).send();
  });
}
