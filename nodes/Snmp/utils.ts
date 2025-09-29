import { IExecuteFunctions, ILoadOptionsFunctions, NodeOperationError } from 'n8n-workflow';
import {
	createSession,
	isVarbindError,
	Varbind,
	varbindError,
	createModuleStore,
	OidFormat,
} from 'net-snmp';

export function connect(ip: string, port: number) {
	return createSession(ip, 'private', {
		port,
	});
}

export function getSingle(this: IExecuteFunctions | ILoadOptionsFunctions, varbind: Varbind) {
	if (isVarbindError(varbind)) {
		throw new NodeOperationError(this.getNode(), varbindError(varbind));
	}
	return getVal(varbind);
}

export function getVal(varbind: Varbind) {
	if (varbind.value === null || varbind.value === undefined) {
		return null;
	}
	if (Buffer.isBuffer(varbind.value)) {
		return varbind.value.toString();
	}
	if (typeof varbind.value === 'bigint') {
		return varbind.value.toString();
	}
	return varbind.value;
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
