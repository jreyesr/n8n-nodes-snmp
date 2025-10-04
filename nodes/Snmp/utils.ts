import {
	ICredentialDataDecryptedObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	NodeOperationError,
} from 'n8n-workflow';
import {
	AuthProtocols,
	createModuleStore,
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
} from 'net-snmp';

export async function connect(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	ip: string,
	port: number,
) {
	let version: string = 'v2c';
	let snmpCred: string | User = 'public';

	let cred: ICredentialDataDecryptedObject | undefined;
	try {
		cred = (await this.getCredentials('snmp')) as ICredentialDataDecryptedObject;
		version = cred.version as string;
		switch (version) {
			case 'v1':
			case 'v2c':
				snmpCred = cred.community as string;
				break;
			case 'v3':
				snmpCred = {
					name: cred.user as string,
					level: SecurityLevel[cred.level as keyof typeof SecurityLevel],
					authProtocol: AuthProtocols[cred.authProtocol as keyof typeof AuthProtocols],
					authKey: cred.authKey as string,
					privProtocol: PrivProtocols[cred.privProtocol as keyof typeof PrivProtocols],
					privKey: cred.privKey as string,
				};
		}
	} catch {
		// just let this continue, there are defaults anyway
	}

	switch (version) {
		case 'v1':
		case 'v2c':
			return createSession(ip, snmpCred as string, {
				port,
				version: version === 'v1' ? Version1 : Version2c,
			});
		case 'v3':
			return createV3Session(ip, snmpCred as User, {
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

export function getSingle(this: IExecuteFunctions | ILoadOptionsFunctions, varbind: Varbind) {
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
