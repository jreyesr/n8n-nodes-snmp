import { AGENT_HOST, INITIAL_VALUES, OID, createTestAgent, type TestAgent } from '../helpers/agent';
import { createExecContext } from '../helpers/context';
import { write } from '../../nodes/Snmp/operations/write';
import { get } from '../../nodes/Snmp/operations/get';

const PORT = 19104;

function writeCtx(values: { oid: string; value: unknown }[]) {
	return createExecContext({
		address: AGENT_HOST,
		port: PORT,
		'values.values': values.map(({ oid, value }) => ({ oid: { value: oid }, value })),
	});
}

function readCtx(oids: string[]) {
	return createExecContext({
		address: AGENT_HOST,
		port: PORT,
		'oids.item': oids.map((v) => ({ oid: { value: v } })),
	});
}

describe('write operation', () => {
	let agent: TestAgent;

	beforeAll(async () => {
		agent = await createTestAgent(PORT);
	});

	afterAll(async () => {
		await agent.close();
	});

	afterEach(() => {
		// Reset agent state so write tests don't bleed into each other
		agent.reset();
	});

	// -----------------------------------------------------------------------

	it('writes a new string value to a writable OID', async () => {
		const newName = 'modified-host';

		const result = await write.call(
			writeCtx([{ oid: OID.sysNameInstance, value: newName }]),
			0,
		);

		expect(result).toHaveLength(1);
		expect(result[0].oid).toBe(OID.sysNameInstance);
		// The operation echoes back the written varbinds
		expect(result[0].value).toBe(newName);
	});

	it('the written value is readable back via GET', async () => {
		const newName = 'roundtrip-host';

		await write.call(writeCtx([{ oid: OID.sysNameInstance, value: newName }]), 0);

		const readResult = await get.call(readCtx([OID.sysNameInstance]), 0);
		expect(readResult[0].value).toBe(newName);
	});

	it('write is idempotent — writing the same value twice is fine', async () => {
		const name = 'idempotent-host';

		await write.call(writeCtx([{ oid: OID.sysNameInstance, value: name }]), 0);
		const result = await write.call(
			writeCtx([{ oid: OID.sysNameInstance, value: name }]),
			0,
		);

		expect(result[0].value).toBe(name);
	});

	it('original value is restored after reset (sanity check for afterEach)', async () => {
		await write.call(writeCtx([{ oid: OID.sysNameInstance, value: 'changed' }]), 0);
		// afterEach resets — we check the initial value in the next test via GET
		const readResult = await get.call(readCtx([OID.sysNameInstance]), 0);
		// Within this test the value is still 'changed'
		expect(readResult[0].value).toBe('changed');
	});

	it('GET after reset shows original value', async () => {
		// Previous test's afterEach reset the value; confirm initial value is back
		const result = await get.call(readCtx([OID.sysNameInstance]), 0);
		expect(result[0].value).toBe(INITIAL_VALUES.sysName);
	});

	it('writes multiple OIDs in a single call', async () => {
		const newName = 'multi-write-host';
		const newContact = 'multi@example.com';

		const result = await write.call(
			writeCtx([
				{ oid: OID.sysNameInstance, value: newName },
				{ oid: OID.sysContactInstance, value: newContact },
			]),
			0,
		);

		expect(result).toHaveLength(2);
		const byOid = Object.fromEntries(result.map((r) => [r.oid, r.value]));
		expect(byOid[OID.sysNameInstance]).toBe(newName);
		expect(byOid[OID.sysContactInstance]).toBe(newContact);
	});
});
