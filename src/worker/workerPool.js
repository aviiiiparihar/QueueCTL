// src/worker/workerPool.js
const { randomUUID } = require('crypto');
const makeJobController = require('../controllers/jobController');

function makeWorkerPool(models, logger) {
  const controller = makeJobController(models);
  let stopping = false;
  const workers = [];

  async function start(count = 1) {
    stopping = false;
    for (let i = 0; i < count; i++) {
      const wid = `worker-${randomUUID()}`;
      const p = workerLoop(wid);
      workers.push(p);
      logger.info(`started ${wid}`);
    }
    return workers.length;
  }

  async function stop() {
    stopping = true;
    logger.info('stop requested - waiting for workers to finish their current job(s)');
    await Promise.all(workers);
    logger.info('all workers stopped');
  }

  async function workerLoop(workerId) {
    while (!stopping) {
      try {
        const job = await controller.pickPending(workerId);
        if (!job) {
          // no job: sleep a bit
          await sleep(500);
          continue;
        }
        logger.info(`[${workerId}] picked job ${job.id} - "${job.command}"`);
        const result = await controller.executeJob(job);
        const res = await controller.handleJobResult(job, result);
        logger.info(`[${workerId}] job ${job.id} => ${res.finalState}${res.nextRun ? ' next at ' + res.nextRun : ''}`);
      } catch (err) {
        logger.error('worker error', err);
        await sleep(1000);
      }
    }
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  return { start, stop };
}

module.exports = makeWorkerPool;
