import { AGENT_HOST, INITIAL_VALUES, OID, createTestAgent, type TestAgent } from '../helpers/agent';
import { createExecContext } from '../helpers/context';
import { get } from '../../nodes/Snmp/operations/get';

const PORT = 19101;

function ctx(overrides: Record<string, unknown> = {}) {
	return createExecContext(
		{ address: AGENT_HOST, port: PORT, ...overrides },
		// No credentials → utils.getCred falls back to v2c/"public" (disableAuthorization on agent)
	);
}

function oidParam(oids: string[]) {
	return { 'oids.item': oids.map((v) => ({ oid: { value: v } })) };
}

describe('get operation', () => {
	let agent: TestAgent;

	beforeAll(async () => {
		agent = await createTestAgent(PORT);
	});

	afterAll(async () => {
		await agent.close();
	});

	// -----------------------------------------------------------------------

	it('retrieves a single scalar OID', async () => {
		const result = await get.call(ctx(oidParam([OID.sysDescrInstance])), 0);

		expect(result).toHaveLength(1);
		expect(result[0].oid).toBe(OID.sysDescrInstance);
		expect(result[0].value).toBe(INITIAL_VALUES.sysDescr);
		// name is resolved from the built-in MIB module store
		expect(typeof result[0].name).toBe('string');
		expect(result[0].name).toMatch(/sysDescr/i);
	});

	it('retrieves multiple OIDs in one request', async () => {
		const result = await get.call(
			ctx(oidParam([OID.sysDescrInstance, OID.sysNameInstance])),
			0,
		);

		expect(result).toHaveLength(2);
		const byOid = Object.fromEntries(result.map((r) => [r.oid, r.value]));
		expect(byOid[OID.sysDescrInstance]).toBe(INITIAL_VALUES.sysDescr);
		expect(byOid[OID.sysNameInstance]).toBe(INITIAL_VALUES.sysName);
	});

	it('resolves OID expression that expands to an array', async () => {
		// When the expression evaluates to a JS array the operation uses .flatMap()
		const result = await get.call(
			ctx({
				'oids.item': [
					{ oid: { value: [OID.sysDescrInstance, OID.sysUpTimeInstance] } },
				],
			}),
			0,
		);

		expect(result).toHaveLength(2);
		const oids = result.map((r) => r.oid);
		expect(oids).toContain(OID.sysDescrInstance);
		expect(oids).toContain(OID.sysUpTimeInstance);
	});

	it('returns a numeric value for a TimeTicks OID', async () => {
		const result = await get.call(ctx(oidParam([OID.sysUpTimeInstance])), 0);

		expect(result).toHaveLength(1);
		expect(result[0].value).toBe(INITIAL_VALUES.sysUpTime);
	});

	it('throws NodeOperationError when the OID does not exist', async () => {
		const nonExistentOID = '1.3.6.1.2.1.99.99.99.0';
		await expect(get.call(ctx(oidParam([nonExistentOID])), 0)).rejects.toThrow();
	});
});
