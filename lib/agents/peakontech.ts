/**
 * PEAKONTECH producer agents (white-label integration, MIT bridge).
 * Each producer reads the portal's token-protected /internal/chain/status and
 * can fire pending chain runs via /internal/chain (the scheduler ping). The
 * portal owns creation, QA, proof and invoices; these agents make the operator
 * console SEE and DRIVE it. Honest statuses: without PEAKONTECH_URL + token
 * every producer reports not-configured.
 */

import type { AgentRunResult, RuntimeAgent } from '@/lib/agents/runtime';
import { runtimeEnv } from '@/lib/creds';

const base = () => (runtimeEnv().PEAKONTECH_URL || '').replace(/\/+$/, '');
const token = () => runtimeEnv().RENEWALS_TOKEN || '';
const configured = () => Boolean(base() && token());

async function status() {
  const r = await fetch(`${base()}/internal/chain/status`, { headers: { 'x-renewals-token': token() } });
  if (!r.ok) throw new Error(`chain status HTTP ${r.status}`);
  return r.json();
}

async function firePending() {
  const r = await fetch(`${base()}/internal/chain`, { method: 'POST', headers: { 'x-renewals-token': token() } });
  if (!r.ok) throw new Error(`chain ping HTTP ${r.status}`);
  return r.json() as Promise<{ picked: number; results: Array<{ ok: boolean; error?: string | null }> }>;
}

function producer(id: string, name: string, workerName: string, description: string): RuntimeAgent {
  return {
    id, name, description, departmentId: 'growth',
    configured: configured,
    async run(): Promise<AgentRunResult> {
      if (!configured()) return { ok: false, summary: 'PEAKONTECH_URL / RENEWALS_TOKEN is not configured on this host — see /setup' };
      const s = await status();
      const mine = (s.recent || []).filter((x: any) => x.worker === workerName);
      const done = mine.filter((x: any) => x.status === 'proof_submitted').length;
      const failed = mine.filter((x: any) => x.status === 'failed').length;
      const last = mine[0];
      return {
        ok: done > 0,
        summary: `${workerName}: ${done} proof-submitted, ${failed} failed${last ? ` · last: ${last.project} (${last.status})` : ' · none yet'}`,
        data: mine,
      };
    },
    respond: async (message: string): Promise<AgentRunResult> => producer(id, name, workerName, description).run(),
  };
}

export const peakontechAgents: RuntimeAgent[] = [
  producer('peakontech-seo', 'PEAKONTECH SEO auditor', 'Technical SEO auditor (auto)', 'Technical SEO audit chains: evidence-crawled, QA-checked audits'),
  producer('peakontech-content', 'PEAKONTECH content writer', 'Content creator (auto)', 'Content chains: brief-grounded articles with invented-stat QA'),
  producer('peakontech-web', 'PEAKONTECH web builder', 'Web builder (auto)', 'Web build chains: two-stage plan → responsive landing page'),
  producer('peakontech-reputation', 'PEAKONTECH reputation manager', 'Reputation manager (auto)', 'Review-response packs and monthly checklists'),
  producer('peakontech-social', 'PEAKONTECH social creator', 'Social media creator (auto)', 'Two-week social content calendars'),
  producer('peakontech-email', 'PEAKONTECH email marketer', 'Email marketer (auto)', 'Email sequences with CAN-SPAM/GDPR hygiene'),
  {
    id: 'peakontech-runner',
    name: 'PEAKONTECH chain runner',
    description: 'Fires queued PEAKONTECH agent-chain runs (the scheduler ping)',
    departmentId: 'operations',
    configured: configured,
    async run(): Promise<AgentRunResult> {
      if (!configured()) return { ok: false, summary: 'PEAKONTECH_URL / RENEWALS_TOKEN is not configured on this host — see /setup' };
      const out = await firePending();
      return { ok: true, summary: `Chain ping done — ${out.picked} pending run(s) picked`, data: out.results };
    },
    respond: async () => (await peakontechAgents[6].run()),
  },
];
