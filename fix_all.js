const fs = require('fs');
let c = fs.readFileSync('pages/employees.tsx', 'utf8');

// 1. Update useEffect to also load role groups
c = c.replace(
 `const data = (await api.getTeams()) as { teams: Team[] };`,
 `const [data, groups] = await Promise.all([
 api.getTeams() as Promise<{ teams: Team[] }>,
 api.getRoleGroups().catch(() => []),
 ]);`
);

c = c.replace(
 `const allMembers = teamsData.flatMap((t) => t.members || []);\n setMembers(allMembers);\n if (allMembers.length > 0) {`,
 `const allMembers = teamsData.flatMap((t) => t.members || []);
 setMembers(allMembers);
 const groupsArr = Array.isArray(groups) ? groups : (groups?.data || []);
 setRoleGroups(groupsArr.map((g: any) => ({ id: g.id, name: g.name })));
 if (allMembers.length > 0) {`
);

// 2. Update edit button to be async (only load role groups if empty)
const editBtn = `onClick={(e) => {
 e.stopPropagation();
 setEditingMember(member);
 setFormName(member.name);
 setFormRole(member.type === "human" ? "Team Lead" : member.role);
 setFormType(member.type);
 setFormTeam(teamName(member.teamId));
 setFormError("");
 setFormOpen(true);
}}`;

const editBtnNew = `onClick={async (e) => {
 e.stopPropagation();
 setEditingMember(member);
 setFormName(member.name);
 setFormRole(member.type === "human" ? "Team Lead" : member.role);
 setFormType(member.type);
 setFormTeam(teamName(member.teamId));
 setFormError("");
 if (member.type === "ai" && roleGroups.length === 0) {
 try {
 const groups = (await api.getRoleGroups()) as any[];
 const data = Array.isArray(groups) ? groups : (groups?.data || []);
 setRoleGroups(data.map((g: any) => ({ id: g.id, name: g.name })));
 } catch { setRoleGroups([]); }
 }
 setFormOpen(true);
}}`;

c = c.replace(editBtn, editBtnNew);

fs.writeFileSync('pages/employees.tsx', c);
console.log('All edits done');
