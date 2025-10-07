import { IExecuteFunctions, INodeProperties, NodeParameterValue } from 'n8n-workflow';
import { connect, varbindsToExecutionData } from '../utils';
import { promisify } from 'node:util';
import { Varbind } from 'net-snmp';

export const properties: INodeProperties[] = [
	{
		displayName: 'Values',
		name: 'values',
		type: 'fixedCollection',
		required: true,
		displayOptions: {
			show: {
				'/operation': ['write'],
			},
		},
		typeOptions: {
			multipleValues: true,
			minRequiredFields: 1,
			sortable: true,
		},
		placeholder: 'Add Value',
		default: {
			values: [
				{
					oid: '',
					value: '',
				},
			],
		},
		options: [
			{
				name: 'values',
				displayName: 'Value',
				values: [
					{
						displayName: 'OID',
						name: 'oid',
						type: 'string',
						default: '',
						required: true,
					},
					{
						displayName: 'Value',
						name: 'value',
						type: 'string',
						default: '',
						required: true,
					},
				],
			},
		],
	},
];

export async function write(this: IExecuteFunctions, itemIndex: number) {
	const data = this.getNodeParameter('values.values', itemIndex, []) as {
		oid: string;
		value: NodeParameterValue;
	}[];
	const ip = this.getNodeParameter('address', itemIndex, '') as string;
	const port = this.getNodeParameter('port', itemIndex, 161) as number;
	this.logger.debug('write', { data });
	const session = await connect.call(this, ip, port);

	const oidTypes = Object.fromEntries(
		(await promisify(session.get).call(
			session,
			data.map((i) => i.oid),
		))!.map((vb) => [vb.oid, vb.type!]),
	);

	const toWrite: Varbind[] = [];
	for (const { oid, value } of data) {
		toWrite.push({
			oid,
			type: oidTypes[oid],
			value: value,
		});
	}

	return varbindsToExecutionData.call(this, await promisify(session.set).call(session, toWrite));
}
