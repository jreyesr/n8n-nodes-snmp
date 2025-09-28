import { IExecuteFunctions, type INodeProperties } from 'n8n-workflow';
import { connect, getSingle } from '../utils';
import { promisify } from 'node:util';

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
						type: 'string',
						default: '',
						required: true,
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

export async function get(this: IExecuteFunctions, itemIndex: number) {
	const oids = this.getNodeParameter('oids.item', itemIndex, []) as { oid: string | string[] }[];
	this.logger.debug('get', { oids });
	const session = connect.call(this, itemIndex);

	const varbinds = await promisify(session.get).call(
		session,
		// NOTE: .flatMap() instead of .map() so it naturally handles expressions that resolve to arrays
		oids.flatMap((i) => i.oid),
	);
	return (varbinds ?? []).map((vb) => ({
		oid: vb.oid,
		value: getSingle.call(this, itemIndex, vb),
	}));
}
