import { IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { connect, getName, getVal } from '../utils';
import { promisify } from 'node:util';
import { type TableData } from 'net-snmp';

export const properties: INodeProperties[] = [
	{
		displayName: 'Base OID',
		name: 'baseOID',
		type: 'string',
		default: '',
		description:
			'The OID where the table starts. Should contain two more levels down (<code>&lt;Base OID&gt;.1.1</code> should exist, as well as .2.1 and .1.2 and so on).',
		placeholder: 'e.g. 1.3.6.1.2.1.2.2.1',
		displayOptions: {
			show: {
				'/operation': ['getTable'],
			},
		},
	},
];

export async function getTable(this: IExecuteFunctions, itemIndex: number) {
	const baseOID = this.getNodeParameter('baseOID', itemIndex, []) as string;
	const ip = this.getNodeParameter('address', itemIndex, '') as string;
	const port = this.getNodeParameter('port', itemIndex, 161) as number;
	this.logger.debug('getTable', { baseOID });
	const session = await connect.call(this, ip, port);

	// @ts-expect-error asdf
	const table: TableData = await promisify(session.table).call(session, baseOID);

	const columnNames: Record<string, string> = {};
	for (const column of Object.keys(Object.values(table)[0] ?? {})) {
		const columnOID = `${baseOID}.1.${column}`;
		columnNames[column] = (getName(columnOID) ?? columnOID).split(".").slice(-1)[0];
	}
	return Object.entries(table).map(([index, row]) => ({
		__index: index,
		...Object.fromEntries(Object.entries(row).map(([column, value]) => ([columnNames[column], getVal(value)]))),
	}));
}
