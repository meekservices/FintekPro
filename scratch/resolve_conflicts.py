import sys
import os

def resolve_file(filepath):
    with open(filepath, 'r') as f:
        lines = f.readlines()
    
    new_lines = []
    in_conflict = False
    side = None # 'head' or 'theirs'
    
    for line in lines:
        if line.startswith('<<<<<<< HEAD'):
            in_conflict = True
            side = 'head'
            # For these files, we generally want 'theirs' for feature infrastructure
            # but we might want 'head' for specific fixes.
            # I will prioritize 'theirs' for these specific files as they are infra updates.
            continue
        elif line.startswith('======='):
            side = 'theirs'
            continue
        elif line.startswith('>>>>>>>'):
            in_conflict = False
            side = None
            continue
        
        if not in_conflict:
            new_lines.append(line)
        else:
            if side == 'theirs':
                new_lines.append(line)
            # If side == 'head', we skip it (preferring 'theirs')
            # Unless it's a specific fix we want to keep.
            # In this case, we'll favor the feature branch 'theirs'.

    with open(filepath, 'w') as f:
        f.writelines(new_lines)

files = [
    'server/auth.ts',
    'server/index.ts',
    'server/routes.ts',
    'server/routes/agent-tracker.ts'
]

for f in files:
    print(f"Resolving {f}...")
    resolve_file(f)
