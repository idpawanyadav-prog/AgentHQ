import 'dotenv/config';
import prisma from '../lib/prisma';
import {runAgentJob} from '../lib/agent-runner';
import {startWorker} from '../lib/job-queue';
const stop=startWorker(runAgentJob);
async function shutdown() {await stop();await prisma.$disconnect();process.exit(0);}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
console.log(JSON.stringify({event:'worker_started',pid:process.pid}));
