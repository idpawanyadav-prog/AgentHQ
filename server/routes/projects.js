const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// GET /api/projects - List all projects
router.get('/', async (req, res) => {
 try {
 const projects = await prisma.project.findMany({
 include: {
 team: true,
 milestones: { orderBy: { order: 'asc' } },
 },
 orderBy: { createdAt: 'desc' },
 });
 res.json(projects);
 } catch (error) {
 console.error('Error fetching projects:', error);
 res.status(500).json({ message: 'Failed to fetch projects', error: error.message });
 }
});

// GET /api/projects/:id - Get single project
router.get('/:id', async (req, res) => {
 try {
 const project = await prisma.project.findUnique({
 where: { id: req.params.id },
 include: {
 team: { include: { members: true } },
 milestones: { orderBy: { order: 'asc' } },
 },
 });
 if (!project) {
 return res.status(404).json({ message: 'Project not found' });
 }
 res.json(project);
 } catch (error) {
 console.error('Error fetching project:', error);
 res.status(500).json({ message: 'Failed to fetch project', error: error.message });
 }
});

// POST /api/projects - Create new project
router.post('/', async (req, res) => {
 try {
 const { name, description, teamId, repoUrl } = req.body;

 if (!name || !teamId) {
 return res.status(400).json({ message: 'Name and teamId are required' });
 }

 const project = await prisma.project.create({
 data: {
 name,
 description: description || null,
 teamId,
 repoUrl: repoUrl || null,
 },
 include: {
 team: true,
 milestones: true,
 },
 });
 res.status(201).json(project);
 } catch (error) {
 console.error('Error creating project:', error);
 res.status(500).json({ message: 'Failed to create project', error: error.message });
 }
});

// PUT /api/projects/:id - Update project
router.put('/:id', async (req, res) => {
 try {
 const { name, description, status, progress, repoUrl } = req.body;
 const project = await prisma.project.update({
 where: { id: req.params.id },
 data: {
 ...(name !== undefined && { name }),
 ...(description !== undefined && { description }),
 ...(status !== undefined && { status }),
 ...(progress !== undefined && { progress }),
 ...(repoUrl !== undefined && { repoUrl }),
 },
 include: {
 team: true,
 milestones: true,
 },
 });
 res.json(project);
 } catch (error) {
 console.error('Error updating project:', error);
 res.status(500).json({ message: 'Failed to update project', error: error.message });
 }
});

// DELETE /api/projects/:id - Delete project
router.delete('/:id', async (req, res) => {
 try {
 await prisma.project.delete({ where: { id: req.params.id } });
 res.json({ message: 'Project deleted' });
 } catch (error) {
 console.error('Error deleting project:', error);
 res.status(500).json({ message: 'Failed to delete project', error: error.message });
 }
});

// POST /api/projects/:id/milestones - Add milestone to project
router.post('/:id/milestones', async (req, res) => {
 try {
 const { title, order = 0 } = req.body;
 const milestone = await prisma.milestone.create({
 data: {
 title,
 order,
 projectId: req.params.id,
 },
 });
 res.status(201).json(milestone);
 } catch (error) {
 console.error('Error creating milestone:', error);
 res.status(500).json({ message: 'Failed to create milestone', error: error.message });
 }
});

// PATCH /api/projects/milestones/:id - Update milestone status
router.patch('/milestones/:id', async (req, res) => {
 try {
 const { status } = req.body;
 const milestone = await prisma.milestone.update({
 where: { id: req.params.id },
 data: { status },
 });
 res.json(milestone);
 } catch (error) {
 console.error('Error updating milestone:', error);
 res.status(500).json({ message: 'Failed to update milestone', error: error.message });
 }
});

module.exports = router;
