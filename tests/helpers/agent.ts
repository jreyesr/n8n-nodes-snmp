/**
 * Spins up a real net-snmp agent on 127.0.0.1 for integration tests.
 *
 * Registered OIDs:
 *   Scalars (system group):
 *     1.3.6.1.2.1.1.1.0  sysDescr    OctetString  read-only   "Test SNMP Agent"
 *     1.3.6.1.2.1.1.3.0  sysUpTime   TimeTicks    read-only   12345
 *     1.3.6.1.2.1.1.4.0  sysContact  OctetString  read-write  "admin@example.com"
 *     1.3.6.1.2.1.1.5.0  sysName     OctetString  read-write  "test-host"
 *
 *   Table (ifTable):
 *     base OID  1.3.6.1.2.1.2.2      (ifTable)
 *     entry OID 1.3.6.1.2.1.2.2.1   (ifEntry)
 *     columns: ifIndex(1) ifDescr(2) ifType(3)
 *     row 1: [1, "lo",   24]   (softwareLoopback)
 *     row 2: [2, "eth0",  6]   (ethernetCsmacd)
 */

import { MaxAccess, MibProviderType, ObjectType, createAgent } from 'net-snmp';

export const AGENT_HOST = '127.0.0.1';

// Well-known OIDs used in tests
export const OID = {
	sysDescr: '1.3.6.1.2.1.1.1',
	sysDescrInstance: '1.3.6.1.2.1.1.1.0',
	sysUpTime: '1.3.6.1.2.1.1.3',
	sysUpTimeInstance: '1.3.6.1.2.1.1.3.0',
	sysContact: '1.3.6.1.2.1.1.4',
	sysContactInstance: '1.3.6.1.2.1.1.4.0',
	sysName: '1.3.6.1.2.1.1.5',
	sysNameInstance: '1.3.6.1.2.1.1.5.0',
	systemGroup: '1.3.6.1.2.1.1',
	ifTable: '1.3.6.1.2.1.2.2',
	ifEntry: '1.3.6.1.2.1.2.2.1',
} as const;

export const INITIAL_VALUES = {
	sysDescr: 'Test SNMP Agent',
	sysUpTime: 12345,
	sysContact: 'admin@example.com',
	sysName: 'test-host',
} as const;

export interface TestAgent {
	/** Reset writable scalars to their initial values (use in afterEach for write tests). */
	reset(): void;
	close(): Promise<void>;
}

export async function createTestAgent(port: number): Promise<TestAgent> {
	const agent = createAgent(
		{
			port,
			address: AGENT_HOST,
			// disableAuthorization skips both the community check and ACL, so the agent
			// responds to any client regardless of community string.  Auth behaviour is
			// tested separately on the receiver (trap) side.
			disableAuthorization: true,
		},
		// This callback fires on processing errors; silently ignore them in tests.
		(_error: Error | null) => {},
	);

	// Scalars
	agent.registerProvider({
		name: 'sysDescr',
		type: MibProviderType.Scalar,
		oid: OID.sysDescr,
		scalarType: ObjectType.OctetString,
		maxAccess: MaxAccess['read-only'],
	});
	agent.registerProvider({
		name: 'sysUpTime',
		type: MibProviderType.Scalar,
		oid: OID.sysUpTime,
		scalarType: ObjectType.TimeTicks,
		maxAccess: MaxAccess['read-only'],
	});
	agent.registerProvider({
		name: 'sysContact',
		type: MibProviderType.Scalar,
		oid: OID.sysContact,
		scalarType: ObjectType.OctetString,
		maxAccess: MaxAccess['read-write'],
	});
	agent.registerProvider({
		name: 'sysName',
		type: MibProviderType.Scalar,
		oid: OID.sysName,
		scalarType: ObjectType.OctetString,
		maxAccess: MaxAccess['read-write'],
	});

	// Table: ifTable — note the provider OID is the *entry* OID
	agent.registerProvider({
		name: 'ifTable',
		type: MibProviderType.Table,
		oid: OID.ifEntry,
		maxAccess: MaxAccess['not-accessible'],
		tableColumns: [
			{ number: 1, name: 'ifIndex', type: ObjectType.Integer, maxAccess: MaxAccess['read-only'] },
			{ number: 2, name: 'ifDescr', type: ObjectType.OctetString, maxAccess: MaxAccess['read-only'] },
			{ number: 3, name: 'ifType', type: ObjectType.Integer, maxAccess: MaxAccess['read-only'] },
		],
		tableIndex: [{ columnName: 'ifIndex' }],
	});

	const mib = agent.getMib();

	function seedValues() {
		mib.setScalarValue('sysDescr', Buffer.from(INITIAL_VALUES.sysDescr));
		mib.setScalarValue('sysUpTime', INITIAL_VALUES.sysUpTime);
		mib.setScalarValue('sysContact', Buffer.from(INITIAL_VALUES.sysContact));
		mib.setScalarValue('sysName', Buffer.from(INITIAL_VALUES.sysName));
	}

	seedValues();
	mib.addTableRow('ifTable', [1, Buffer.from('lo'), 24]);
	mib.addTableRow('ifTable', [2, Buffer.from('eth0'), 6]);

	// Allow the UDP socket to finish binding before tests talk to the agent
	await new Promise<void>((resolve) => setTimeout(resolve, 50));

	return {
		reset() {
			seedValues();
		},
		close() {
			return new Promise<void>((resolve) => agent.close(() => resolve()));
		},
	};
}
