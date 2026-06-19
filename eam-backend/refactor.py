import re

with open("app/routers/movements.py", "r") as f:
    content = f.read()

# Replace .eq("tracking_code", variable) with .like("tracking_code", f"{variable}%")
content = re.sub(
    r'\.eq\("tracking_code", ([a-zA-Z_.]+)\)',
    r'.like("tracking_code", f"{\1}%")',
    content
)

# Replace the insert generation in /dispatch and /borrow
# We will just replace `"tracking_code": tracking_code,`
# Wait, let's be more specific.
content = content.replace(
    '"tracking_code": tracking_code,',
    '"tracking_code": f"{tracking_code}-{i+1}" if len(asset_id_list) > 1 else tracking_code,'
)

content = content.replace(
    'for aid in asset_id_list:',
    'for i, aid in enumerate(asset_id_list):'
)

with open("app/routers/movements.py", "w") as f:
    f.write(content)

print("Done")
