import {
	ICredentialDataDecryptedObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	ITriggerFunctions,
	NodeOperationError,
} from 'n8n-workflow';
import {
	type Authorizer,
	type ReceiverCallback,
	AuthProtocols,
	createModuleStore,
	createReceiver,
	createSession,
	createV3Session,
	isVarbindError,
	OidFormat,
	PrivProtocols,
	SecurityLevel,
	type User,
	type Varbind,
	varbindError,
	VarbindValue,
	Version1,
	Version2c,
	Version3,
	ObjectType,
	PduType,
} from 'net-snmp';

type Versions = 'v1' | 'v2c' | 'v3';

async function getCred(
	this: IExecuteFunctions | ILoadOptionsFunctions | ITriggerFunctions,
): Promise<
	| {
			version: 'v1' | 'v2c';
			cred?: string;
	  }
	| { version: 'v3'; cred: User }
> {
	let version: Versions;

	try {
		const cred = (await this.getCredentials('snmp')) as ICredentialDataDecryptedObject;
		version = cred.version as Versions;
		switch (version) {
			case 'v1':
			case 'v2c':
				return {
					version,
					cred: cred.community as string,
				};
			case 'v3':
				return {
					version: 'v3',
					cred: {
						name: cred.user as string,
						level: SecurityLevel[cred.level as keyof typeof SecurityLevel],
						authProtocol: AuthProtocols[cred.authProtocol as keyof typeof AuthProtocols],
						authKey: cred.authKey as string,
						privProtocol: PrivProtocols[cred.privProtocol as keyof typeof PrivProtocols],
						privKey: cred.privKey as string,
					},
				};
		}
	} catch {
		return {
			version: 'v2c',
		};
	}
}

export async function connect(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	ip: string,
	port: number,
) {
	const { version, cred } = await getCred.call(this);

	switch (version) {
		case 'v1':
		case 'v2c':
			return createSession(ip, cred ?? 'public', {
				port,
				version: version === 'v1' ? Version1 : Version2c,
			});
		case 'v3':
			return createV3Session(ip, cred, {
				port,
				version: Version3,
			});
		default:
			throw new NodeOperationError(
				this.getNode(),
				"Unexpected error, version isn't v1 or v2c or v3!",
			);
	}
}

declare module 'net-snmp' {
	export interface ReceiverNotification {
		rinfo: {
			address: string;
			family: string;
			port: number;
			size: number;
			community?: string;
			user?: User;
		};
		pdu: { type: number; id: number; varbinds: Varbind[] };
	}

	export type ReceiverCallback = (error: Error, notification: ReceiverNotification) => void;

	export interface ReceiverOptions {
		port?: number;
		disableAuthorization?: boolean;
		includeAuthentication?: boolean;
		engineID?: string;
		address?: string;
		transport?: string;
		sockets?: { transport: string; address: string; port: number }[];
	}

	export function createReceiver(options: ReceiverCallback, callback: ReceiverCallback): Receiver;

	export class Receiver {
		getAuthorizer(): Authorizer;

		close(callback?: (socket: { address: string; family: string; port: number }) => void): void;
	}

	export interface Authorizer {
		addCommunity: (community: string) => void;
		getCommunity: (community: string) => string | null;
		getCommunities: () => string[];

		addUser: (user: User) => void;
		getUser: (user: User) => User | null;
		getUsers: () => User[];

		getAccessControlModelType: () => AccessControlModelType;
	}
}

export async function connectForTrap(
	this: ITriggerFunctions,
	port: number,
	callback: ReceiverCallback,
) {
	const { version, cred } = await getCred.call(this);

	const receiver = createReceiver(
		{
			port,
			disableAuthorization: cred === undefined,
			includeAuthentication: true,
		},
		callback,
	) as { close: () => void; getAuthorizer: () => Authorizer };

	if (version !== 'v3' && cred !== undefined) {
		receiver.getAuthorizer().addCommunity(cred);
	} else if (version === 'v3') {
		receiver.getAuthorizer().addUser(cred);
	}
	return receiver;
}

export function varbindsToExecutionData(
	this: Pick<IExecuteFunctions, 'getNode'>,
	varbinds?: Varbind[],
) {
	return (varbinds ?? []).map((vb) => ({
		oid: vb.oid,
		value: getSingle.call(this, vb),
	}));
}

