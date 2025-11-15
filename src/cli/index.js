#!/usr/bin/env node
// src/cli/index.js
const { Command } = require('commander');
const { connect, mongoose } = require('../db');
const makeWorkerPool = require('../worker/workerPool');
const makeJobController = require('../controllers/jobController');
const logger = require('../utils/logger');

const program = new Command();

async function boot() {
  await connect();
  const Job = require('../models/Job')(mongoose);
  const DLQ = require('../models/DLQ')(mongoose);
  const Config = require('../models/Config')(mongoose);
  const models = { Job, DLQ, Config };
  const controller = makeJobController(models);
  const workerPool = makeWorkerPool(models, logger);

  // CLI commands
  program
    .name('queuectl')
    .description('CLI job queue (minimal MVC)')
    .version('0.1.0');

  program
    .command('enqueue')
    .argument('<jsonString>')
    .description('Enqueue a job JSON string. Example: \'{"id":"job1","command":"echo hi"}\'')
    .action(async (jsonString) => {
      try {
        const obj = JSON.parse(jsonString);
        const id = await controller.enqueue(obj);
        console.log('enqueued', id);
        process.exit(0);
      } catch (err) {
        console.error('enqueue failed:', err.message);
        process.exit(1);
      }
    });

  program
    .command('list')
    .option('--state <state>', 'state filter')
    .description('List jobs by state')
    .action(async (opts) => {
      const rows = await controller.list(opts.state);
      console.table(rows.map(r => ({
        id: r.id, state: r.state, attempts: r.attempts, max_retries: r.max_retries, command: r.command, next_run_at: r.next_run_at
      })));
      process.exit(0);
    });

  program
    .command('status')
    .description('Show queue status')
    .action(async () => {
      const s = await controller.status();
      console.log('Job counts by state:', s.byState);
      process.exit(0);
    });

  program
    .command('worker')
    .description('Worker management')
    .command('start')
    .option('--count <n>', 'worker count', parseInt, 1)
    .action(async (opts) => {
      await workerPool.start(opts.count || 1);

      // graceful shutdown
      process.on('SIGINT', async () => {
        logger.info('SIGINT received - stopping workers');
        await workerPool.stop();
        process.exit(0);
      });
      process.on('SIGTERM', async () => {
        logger.info('SIGTERM received - stopping workers');
        await workerPool.stop();
        process.exit(0);
      });
    });

  program
    .command('worker:stop')
    .description('Stop workers (if running in same process). For this simple CLI, send SIGINT to stop.')
    .action(() => {
      console.log('If workers are running in foreground, send CTRL+C. This command is a placeholder for orchestration.');
      process.exit(0);
    });

  program
    .command('dlq:list')
    .description('List DLQ entries')
    .action(async () => {
      const rows = await controller.dlqList();
      console.table(rows.map(r => ({ id: r.id, moved_at: r.moved_at, reason: r.reason })));
      process.exit(0);
    });

  program
    .command('dlq:retry')
    .argument('<jobId>')
    .description('Retry a DLQ job by job id')
    .action(async (jobId) => {
      try {
        await controller.dlqRetry(jobId);
        console.log('requeued', jobId);
        process.exit(0);
      } catch (err) {
        console.error('retry failed:', err.message);
        process.exit(1);
      }
    });

  program
    .command('config:set')
    .argument('<key>')
    .argument('<value>')
    .description('Set configuration (max_retries, backoff_base)')
    .action(async (key, value) => {
      let parsed = value;
      try { parsed = JSON.parse(value); } catch {}
      await controller.setConfig(key, parsed);
      console.log('config set', key, parsed);
      process.exit(0);
    });

  program
    .command('config:get')
    .argument('<key>')
    .description('Get config')
    .action(async (key) => {
      const val = await controller.getConfig(key, null);
      console.log(key, val);
      process.exit(0);
    });

  program.parseAsync(process.argv);

  // If no args, show help
  if (process.argv.length <= 2) {
    program.help();
  }
}

boot().catch(err => {
  console.error('Failed to start CLI:', err);
  process.exit(1);
});
