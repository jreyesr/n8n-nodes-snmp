import type { IExecuteFunctions } from 'n8n-workflow';
import { AGENT_HOST, OID, createTestAgent, type TestAgent } from './helpers/agent';
import { createExecContext } from './helpers/context';
import { Snmp } from '../nodes/Snmp/Snmp.node';

const PORT = 19108;

function execCtx(params: Record<string, unknown>, continueOnFail = false) {
	const base = createExecContext({ address: AGENT_HOST, port: PORT, ...params });
	return { ...base, continueOnFail: () => continueOnFail } as unknown as IExecuteFunctions;
}

describe('Snmp node execute()', () => {
	let agent: TestAgent;
	const node = new Snmp();

	beforeAll(async () => {
		agent = await createTestAgent(PORT);
	});

	afterAll(async () => {
		await agent.close();
	});

	describe('continueOnFail', () => {
		it('propagates error when continueOnFail is false', async () => {
			const ctx = execCtx({
				operation: 'get',
				'oids.item': [{ oid: { value: '1.3.6.1.2.1.99.99.99.0' } }],
			});

			await expect(node.execute.call(ctx)).rejects.toThrow();
		});

		it('returns error item instead of throwing when continueOnFail is true', async () => {
			const ctx = execCtx(
				{
					operation: 'get',
					'oids.item': [{ oid: { value: '1.3.6.1.2.1.99.99.99.0' } }],
				},
				true,
			);

			const result = await node.execute.call(ctx);
			expect(result).toHaveLength(1);
			expect(result[0]).toHaveLength(1);
			expect(result[0][0].error).toBeDefined();
		});

		it('continues to process subsequent items after a failed item', async () => {
			// Two input items: first triggers an error, second succeeds.
			// We override getInputData to return two items.
			const ctx = execCtx(
				{
					operation: 'get',
					'oids.item': [{ oid: { value: '1.3.6.1.2.1.99.99.99.0' } }],
				},
				true,
			) as IExecuteFunctions;

			// Provide two input items so the for-loop runs twice
			const twoItems = [
				{ json: { item: 0 }, pairedItem: { item: 0 } },
				{ json: { item: 1 }, pairedItem: { item: 1 } },
			];
			const ctxWith2Items = {
				...ctx,
				getInputData: () => twoItems,
			} as unknown as IExecuteFunctions;

			const result = await node.execute.call(ctxWith2Items);
			// Both items failed (same invalid OID), both should produce error items
			expect(result[0]).toHaveLength(2);
			expect(result[0][0].error).toBeDefined();
			expect(result[0][1].error).toBeDefined();
		});

		it('successful operation still works normally', async () => {
			const ctx = execCtx({
				operation: 'get',
				'oids.item': [{ oid: { value: OID.sysDescrInstance } }],
			});

			const result = await node.execute.call(ctx);
			expect(result[0]).toHaveLength(1);
			expect(result[0][0].error).toBeUndefined();
			expect(result[0][0].json.oid).toBe(OID.sysDescrInstance);
		});
	});
});
