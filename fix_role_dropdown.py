import re

with open('pages/employees.tsx', 'r') as f:
 c = f.read()

pattern = r"setFormError\(''\);\n setFormOpen\(true\);"
replacement = "setFormError('');\n try {\n const groups = (await api.getRoleGroups()) as any[];\n const data = Array.isArray(groups) ? groups : (groups?.data || []);\n setRoleGroups(data.map((g: any) => ({ id: g.id, name: g.name })));\n } catch { setRoleGroups([]); }\n setFormOpen(true);"

new_c, count = re.subn(pattern, replacement, c, count=1)
if count == 0:
 print('NO MATCH')
 # Debug: show surrounding context
 idx = c.find('setFormOpen(true)')
 if idx >= 0:
 print('Context:', repr(c[max(0,idx-100):idx+50]))
else:
 with open('pages/employees.tsx', 'w') as f:
 f.write(new_c)
 print('done')
