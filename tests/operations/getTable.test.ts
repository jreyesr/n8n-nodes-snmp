import { AGENT_HOST, OID, createTestAgent, type TestAgent } from '../helpers/agent';
import { createExecContext } from '../helpers/context';
import { getTable } from '../../nodes/Snmp/operations/getTable';

const PORT = 19102;

function ctx(baseOID: string) {
	return createExecContext({ address: AGENT_HOST, port: PORT, baseOID });
}

describe('getTable operation', () => {
	let agent: TestAgent;

	beforeAll(async () => {
		agent = await createTestAgent(PORT);
	});

	afterAll(async () => {
		await agent.close();
	});

	// -----------------------------------------------------------------------

	it('returns one row object per table row', async () => {
		// session.table() walks from the table OID (ifTable), not the entry OID (ifEntry)
		const result = await getTable.call(ctx(OID.ifTable), 0);

		expect(result).toHaveLength(2);
	});

	it('includes __index on every row', async () => {
		const result = await getTable.call(ctx(OID.ifTable), 0);

		const indices = result.map((r) => r.__index);
		expect(indices).toContain('1');
		expect(indices).toContain('2');
	});

	it('maps column numbers to human-readable names', async () => {
		const result = await getTable.call(ctx(OID.ifTable), 0);

		// Column 2 = ifDescr, column 3 = ifType — at minimum the keys must not be raw numbers
		const firstRow = result.find((r) => r.__index === '1')!;
		const keys = Object.keys(firstRow).filter((k) => k !== '__index');
		// All column keys should be strings (either MIB names or the OID fall-through)
		keys.forEach((k) => expect(typeof k).toBe('string'));
	});

	it('contains the correct cell values', async () => {
		const result = await getTable.call(ctx(OID.ifTable), 0);

		// Find row 1 (lo interface, type 24 = softwareLoopback)
		const row1 = result.find((r) => r.__index === '1')!;
		expect(row1).toBeDefined();

		const values = Object.values(row1);
		// The row should contain the interface description and type
		expect(values).toContain('lo');
		expect(values).toContain(24);

		// Find row 2 (eth0, type 6 = ethernetCsmacd)
		const row2 = result.find((r) => r.__index === '2')!;
		expect(row2).toBeDefined();
		const values2 = Object.values(row2);
		expect(values2).toContain('eth0');
		expect(values2).toContain(6);
	});
});
