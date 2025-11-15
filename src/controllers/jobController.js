// src/controllers/jobController.js
const { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');

function makeJobController(models) {
  const { Job, DLQ, Config } = models;

  async function getConfig(key, fallback) {
    const doc = await Config.findOne({ key }).lean();
    return doc ? doc.value : fallback;
  }

  async function setConfig(key, value) {
    return Config.findOneAndUpdate({ key }, { value }, { upsert: true, new: true });
  }

  async function enqueue(jobObj) {
    const id = jobObj.id || uuidv4();
    const doc = {
      id,
      command: jobObj.command,
      max_retries: jobObj.max_retries ?? (await getConfig('max_retries', 3)),
      state: 'pending',
      attempts: jobObj.attempts ?? 0,
      created_at: jobObj.created_at ? new Date(jobObj.created_at) : new Date(),
      updated_at: new Date(),
      next_run_at: new Date()
    };
    await Job.findOneAndUpdate({ id }, doc, { upsert: true, new: true });
    return id;
  }

  async function list(state) {
    const q = state ? { state } : {};
    return Job.find(q).sort({ created_at: 1 }).lean();
  }

  async function status() {
    const agg = await Job.aggregate([
      { $group: { _id: "$state", count: { $sum: 1 } } }
    ]);
    const workersCount = 0; // CLI-managed; worker reports available separately (simple impl)
    const byState = {};
    agg.forEach(r => byState[r._id] = r.count);
    return { byState, workersCount };
  }

  // Atomically pick one pending job that is due
  async function pickPending(workerId) {
    const now = new Date();
    const job = await Job.findOneAndUpdate(
      { state: 'pending', next_run_at: { $lte: now } },
      { $set: { state: 'processing', worker_id: workerId, updated_at: new Date() } },
      { sort: { created_at: 1 }, returnDocument: 'after' }
    );
    return job;
  }

  // execute command and handle result
  async function executeJob(job) {
    return new Promise((resolve) => {
      const child = exec(job.command, { timeout: 0 }, async (err, stdout, stderr) => {
        if (err) {
          resolve({ success: false, code: err.code ?? 1, stdout, stderr, err });
        } else {
          resolve({ success: true, code: 0, stdout, stderr });
        }
      });
    });
  }

  async function handleJobResult(job, result) {
    const base = await getConfig('backoff_base', 2);
    const attempts = (job.attempts ?? 0) + 1;
    const maxRetries = job.max_retries ?? (await getConfig('max_retries', 3));

    if (result.success) {
      await Job.deleteOne({ _id: job._id }); // remove on success
      await Job.db.collection('jobs').deleteOne({ _id: job._id }); // ensure
      // Optionally, we could move to a history collection
      return { finalState: 'completed' };
    } else {
      if (attempts >= maxRetries) {
        // move to DLQ
        await DLQ.create({ id: job.id, original: job, reason: result.err ? result.err.message : result.stderr });
        await Job.deleteOne({ _id: job._id });
        return { finalState: 'dead' };
      } else {
        const delaySeconds = Math.pow(base, attempts);
        const nextRun = new Date(Date.now() + delaySeconds * 1000);
        await Job.findByIdAndUpdate(job._id, {
          $set: {
            state: 'pending',
            updated_at: new Date(),
            next_run_at: nextRun,
            last_error: (result.err ? result.err.message : result.stderr) || String(result.code || 'error'),
            attempts
          }
        });
        return { finalState: 'failed', nextRun };
      }
    }
  }

  async function dlqList() {
    return DLQ.find({}).sort({ moved_at: -1 }).lean();
  }

  async function dlqRetry(dlqId) {
    const entry = await DLQ.findOne({ id: dlqId });
    if (!entry) throw new Error('DLQ entry not found');
    const original = entry.original;
    original.attempts = 0;
    original.state = 'pending';
    original.next_run_at = new Date();
    await Job.create(original);
    await DLQ.deleteOne({ id: dlqId });
    return true;
  }

  return {
    enqueue, list, status, pickPending, executeJob, handleJobResult, getConfig, setConfig, dlqList, dlqRetry
  };
}

module.exports = makeJobController;
