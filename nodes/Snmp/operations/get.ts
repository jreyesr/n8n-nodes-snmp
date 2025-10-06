import { IExecuteFunctions, type INodeProperties } from 'n8n-workflow';
import { connect, getSingle } from '../utils';
import { promisify } from 'node:util';
import { type Varbind } from 'net-snmp';

export const properties: INodeProperties[] = [
	{
		displayName: 'OIDs',
		name: 'oids',
		type: 'fixedCollection',
		default: {},
		description: 'List of OIDs that will be fetched',
		placeholder: 'Add OID',
		typeOptions: {
			multipleValues: true,
			multipleValueButtonText: 'Add OID',
			minRequiredFields: 1,
		},
		options: [
			{
				displayName: 'Item',
				name: 'item',
				values: [
					{
						displayName: 'OID',
						name: 'oid',
						type: 'resourceLocator',
						default: { mode: 'oid', value: '' },
						required: true,
						modes: [
							{
								displayName: 'Select',
								name: 'list',
								type: 'list',
								placeholder: 'Select an OID...',
								typeOptions: {
									searchListMethod: 'listOIDsInDefaultTree',
									searchable: true,
								},
							},
							{
								displayName: 'By number',
								name: 'oid',
								type: 'string',
								placeholder: 'e.g. 1.3.6.1.2.1',
								validation: [
									{
										type: 'regex',
										properties: {
											regex: '\\d+(\\.\\d+)*',
											errorMessage: 'Not a valid numeric OID',
										},
									},
								],
							},
						],
					},
				],
			},
		],
		displayOptions: {
			show: {
				'/operation': ['get'],
			},
		},
	},
];

export function varbindsToExecutionData(this: IExecuteFunctions, varbinds?: Varbind[]) {
	return (varbinds ?? []).map((vb) => ({
		oid: vb.oid,
		value: getSingle.call(this, vb),
	}));
}

export async function get(this: IExecuteFunctions, itemIndex: number) {
	const oids = this.getNodeParameter('oids.item', itemIndex, []) as {
		oid: { value: string | string[] };
	}[];
	const ip = this.getNodeParameter('address', itemIndex, '') as string;
	const port = this.getNodeParameter('port', itemIndex, 161) as number;
	this.logger.debug('get', { oids });
	const session = await connect.call(this, ip, port);

	const varbinds = await promisify(session.get).call(
		session,
		// NOTE: .flatMap() instead of .map() so it naturally handles expressions that resolve to arrays
		oids.flatMap((i) => i.oid.value),
	);
	return varbindsToExecutionData.call(this, varbinds);
}
