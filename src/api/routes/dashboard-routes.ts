import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance, FastifyReply } from 'fastify';

const dashboardDirectory = path.resolve(process.cwd(), 'dashboard');

async function sendAsset(reply: FastifyReply, filename: string, contentType: string) {
  const content = await readFile(path.join(dashboardDirectory, filename));
  return reply.type(contentType).header('Cache-Control', 'no-cache').send(content);
}

export async function registerDashboardRoutes(app: FastifyInstance) {
  app.get('/', async (_request, reply) => reply.redirect('/dashboard'));
  app.get('/dashboard', async (_request, reply) => sendAsset(reply, 'index.html', 'text/html; charset=utf-8'));
  app.get('/dashboard/app.css', async (_request, reply) => sendAsset(reply, 'app.css', 'text/css; charset=utf-8'));
  app.get('/dashboard/app.js', async (_request, reply) => sendAsset(reply, 'app.js', 'text/javascript; charset=utf-8'));
}
