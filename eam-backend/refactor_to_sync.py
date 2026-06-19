import os
import glob
import re

def refactor_to_sync():
    router_files = glob.glob(os.path.join('app', 'routers', '*.py'))
    
    for file_path in router_files:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Add import asyncio if needed and if it contains FastAPICache.clear
        if 'FastAPICache.clear' in content and 'import asyncio' not in content:
            content = 'import asyncio\n' + content
            
        # Replace async def with def
        content = re.sub(r'\basync def\b', 'def', content)
        
        # Replace await file.read() with file.file.read()
        content = re.sub(r'await\s+([a-zA-Z0-9_]+)\.read\(\)', r'\1.file.read()', content)
        
        # Replace await FastAPICache.clear with asyncio.run(FastAPICache.clear)
        content = re.sub(r'await\s+(FastAPICache\.clear\([^)]*\))', r'asyncio.run(\1)', content)
        
        # Also need to replace await FastAPICache.clear() without arguments
        content = re.sub(r'await\s+(FastAPICache\.clear\(\))', r'asyncio.run(\1)', content)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Refactored {file_path}")

if __name__ == '__main__':
    refactor_to_sync()
