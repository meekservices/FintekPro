with open('server/index.ts', 'r') as f:
    lines = f.readlines()

stack = []
for i, line in enumerate(lines):
    line_no = i + 1
    for char in line:
        if char == '{':
            stack.append(line_no)
        elif char == '}':
            if stack:
                start_line = stack.pop()
                if start_line > 2500 or line_no > 2500:
                    print(f"Matched: {start_line} -> {line_no}")
            else:
                print(f"Extra closing brace at {line_no}")

if stack:
    print("Unclosed braces:")
    for l in stack:
        print(f"  {l}: {lines[l-1].strip()}")
