const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
	// 1. Count tables
	const groups = await prisma.roleGroup.count();
	const instructions = await prisma.instructionFile.count();
	const skills = await prisma.skill.count();
	const assignments = await prisma.agentRoleAssignment.count();
	console.log('=== DB Counts ===');
	console.log(`RoleGroups: ${groups}`);
	console.log(`InstructionFiles: ${instructions}`);
	console.log(`Skills: ${skills}`);
	console.log(`AgentAssignments: ${assignments}`);

	// 2. Check joins
	console.log('\n=== Joins: instructions per role ===');
	const allGroups = await prisma.roleGroup.findMany({
		include: {
			instructions: { select: { id: true, filename: true, roleGroupId: true } },
			skills: { select: { id: true, name: true, roleGroupId: true } },
			assignments: { select: { id: true, agentId: true, roleGroupId: true } },
		},
	});
	allGroups.forEach((g) => {
		console.log(`${g.name} (${g.id})`);
		console.log(` instructions: ${g.instructions.length}`);
		g.instructions.slice(0, 2).forEach((i) => console.log(` - ${i.filename} (roleGroupId=${i.roleGroupId})`));
		console.log(` skills: ${g.skills.length}`);
		g.skills.slice(0, 2).forEach((s) => console.log(` - ${s.name} (roleGroupId=${s.roleGroupId})`));
		console.log(` agents: ${g.assignments.length}`);
	});

	// 3. Check orphans
	console.log('\n=== Orphan check ===');
	const orphanInst = await prisma.instructionFile.findMany({
		where: { roleGroup: null },
		select: { id: true, filename: true, roleGroupId: true },
	});
	console.log(`Instructions with no parent role: ${orphanInst.length}`);

	const orphanSkill = await prisma.skill.findMany({
		where: { roleGroup: null },
		select: { id: true, name: true, roleGroupId: true },
	});
	console.log(`Skills with no parent role: ${orphanSkill.length}`);

	// 4. Mismatch check
	console.log('\n=== Mismatch (id vs roleGroupId) ===');
	const mismatched = await prisma.instructionFile.findMany({
		select: { id: true, filename: true, roleGroupId: true },
	});
	const roleIds = new Set(allGroups.map((g) => g.id));
	mismatched.forEach((i) => {
		if (!roleIds.has(i.roleGroupId)) {
			console.log(`MISMATCH: instruction ${i.filename} roleGroupId=${i.roleGroupId} not in role ids`);
		}
	});
	console.log('Mismatch check complete.');
}

main()
	.catch((e) => { console.error(e); process.exit(1); })
	.finally(async () => { await prisma.$disconnect(); });
