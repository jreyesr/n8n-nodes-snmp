import type { IExecuteFunctions, ILoadOptionsFunctions, INodeProperties } from 'n8n-workflow';
import { connect, getSingle, varbindsToDetailedExecutionData } from '../utils';
import { type Varbind, Session } from 'net-snmp';

export const properties: INodeProperties[] = [];

export const SNMPWALK_ROOT_OID = '1.3.6.1.2.1'; // SNMPv2-SMI::mib-2

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

export type TreeEntry = {
	oid: string;
	name: string;
	type: { numeric: number | undefined; name: string };
	value: ReturnType<typeof getSingle>;
};

export async function listOIDs(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	session: Session,
	startOID: string = SNMPWALK_ROOT_OID,
): Promise<TreeEntry[]> {
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
			finalValues.push(...varbindsToDetailedExecutionData.call(this, varbinds));
		} catch (e) {
			reject(e);
		}
	};

	session.subtree(startOID, feedCb, doneCb);

	return promise;
}

export async function list(this: IExecuteFunctions, itemIndex: number) {
	const startOID = this.getNodeParameter('options.rootOID', itemIndex, SNMPWALK_ROOT_OID) as string;
	const ip = this.getNodeParameter('address', itemIndex, '') as string;
	const port = this.getNodeParameter('port', itemIndex, 161) as number;
	this.logger.debug('list', { rootOID: startOID });
	const session = await connect.call(this, ip, port);

	return listOIDs.call(this, session, startOID);
}
