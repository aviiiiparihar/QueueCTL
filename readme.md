# QueueCTL — CLI-Based Background Job Queue System (Node.js + MongoDB)

Lightweight, production-style CLI background job queue built with Node.js and MongoDB using an MVC-like structure.

## Features
- Background job execution
- Multiple workers (parallel)
- Exponential backoff retries
- Dead Letter Queue (DLQ)
- Persistent storage (MongoDB)
- Configurable retry settings
- Windows-friendly CLI commands

---

## 1. Prerequisites (Windows)
- Node.js ≥ 18
- MongoDB Community Server (running locally)
- Local MongoDB URL: `mongodb://localhost:27017`
- Database: `queuectl_db` (must exist)
- Collections: `jobs`, `dlq`, `config` (must exist)

---

## 2. Setup
1. Install dependencies:
   ```
   npm install
   ```

2. Verify MongoDB (PowerShell):
   ```
   mongosh
   use queuectl_db
   show collections
   ```
   Expected collections: `jobs`, `dlq`, `config`

3. Run CLI (root of project):
   ```
   node src/cli/index.js <command>
   ```

---

## 3. Usage Examples (Windows)

Enqueue a job — Windows-safe quoting:
```
node src/cli/index.js enqueue "{'id':'job1','command':'echo Hello','max_retries':3}"
```

Enqueue from JSON file (recommended)
- job.json:
```json
{
  "id": "job1",
  "command": "echo Hello",
  "max_retries": 3
}
```
- Run:
```
node src/cli/index.js enqueue job.json
```

Start workers (2 parallel workers):
```
node src/cli/index.js worker start --count 2
```
Stop workers: Ctrl + C

List jobs:
```
node src/cli/index.js list
```
Filter by state:
```
node src/cli/index.js list --state pending
```

Queue status:
```
node src/cli/index.js status
```

Dead Letter Queue:
- List DLQ:
  ```
  node src/cli/index.js dlq:list
  ```
- Retry DLQ job:
  ```
  node src/cli/index.js dlq:retry job1
  ```

Config management:
- Set config:
  ```
  node src/cli/index.js config:set max_retries 5
  node src/cli/index.js config:set backoff_base 2
  ```
- Get config:
  ```
  node src/cli/index.js config:get max_retries
  ```

---

## 4. Architecture Overview

Folder structure (key files)
```
src/
 ├── db.js                 # MongoDB connection
 ├── models/
 │    ├── Job.js
 │    ├── DLQ.js
 │    └── Config.js
 ├── controllers/
 │    └── jobController.js  # enqueue, retry, backoff, DLQ logic
 ├── worker/
 │    └── workerPool.js     # worker loops, parallel workers
 ├── cli/
 │    └── index.js          # CLI commands (commander)
 └── utils/
      └── logger.js
```

Job lifecycle states:
- pending — waiting to be picked
- processing — worker executing
- completed — finished successfully
- failed — retry scheduled
- dead — moved to DLQ

Worker behavior:
- Picks oldest job where `state = pending AND next_run_at <= now`
- Executes command via `child_process.exec`
- On success → remove job
- On failure → increment attempts, schedule retry using exponential backoff:
  ```
  delay_seconds = base ^ attempts
  ```
- If attempts > `max_retries` → move to DLQ

Data persistence:
- `jobs` — active + retryable jobs
- `dlq` — permanently failed jobs
- `config` — system-wide settings (e.g., `max_retries`, `backoff_base`)

---

## 5. Assumptions & Trade-offs
Assumptions:
- Windows PowerShell/CMD environment
- MongoDB always running
- JSON files supported for enqueue

Trade-offs:
- Single-process workers (not distributed)
- No job priority system
- CLI only (no UI)
- No per-job timeout (can be added)
- Minimal logging for simplicity

---

## 6. Testing Instructions

Test 1 — Basic success:
```
node src/cli/index.js enqueue "{'id':'test1','command':'echo hi'}"
node src/cli/index.js worker start --count 1
```
Expected:
```
[INFO] picked job test1
[INFO] job test1 => completed
```

Test 2 — Retry & DLQ:
```
node src/cli/index.js enqueue "{'id':'fail1','command':'powershell -Command \"exit 1\"','max_retries':2}"
node src/cli/index.js worker start --count 1
node src/cli/index.js dlq:list
```

Test 3 — Persistence:
- Enqueue job, close terminal, re-open and run:
```
node src/cli/index.js list
```
Job should still be present.

Test 4 — Parallel workers:
```
node src/cli/index.js worker start --count 3
```

---

## Notes
- Use JSON files for complex commands to avoid shell quoting issues on Windows.
- Adjust `config` settings for system-wide behavior.
- Add job timeouts or a UI as needed for production use.

---

## 📬 Contact

Vaidik Singh Parihar  
GitHub: https://github.com/aviiiiparihar