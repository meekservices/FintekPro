import os, json

env_dict = {}
with open(".env", "r") as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, val = line.split("=", 1)
            if val.startswith("\"") and val.endswith("\""):
                val = val[1:-1]
            elif val.startswith("\'") and val.endswith("\'"):
                val = val[1:-1]
            env_dict[key] = val

if "DATABASE_URL" in env_dict and "PRODUCTION_DATABASE_URL" not in env_dict:
    env_dict["PRODUCTION_DATABASE_URL"] = env_dict["DATABASE_URL"]

if "PORT" in env_dict:
    del env_dict["PORT"]

with open("cloudrun-env.yaml", "w") as f:
    for k, v in env_dict.items():
        f.write(f"{k}: {json.dumps(v)}\n")

print("Created cloudrun-env.yaml")
