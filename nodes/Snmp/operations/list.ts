import type { IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { connect, getName, getSingle } from '../utils';
import { type Varbind, ObjectType } from 'net-snmp';

export const properties: INodeProperties[] = [];

const SNMPWALK_ROOT_OID = '1.3.6.1.2.1'; // SNMPv2-SMI::mib-2
const SNMP_TYPE_NAMES: { [k in ObjectType]?: string } = {
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
};

export const options: INodeProperties[] = [
	{
		displayName: 'Root OID',
		name: 'rootOID',
		type: 'string',
		default: SNMPWALK_ROOT_OID,
		description:
			'The OID to start searching for. Default value is the same as the <code>snmpwalk</code> executable.',
		displayOptions: {
			show: {
				'/operation': ['listOIDs'],
			},
		},
	},
];

export async function list(this: IExecuteFunctions, itemIndex: number) {
	const startOID = this.getNodeParameter('options.rootOID', itemIndex, SNMPWALK_ROOT_OID) as string;
	this.logger.debug('list', { rootOID: startOID });
	const session = connect.call(this, itemIndex);

	type TreeEntry = {
		oid: string;
		name: string;
		type: { numeric: number | undefined; name: string };
		value: ReturnType<typeof getSingle>;
	};
	let resolve: (value: TreeEntry[]) => void, reject: (value: Error) => void;
	const promise: Promise<TreeEntry[]> = new Promise((res, rej) => {
		resolve = res;
		reject = rej;
	});

	const finalValues: TreeEntry[] = [];

	const doneCb = (error: Error | null) => {
		this.logger.debug('done walking subtree', { rootOID: startOID, error });
		if (error) reject(error);
		resolve(finalValues);
	};

	const feedCb = (varbinds: Varbind[]) => {
		this.logger.debug('received varbinds', {
			rootOID: startOID,
			numVarbinds: varbinds.length,
			start: varbinds[0].oid,
			end: varbinds[varbinds.length - 1].oid,
		});
		try {
			for (const vb of varbinds) {
				finalValues.push({
					oid: vb.oid,
					name: getName(vb.oid) ?? vb.oid,
					type: { numeric: vb.type, name: SNMP_TYPE_NAMES[vb.type ?? -1] ?? 'UNKNOWN' },
					value: getSingle.call(this, itemIndex, vb), // may throw NodeOperationError
				});
			}
		} catch (e) {
			reject(e);
		}
	};

	// Set numRepetitions to essentially infinite, otherwise it'll return no more than 500 entries???
	session.subtree(startOID, Number.MAX_SAFE_INTEGER, feedCb, doneCb);

	return promise;
}

