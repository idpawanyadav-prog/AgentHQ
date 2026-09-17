import type { NormalizedToolResult } from '../agent-tools/types';

export type ProposalRecord = {
	id: string;
	toolName: string;
	arguments: Record<string, unknown>;
	context: Record<string, unknown>;
	result: NormalizedToolResult;
	createdAt: Date;
	ttlMs: number;
};

const store = new Map<string, ProposalRecord>();

export function recordProposal(record: Omit<ProposalRecord, 'id'> & { id?: string }): ProposalRecord {
	const id = record.id ?? `proposal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
	const entry: ProposalRecord = { ...record, id };
	store.set(id, entry);
	return entry;
}

export function getProposal(id: string): ProposalRecord | undefined {
	const entry = store.get(id);
	if (!entry) return undefined;
	if (!entry.createdAt || typeof (entry.createdAt as Date).getTime !== 'function') {
		store.delete(id);
		return undefined;
	}
	if (Date.now() - (entry.createdAt as Date).getTime() > entry.ttlMs) {
		store.delete(id);
		return undefined;
	}
	return entry;
}

export function consumeProposal(id: string): ProposalRecord | undefined {
	const entry = getProposal(id);
	if (entry) store.delete(id);
	return entry;
}

export function cleanupExpired(): void {
	const now = Date.now();
	for (const [id, entry] of store) {
		if (!entry || !entry.createdAt || typeof (entry.createdAt as Date).getTime !== 'function') {
			store.delete(id);
			continue;
		}
		if (now - (entry.createdAt as Date).getTime() > entry.ttlMs) store.delete(id);
	}
}

setInterval(cleanupExpired, 60_000);
