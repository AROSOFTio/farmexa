import re

def count_tags(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Simple regex for opening and closing tags
    # This is naive but might help find obvious mismatches
    opening_tags = re.findall(r'<([a-zA-Z0-9]+)(?:\s+[^>]*[^/])?>', content)
    closing_tags = re.findall(r'</([a-zA-Z0-9]+)>', content)
    
    counts = {}
    for tag in opening_tags:
        counts[tag] = counts.get(tag, 0) + 1
    for tag in closing_tags:
        counts[tag] = counts.get(tag, 0) - 1
    
    for tag, count in counts.items():
        if count != 0:
            print(f"Tag <{tag}> mismatch: {count}")

count_tags('d:/systems/bantudefdig/frontend/src/features/developer_admin/TenantsPage.tsx')
