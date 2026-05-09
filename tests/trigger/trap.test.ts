/**
 * Integration tests for the SNMP Trap Trigger node.
 *
 * No agent is needed here — we create a real net-snmp receiver (via the trigger
 * node under test) and send traps to it using a plain net-snmp session.
 *
 * Port layout (no overlap with operation tests):
 *   19105 — trigger-mode receiver (test: receives trap automatically)
 *   19106 — manual-mode receiver  (test: resolves after first trap)
 *   19107 — auth receiver          (test: authorized community accepted)
 *   19108 — auth receiver          (test: unauthorized community rejected)
 */

import { TrapType, Version2c, createSession } from 'net-snmp';
import { SnmpTrapTrigger } from '../../nodes/Snmp/SnmpTrapTrigger.node';
import { createTriggerContext } from '../helpers/context';

// ---------------------------------------------------------------------------
// Helper: send one v2c ColdStart trap to localhost:port with the given community
// ---------------------------------------------------------------------------
function sendTrap(port: number, community = 'public'): Promise<void> {
	const session = createSession('127.0.0.1', community, {
		version: Version2c,
		trapPort: port,
	});
	return new Promise<void>((resolve, reject) => {
		session.trap(TrapType.ColdStart, [], (error: Error | null) => {
			session.close();
			if (error) reject(error);
			else resolve();
		});
	});
}

// Wait long enough for the UDP datagram to transit the loopback
const DELIVERY_WAIT = 150;

// ---------------------------------------------------------------------------

