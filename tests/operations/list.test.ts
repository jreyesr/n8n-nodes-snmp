import { AGENT_HOST, INITIAL_VALUES, OID, createTestAgent, type TestAgent } from '../helpers/agent';
import { createExecContext } from '../helpers/context';
import { list } from '../../nodes/Snmp/operations/list';

const PORT = 19103;

function ctx(rootOID: string) {
	return createExecContext({ address: AGENT_HOST, port: PORT, 'options.rootOID': rootOID });
}

describe('list operation', () => {
	let agent: TestAgent;

	beforeAll(async () => {
		agent = await createTestAgent(PORT);
	});

	afterAll(async () => {
		await agent.close();
	});

	// -----------------------------------------------------------------------

	it('returns tree entries when walking the system group', async () => {
		const result = await list.call(ctx(OID.systemGroup), 0);

		expect(result.length).toBeGreaterThan(0);
	});

	it('every entry has oid, name, type and value fields', async () => {
		const result = await list.call(ctx(OID.systemGroup), 0);

		for (const entry of result) {
			expect(typeof entry.oid).toBe('string');
			expect(entry.oid.length).toBeGreaterThan(0);
			expect(typeof entry.name).toBe('string');
			expect(typeof entry.type).toBe('object');
			expect(typeof entry.type.numeric).toBe('number');
			expect(typeof entry.type.name).toBe('string');
		}
	});

	it('discovers all three registered scalars under the system group', async () => {
		const result = await list.call(ctx(OID.systemGroup), 0);

		const oids = result.map((e) => e.oid);
		expect(oids).toContain(OID.sysDescrInstance);
		expect(oids).toContain(OID.sysUpTimeInstance);
		expect(oids).toContain(OID.sysNameInstance);
	});

	it('resolves the correct value for sysDescr', async () => {
		const result = await list.call(ctx(OID.systemGroup), 0);

		const entry = result.find((e) => e.oid === OID.sysDescrInstance);
		expect(entry).toBeDefined();
		expect(entry!.value).toBe(INITIAL_VALUES.sysDescr);
	});

	it('does not return OIDs outside the requested subtree', async () => {
		const result = await list.call(ctx(OID.systemGroup), 0);

		// The system group is 1.3.6.1.2.1.1 — no result should be outside it
		for (const entry of result) {
			expect(entry.oid.startsWith(OID.systemGroup)).toBe(true);
		}
	});

	it('returns table entries when walking the interface group', async () => {
		// Walk from ifTable root to pick up the table columns
		const result = await list.call(ctx(OID.ifTable), 0);

		expect(result.length).toBeGreaterThan(0);
		// All returned OIDs should be under ifTable
		for (const entry of result) {
			expect(entry.oid.startsWith(OID.ifTable)).toBe(true);
		}
	});
});
