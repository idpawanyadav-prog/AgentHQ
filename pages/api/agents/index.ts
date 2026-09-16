import { withAuth } from '../../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import { readConfiguredModels } from '../../../lib/configured-models';

async function handler(req: NextApiRequest, res: NextApiResponse) {
 const { teamId } = req.query;
 if (req.method === 'GET') {
 const agents = await prisma.agent.findMany({
 where: teamId && teamId !== 'undefined' ? { member: { teamId: teamId as string } } : {},
 include: { member: true, tasks: true },
 orderBy: { createdAt: 'desc' },
 });
 res.status(200).json(agents);
 } else if (req.method === 'POST') {
 try {
 const { name, type, model, memberId, teamId: bodyTeamId, config, configuredModelId, roleGroupId } = req.body;
 const requestedConfiguredModelId = typeof configuredModelId === 'string' && configuredModelId.trim()
 ? configuredModelId.trim()
 : typeof config?.configuredModelId === 'string'
 ? config.configuredModelId.trim()
 : '';
 if (typeof name !== 'string' || !name.trim()) {
 return res.status(400).json({error:'Valid name, model and gateway provider are required'});
 }
 if (!memberId && (typeof bodyTeamId !== 'string' || !bodyTeamId.trim())) {
 return res.status(400).json({error:'teamId is required'});
 }
 const configuredModels = await readConfiguredModels();
 const configuredModel = requestedConfiguredModelId
 ? configuredModels.find((item) => item.id === requestedConfiguredModelId)
 : undefined;
 if (requestedConfiguredModelId && !configuredModel) return res.status(400).json({error:'Configured model not found'});
 if (!configuredModel && (![model].every(v => typeof v === 'string' && v.trim()) || !['openai','anthropic','custom'].includes(type))) {
 return res.status(400).json({error:'Valid name, model and gateway provider are required'});
 }
 const gateway = configuredModel
 ? await prisma.gateway.findUnique({ where: { id: configuredModel.gatewayId } })
 : null;
 if (configuredModel && !gateway) return res.status(400).json({error:'Configured model gateway not found'});
 const agent = await prisma.$transaction(async (tx) => {
 let resolvedMemberId = memberId;
 if (resolvedMemberId) {
 const member = await tx.member.findUnique({where:{id:resolvedMemberId}});
 if (!member) throw new Error('Member not found');
 } else {
 const team = await tx.team.findUnique({where:{id:bodyTeamId}});
 if (!team) throw new Error('Team not found');
 const member = await tx.member.create({
 data: {
 name: name.trim(),
 role: 'AI Agent',
 type: 'ai',
 teamId: bodyTeamId,
 },
 });
 resolvedMemberId = member.id;
 }
 if (roleGroupId) {
 const group = await tx.roleGroup.findUnique({where:{id:roleGroupId}});
 if (!group) throw new Error('Role group not found');
 }
 const resolvedConfig = {
 ...(config && typeof config === 'object' ? config : {}),
 ...(configuredModel ? { gatewayId: configuredModel.gatewayId, configuredModelId: configuredModel.id } : {}),
 };
 const createdAgent = await tx.agent.create({
 data: {
 name: name.trim(),
 type: configuredModel?.provider || type,
 model: configuredModel?.modelId || model.trim(),
 memberId: resolvedMemberId,
 config: JSON.stringify(resolvedConfig),
 status: 'idle',
 },
 include: { member: true },
 });
 if (roleGroupId) {
 await tx.agentRoleAssignment.create({
 data: {
 roleGroupId,
 agentId: createdAgent.id,
 agentName: createdAgent.name,
 agentStatus: createdAgent.status,
 },
 });
 }
 return createdAgent;
 });
 res.status(201).json(agent);
 } catch (err) {
 const message = err instanceof Error ? err.message : 'Failed to create agent';
 const status = ['Member not found', 'Team not found', 'Role group not found'].includes(message) ? 400 : 500;
 res.status(status).json({error: message});
 return;
 }
 } else {
 res.setHeader('Allow', ['GET', 'POST']);
 res.status(405).end(`Method ${req.method} Not Allowed`);
 }
}

export default withAuth(handler);
