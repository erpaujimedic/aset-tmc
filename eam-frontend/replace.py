import os

d = 'c:/Web App Running TMC/eam -asset/eam-frontend/src/pages'
old_str = "const isAllBranch = Array.isArray(user?.branch) ? user.branch.includes('ALL') : user?.branch === 'ALL';"
new_str = "const isAllBranch = Array.isArray(user?.branch) ? (user.branch.includes('ALL') || user.branch.includes('All Branches')) : (user?.branch === 'ALL' || user?.branch === 'All Branches');"

for r, _, fs in os.walk(d):
    for f in fs:
        if f.endswith('.jsx'):
            filepath = os.path.join(r, f)
            with open(filepath, 'r', encoding='utf-8') as file:
                content = file.read()
            if old_str in content:
                content = content.replace(old_str, new_str)
                with open(filepath, 'w', encoding='utf-8') as file:
                    file.write(content)
                print('Replaced in ' + filepath)
