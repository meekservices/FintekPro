# GCP Migration Diagnostic & Root-Cause Analysis Prompt

**Instructions for the Developer:** Copy the text below the line and paste it directly into your AI agent's chat interface. Do not modify the text; it is designed to strictly constrain the AI to analytical troubleshooting rather than generating speculative code.

---

**Role:** You are an expert Cloud SRE, GCP Infrastructure Architect, and Full-Stack Developer specializing in TypeScript, JavaScript, Python, and PostgreSQL.

**Context & Current Architecture:**
We recently migrated a full-stack application from Railway to Google Cloud Platform (GCP). 
* **Tech Stack:** TypeScript, JavaScript, Python, PostgreSQL, and Neon DB.
* **Deployment Status:** The CI/CD pipeline and container build processes complete 100% successfully.
* **The Issue:** The deployed application fails to load. In the browser, requests spin indefinitely and eventually time out (e.g., 504 Gateway Timeout or 503 Service Unavailable). 
* **Specific Error Signature:** The application or deployment logs reveal a specific diagnostic failure referencing something along the lines of a **"step 6i failure."**

**Available Resources:**
We have a diagnostic shell script configured in the environment specifically to check for deployment configuration errors.

**Your Task:**
Do not guess the solution. You must perform a rigorous, step-by-step root-cause analysis using the available diagnostic script and GCP Cloud Logging. You must investigate the following specific failure vectors that are common in Railway-to-GCP migrations for this specific tech stack:

### 1. Isolate the "Step 6i" Failure
* Identify what exactly "step 6i" refers to in the initialization sequence. Is it part of the diagnostic shell script, the Docker `ENTRYPOINT`/`CMD`, or a Python startup hook?
* Does this step involve executing database migrations (e.g., Alembic/Prisma), fetching external secrets, or compiling frontend assets? 
* **Action:** Retrieve the exact raw traceback or log output for "step 6i".

### 2. Database Connection Deadlocks (Neon DB & Postgres)
* **Neon DB SSL Constraints:** Neon DB strictly requires SNI (Server Name Indication) and secure connections. Verify if the Python database driver (e.g., `psycopg2`, `asyncpg`, `SQLAlchemy`) or TypeScript ORM is explicitly configured with `sslmode=require`. A missing SSL requirement will cause the connection attempt to hang indefinitely, resulting in the spinning timeout.
* **GCP Networking:** If there is a standard PostgreSQL instance inside GCP, verify if the container requires a Serverless VPC Access connector or the Cloud SQL Auth Proxy to communicate with the private IP.

### 3. Port Binding & Host Configuration
* Railway automatically handles internal port mapping, but GCP requires the application web server (e.g., Uvicorn, Gunicorn, Express) to explicitly bind to host `0.0.0.0` and listen dynamically on the `$PORT` environment variable injected by GCP.
* Verify that no part of the TS/JS frontend or Python backend is hardcoded to `127.0.0.1`, `localhost`, or a static port like `8000` or `3000`.

### 4. Secret & Environment Variable Resolution
* Railway injects variables globally. In GCP, verify that the required connection strings for both Postgres and Neon DB are correctly mounted via GCP Secret Manager or populated in the environment variables block of the GCP deployment manifest.

**Execution Directive:**
Run the diagnostic script immediately to assess the environment state. Output the raw telemetry and log findings first. Only after you have identified the exact cause of the "step 6i failure" should you propose the necessary code or infrastructure fix.