describe('SnmpTrapTrigger — trigger mode (automatic)', () => {
	it('emits an item for every received trap', async () => {
		const port = 19105;
		const ctx = createTriggerContext({ port });
		const node = new SnmpTrapTrigger();

		const { closeFunction } = await node.trigger.call(ctx);

		await sendTrap(port);
		await new Promise((r) => setTimeout(r, DELIVERY_WAIT));

		await closeFunction!();

		expect(ctx.emitted).toHaveLength(1);
	});

	it('emitted item contains rinfo with address and port', async () => {
		const port = 19105;
		const ctx = createTriggerContext({ port });
		const node = new SnmpTrapTrigger();

		const { closeFunction } = await node.trigger.call(ctx);

		await sendTrap(port);
		await new Promise((r) => setTimeout(r, DELIVERY_WAIT));

		await closeFunction!();

		const item = ctx.emitted[0][0][0].json as Record<string, unknown>;
		expect(item).toHaveProperty('rinfo');
		const rinfo = item.rinfo as Record<string, unknown>;
		expect(rinfo.address).toBe('127.0.0.1');
		expect(typeof rinfo.port).toBe('number');
	});

	it('emitted item contains a parsed PDU with type and varbinds', async () => {
		const port = 19105;
		const ctx = createTriggerContext({ port });
		const node = new SnmpTrapTrigger();

		const { closeFunction } = await node.trigger.call(ctx);

		await sendTrap(port);
		await new Promise((r) => setTimeout(r, DELIVERY_WAIT));

		await closeFunction!();

		const item = ctx.emitted[0][0][0].json as Record<string, unknown>;
		const pdu = item.pdu as Record<string, unknown>;

		// type is enriched with {numeric, name} by the trigger node
		expect(pdu).toHaveProperty('type');
		const type = pdu.type as Record<string, unknown>;
		expect(typeof type.numeric).toBe('number');
		expect(type.name).toBe('Trap (v2)');

		// varbinds is an array (v2c coldStart carries 2 mandatory varbinds)
		expect(Array.isArray(pdu.varbinds)).toBe(true);
		expect((pdu.varbinds as unknown[]).length).toBeGreaterThan(0);
	});

	it('accumulates multiple traps as separate emissions', async () => {
		const port = 19105;
		const ctx = createTriggerContext({ port });
		const node = new SnmpTrapTrigger();

		const { closeFunction } = await node.trigger.call(ctx);

		await sendTrap(port);
		await sendTrap(port);
		await new Promise((r) => setTimeout(r, DELIVERY_WAIT));

		await closeFunction!();

		expect(ctx.emitted).toHaveLength(2);
	});

	it('does NOT emit for traps from an unauthorized community when auth is enabled', async () => {
		const port = 19105;
		// Provide credentials with community "secret" → receiver will only accept "secret"
		const credentials = { version: 'v2c', community: 'secret' };
		const ctx = createTriggerContext({ port }, credentials);
		const node = new SnmpTrapTrigger();

		const { closeFunction } = await node.trigger.call(ctx);

		// Send with a wrong community — should be silently dropped
		await sendTrap(port, 'wrong-community');
		await new Promise((r) => setTimeout(r, DELIVERY_WAIT));

		await closeFunction!();

		expect(ctx.emitted).toHaveLength(0);
	});

	it('DOES emit for traps from the correct authorized community', async () => {
		const port = 19105;
		const credentials = { version: 'v2c', community: 'secret' };
		const ctx = createTriggerContext({ port }, credentials);
		const node = new SnmpTrapTrigger();

		const { closeFunction } = await node.trigger.call(ctx);

		await sendTrap(port, 'secret');
		await new Promise((r) => setTimeout(r, DELIVERY_WAIT));

		await closeFunction!();

		expect(ctx.emitted).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------

describe('SnmpTrapTrigger — manual mode (test/preview)', () => {
	it('manualTriggerFunction resolves after the first trap', async () => {
		const port = 19106;
		const ctx = createTriggerContext({ port }, undefined, 'manual');
		const node = new SnmpTrapTrigger();

		const { manualTriggerFunction, closeFunction } = await node.trigger.call(ctx);
		expect(manualTriggerFunction).toBeDefined();

		// Start listening — will resolve only after the first trap arrives
		const listenPromise = manualTriggerFunction!();

		// Send the trap after a brief delay to ensure the receiver is bound
		await new Promise((r) => setTimeout(r, 50));
		await sendTrap(port);

		// The manual trigger must resolve within the test timeout
		await listenPromise;
		await closeFunction!();

		expect(ctx.emitted).toHaveLength(1);
	});

	it('emitted item in manual mode has the same shape as trigger mode', async () => {
		const port = 19106;
		const ctx = createTriggerContext({ port }, undefined, 'manual');
		const node = new SnmpTrapTrigger();

		const { manualTriggerFunction, closeFunction } = await node.trigger.call(ctx);

		const listenPromise = manualTriggerFunction!();
		await new Promise((r) => setTimeout(r, 50));
		await sendTrap(port);
		await listenPromise;
		await closeFunction!();

		const item = ctx.emitted[0][0][0].json as Record<string, unknown>;
		expect(item).toHaveProperty('rinfo');
		expect(item).toHaveProperty('pdu');

		const pdu = item.pdu as Record<string, unknown>;
		const type = pdu.type as Record<string, unknown>;
		expect(type.name).toBe('Trap (v2)');
	});

	it('emitError is called when an unauthorized trap arrives in manual mode', async () => {
		const port = 19106;
		const credentials = { version: 'v2c', community: 'secret' };
		const ctx = createTriggerContext({ port }, credentials, 'manual');
		const node = new SnmpTrapTrigger();

		const { manualTriggerFunction, closeFunction } = await node.trigger.call(ctx);

		const listenPromise = manualTriggerFunction!();
		await new Promise((r) => setTimeout(r, 50));

		// Send with wrong community — receiver calls callback with an error
		await sendTrap(port, 'wrong');

		// The promise should still resolve (the callback always calls resolve)
		await listenPromise;
		await closeFunction!();

		// No data emitted, but an error was recorded
		expect(ctx.emitted).toHaveLength(0);
		expect(ctx.errors.length).toBeGreaterThan(0);
	});
});
