import os
import glob
import libcst as cst

class SupabaseAwaitTransformer(cst.CSTTransformer):
    def leave_Call(self, original_node: cst.Call, updated_node: cst.Call):
        if isinstance(updated_node.func, cst.Attribute):
            method_name = updated_node.func.attr.value
            async_methods = {
                'execute', 
                'upload', 
                'get_public_url', 
                'create_user', 
                'update_user', 
                'delete_user', 
                'generate_link', 
                'update_user_by_id',
                'admin_list_users'
            }
            if method_name in async_methods or (method_name == 'list_users'):
                return cst.Await(expression=updated_node)
        return updated_node

def main():
    router_files = glob.glob(os.path.join('app', 'routers', '*.py'))
    other_files = [
        os.path.join('app', 'services', 'cron_jobs.py'),
        os.path.join('app', 'services', 'async_upload.py')
    ]
    all_files = router_files + other_files
    
    for file_path in all_files:
        if not os.path.exists(file_path): continue
        with open(file_path, 'r', encoding='utf-8') as f:
            source = f.read()
        
        tree = cst.parse_module(source)
        transformer = SupabaseAwaitTransformer()
        modified_tree = tree.visit(transformer)
        
        new_source = modified_tree.code
        
        while 'await await' in new_source:
            new_source = new_source.replace('await await', 'await')
            
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_source)
        print(f"Refactored {file_path}")

if __name__ == '__main__':
    main()
