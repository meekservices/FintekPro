with open('server/index.ts', 'r') as f:
    lines = f.readlines()

stack = []
for i, line in enumerate(lines):
    line_no = i + 1
    for char_pos, char in enumerate(line):
        if char == '{':
            stack.append((line_no, line.strip()))
        elif char == '}':
            if stack:
                stack.pop()
            else:
                print(f"ERROR: Extra closing brace at line {line_no}: {line.strip()}")

if stack:
    print("ERROR: Unclosed braces found:")
    for line_no, content in stack:
        print(f"  Line {line_no}: {content}")
else:
    print("SUCCESS: All braces are balanced.")
