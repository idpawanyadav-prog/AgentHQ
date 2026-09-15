import { withAuth } from '../../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

const BENCH_TEAM_ID = 'on-bench';

async function getOrCreateBenchTeam() {
 return prisma.team.upsert({
 where: { id: BENCH_TEAM_ID },
 update: {},
 create: {
 id: BENCH_TEAM_ID,
 name: 'On Bench',
 description: 'Agents not currently assigned to an active delivery team.',
 status: 'paused',
 },
 });
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
 const { id } = req.query;
 if (req.method === 'GET') {
 const agent = await prisma.agent.findUnique({
 where: { id: id as string },
 include: { member: true, tasks: { include: { team: true } } },
 });
 if (!agent) return res.status(404).json({ error: 'Agent not found' });
 res.status(200).json(agent);
 } else if (req.method === 'PUT') {
 const { name, type, model, config, status, teamId } = req.body;
 if (type !== undefined && !['openai', 'anthropic', 'custom'].includes(type)) {
 return res.status(400).json({ error: 'Invalid provider type' });
 }
 if (status !== undefined && !['idle', 'working', 'error'].includes(status)) {
 return res.status(400).json({ error: 'Invalid agent status' });
 }
 if (teamId === null) {
 const agent = await prisma.agent.findUnique({
 where: { id: id as string },
 include: { member: { include: { team: true } } },
 });
 if (!agent) return res.status(404).json({ error: 'Agent not found' });
 if (agent.status === 'working') {
 return res.status(409).json({ error: 'Stop the agent before moving it to the bench.' });
 }
 const benchTeam = await getOrCreateBenchTeam();
 const updated = await prisma.$transaction(async (tx) => {
 await tx.task.updateMany({
 where: {
 agentId: agent.id,
 teamId: agent.member.teamId,
 status: { notIn: ['done'] },
 },
 data: { agentId: null },
 });
 const nextAgent = await tx.agent.update({
 where: { id: agent.id },
 data: {
 status: 'idle',
 member: {
 update: {
 teamId: benchTeam.id,
 ...(name !== undefined && { name }),
 },
 },
 ...(name !== undefined && { name }),
 ...(type !== undefined && { type }),
 ...(model !== undefined && { model }),
 ...(config !== undefined && { config: JSON.stringify(config) }),
 },
 include: { member: true, tasks: true },
 });
 await tx.activity.create({
 data: {
 teamId: agent.member.teamId,
 memberId: agent.memberId,
 type: 'agent_benched',
 description: `${agent.name} moved to On Bench`,
 meta: JSON.stringify({ agentId: agent.id, benchTeamId: benchTeam.id }),
 },
 });
 return nextAgent;
 });
 return res.status(200).json(updated);
 }
 if (typeof teamId === 'string') {
 const existingAgent = await prisma.agent.findUnique({
 where: { id: id as string },
 include: { member: true },
 });
 if (!existingAgent) return res.status(404).json({ error: 'Agent not found' });
 const targetTeam = await prisma.team.findUnique({ where: { id: teamId } });
 if (!targetTeam) return res.status(400).json({ error: 'Team not found' });
 const updated = await prisma.$transaction(async (tx) => {
 const nextAgent = await tx.agent.update({
 where: { id: id as string },
 data: {
 ...(name !== undefined && { name }),
 ...(type !== undefined && { type }),
 ...(model !== undefined && { model }),
 ...(config !== undefined && { config: JSON.stringify(config) }),
 ...(status !== undefined && { status }),
 member: {
 update: {
 teamId,
 ...(name !== undefined && { name }),
 },
 },
 },
 include: { member: true, tasks: true },
 });
 if (existingAgent.member.teamId !== teamId) {
 await tx.activity.create({
 data: {
 teamId,
 memberId: existingAgent.memberId,
 type: 'agent_joined',
 description: `${nextAgent.name} added to ${targetTeam.name}`,
 meta: JSON.stringify({ agentId: nextAgent.id, fromTeamId: existingAgent.member.teamId }),
 },
 });
 }
 return nextAgent;
 });
 return res.status(200).json(updated);
 }
 const agent = await prisma.agent.update({
 where: { id: id as string },
 data: {
 ...(name !== undefined && { name }),
 ...(type !== undefined && { type }),
 ...(model !== undefined && { model }),
 ...(config !== undefined && { config: JSON.stringify(config) }),
 ...(status !== undefined && { status }),
 ...((teamId !== undefined || name !== undefined) && {
 member: {
 update: {
 ...(teamId !== undefined && { teamId }),
 ...(name !== undefined && { name }),
 },
 },
 }),
 },
 include: { member: true, tasks: true },
 });
 res.status(200).json(agent);
 } else if (req.method === 'DELETE') {
 const agent = await prisma.agent.findUnique({
 where: { id: id as string },
 include: { member: true },
 });
 if (!agent) return res.status(404).json({ error: 'Agent not found' });
 if (agent.status === 'working') {
 return res.status(409).json({ error: 'Stop the agent before deleting it.' });
 }
 await prisma.$transaction(async (tx) => {
 await tx.task.updateMany({
 where: { agentId: agent.id },
 data: { agentId: null },
 });
 await tx.agentRoleAssignment.deleteMany({
 where: { agentId: agent.id },
 });
 await tx.agent.delete({
 where: { id: agent.id },
 });
 const siblingAgents = await tx.agent.count({
 where: { memberId: agent.memberId },
 });
 if (agent.member.type === 'ai' && siblingAgents === 0) {
 await tx.member.delete({
 where: { id: agent.memberId },
 });
 }
 });
 res.status(204).end();
 } else {
 res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
 res.status(405).end(`Method ${req.method} Not Allowed`);
 }
}

export default withAuth(handler);
