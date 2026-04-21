import re

with open('server/index.ts', 'r') as f:
    content = f.read()

# Very basic try/catch/finally checker
# Tracks nesting levels of try blocks
lines = content.split('\n')
stack = [] # stores line numbers of 'try' starts

for i, line in enumerate(lines):
    line_no = i + 1
    # Find 'try {'
    if re.search(r'try\s*\{', line):
        stack.append(line_no)
    
    # Find '} catch' or '} finally'
    # This is tricky because of nested blocks.
    # We should really be tracking brace depth.
    
# Let's try brace depth approach instead.
stack = [] # stores (line_no, type)
brace_depth = 0
try_at_depth = {} # depth -> line_no of try

for i, line in enumerate(lines):
    line_no = i + 1
    for char in line:
        if char == '{':
            brace_depth += 1
            if re.search(r'try\s*\{', line):
                 try_at_depth[brace_depth] = line_no
        elif char == '}':
            if brace_depth in try_at_depth:
                # We just closed the try block. 
                # Does the next token start catch or finally?
                # We'll check the rest of the line or next lines.
                pass
            brace_depth -= 1

# Actually, let's just search for orphaned tries.
# A try MUST be followed by catch or finally after its closing brace.