const SNMP_TYPE_NAMES: { [k in ObjectType | PduType]?: string } = {
	[ObjectType.Boolean]: 'Boolean',
	[ObjectType.Integer]: 'Integer',
	[ObjectType.BitString]: 'Bit String',
	[ObjectType.OctetString]: 'String',
	[ObjectType.Null]: 'Null',
	[ObjectType.OID]: 'OID',
	[ObjectType.IpAddress]: 'IP Address',
	[ObjectType.Counter]: 'Counter',
	[ObjectType.Gauge]: 'Gauge',
	[ObjectType.TimeTicks]: 'Time Ticks',
	[ObjectType.Opaque]: 'Opaque',
	[ObjectType.Counter64]: 'Counter64',

	// the three below shouldn't appear on actual entries, but just in case
	[ObjectType.NoSuchObject]: 'No Such Object',
	[ObjectType.NoSuchInstance]: 'No Such Instance',
	[ObjectType.EndOfMibView]: 'End Of MIB',

	// The below aren't actually data types but PDU types, but since we only use this for pretty printing we should be OK mixing them up
	// This page also lists types and PDUs in the same table: https://gridprotectionalliance.org/NightlyBuilds/GridSolutionsFramework/Help/html/T_GSF_Net_Snmp_SnmpType.htm
	[PduType.GetRequest]: 'Get request',
	[PduType.GetNextRequest]: 'Get Next request',
	[PduType.GetResponse]: 'Get response',
	[PduType.SetRequest]: 'Set request',
	[PduType.Trap]: 'Trap (v1)',
	[PduType.GetBulkRequest]: 'Get Bulk request',
	[PduType.InformRequest]: 'Inform request',
	[PduType.TrapV2]: 'Trap (v2)',
	[PduType.Report]: 'Report',
};

export function typeToDetailed(type?: ObjectType) {
	return { numeric: type, name: SNMP_TYPE_NAMES[type ?? -1] ?? 'UNKNOWN' };
}

export function varbindsToDetailedExecutionData(
	this: Pick<IExecuteFunctions, 'getNode'>,
	varbinds: Varbind[],
) {
	return varbinds.map((vb) => ({
		oid: vb.oid,
		name: getName(vb.oid) ?? vb.oid,
		type: typeToDetailed(vb.type),
		value: getSingle.call(this, vb), // may throw NodeOperationError
	}));
}

export function getSingle(this: Pick<IExecuteFunctions, 'getNode'>, varbind: Varbind) {
	if (isVarbindError(varbind)) {
		throw new NodeOperationError(this.getNode(), varbindError(varbind));
	}
	return getVal(varbind);
}

function isVarbind(val: Varbind | VarbindValue): val is Varbind {
	return (val as Varbind).oid !== undefined;
}

export function getVal(varbind: Varbind | VarbindValue) {
	if (isVarbind(varbind)) varbind = varbind.value;

	if (varbind === null || varbind === undefined) {
		return null;
	}
	if (Buffer.isBuffer(varbind)) {
		return varbind.toString();
	}
	if (typeof varbind === 'bigint') {
		return varbind.toString();
	}
	return varbind;
}

const moduleStore = createModuleStore();

/**
 * Returns the name of an OID, or the nearest parent that is included in some MIB module, followed
 * by the remaining (unknown) nodes
 * @example
 * // 1.3.6.1.2.1.1.1 is sysDescr, and its actual value (because it's a scalar) is .0 inside that path
 * getName("1.3.6.1.2.1.1.1.0") => ".0"
 */
export function getName(oid: string): string | null {
	const prefix = oid.split('.'),
		suffix: string[] = [];
	while (prefix.length) {
		try {
			const name = moduleStore.translate(prefix.join('.'), OidFormat.path);
			return [...name.split('.'), ...suffix].join('.');
		} catch {
			// an exception means that prefix wasn't found on translation table, so try to chop the last component off and retry
			// shuffle prefix[-1] to start of suffix
			// e.g. prefix=[1, 3, 6, 1, 2, 1, 0], suffix=[]
			// =>
			// prefix=[1, 3, 6, 1, 2, 1], suffix=[0]
			suffix.splice(0, 0, prefix.pop()!);
		}
	}
	try {
		return moduleStore.translate(oid, OidFormat.path);
	} catch {
		try {
			// as a special case, try to find the previous path
			const exceptLastComponent = oid.split('.').slice(0, -1).join('.');
			return moduleStore.translate(exceptLastComponent, OidFormat.path);
		} catch {
			return null; // give up
		}
	}
}
