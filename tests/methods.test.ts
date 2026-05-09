import { AGENT_HOST, OID, createTestAgent, type TestAgent } from './helpers/agent';
import { createExecContext } from './helpers/context';
import { listOIDsInDefaultTree } from '../nodes/Snmp/methods';

const PORT = 19107;

function ctx(overrides: Record<string, unknown> = {}) {
	return createExecContext({ address: AGENT_HOST, port: PORT, ...overrides });
}

describe('listOIDsInDefaultTree (listSearch method)', () => {
	let agent: TestAgent;

	beforeAll(async () => {
		agent = await createTestAgent(PORT);
	});

	afterAll(async () => {
		await agent.close();
	});

	it('returns OIDs from the default MIB-2 subtree', async () => {
		const result = await listOIDsInDefaultTree.call(ctx(), undefined);

		expect(result.results.length).toBeGreaterThan(0);
		// Every result should have a name and a value (the OID)
		for (const r of result.results) {
			expect(typeof r.name).toBe('string');
			expect(typeof r.value).toBe('string');
		}
	});

	it('result entries include registered OIDs', async () => {
		const result = await listOIDsInDefaultTree.call(ctx(), undefined);

		const oids = result.results.map((r) => r.value);
		expect(oids).toContain(OID.sysDescrInstance);
		expect(oids).toContain(OID.sysNameInstance);
	});

	it('filters by OID substring', async () => {
		const result = await listOIDsInDefaultTree.call(ctx(), OID.sysDescrInstance);

		// All returned entries must match the filter
		for (const r of result.results) {
			const nameOrOid = r.name.toLowerCase() + String(r.value).toLowerCase();
			expect(nameOrOid).toContain(OID.sysDescrInstance.toLowerCase());
		}
	});

	it('filters by name substring (case-insensitive)', async () => {
		const result = await listOIDsInDefaultTree.call(ctx(), 'sysdescr');

		expect(result.results.length).toBeGreaterThan(0);
		for (const r of result.results) {
			const nameOrOid = r.name.toLowerCase() + String(r.value).toLowerCase();
			expect(nameOrOid).toContain('sysdescr');
		}
	});

	it('returns empty array when filter matches nothing', async () => {
		const result = await listOIDsInDefaultTree.call(ctx(), 'zzz-no-match-zzz');

		expect(result.results).toHaveLength(0);
	});

	it('respects a custom rootOID option', async () => {
		// Restrict walk to sysDescr subtree only
		const result = await listOIDsInDefaultTree.call(
			ctx({ 'options.rootOID': OID.sysDescr }),
			undefined,
		);

		// Should only contain sysDescr.0
		expect(result.results.length).toBeGreaterThan(0);
		for (const r of result.results) {
			expect(String(r.value).startsWith(OID.sysDescr)).toBe(true);
		}
	});

	it('session is closed after the call (no resource leak)', async () => {
		// Make multiple calls — if sessions leak, the agent's socket table fills up
		// and subsequent calls start failing. Ten calls is enough to catch a simple leak.
		for (let i = 0; i < 10; i++) {
			await listOIDsInDefaultTree.call(ctx(), undefined);
		}
		// If we reach here without errors, sessions are being closed properly
	});
});
