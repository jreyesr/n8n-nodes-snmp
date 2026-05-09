import { IExecuteFunctions, INodeProperties, NodeOperationError, NodeParameterValue } from 'n8n-workflow';
import { connect, varbindsToExecutionData } from '../utils';
import { promisify } from 'node:util';
import { isVarbindError, varbindError, ObjectType, Varbind } from 'net-snmp';

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
					oid: { mode: 'oid', value: '' },
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
	const rawData = this.getNodeParameter('values.values', itemIndex, []) as {
		oid: { value: string };
		value: NodeParameterValue;
	}[];
	const data = rawData.map((i) => ({ oid: i.oid.value, value: i.value }));
	const ip = this.getNodeParameter('address', itemIndex, '') as string;
	const port = this.getNodeParameter('port', itemIndex, 161) as number;
	this.logger.debug('write', { data });
	const session = await connect.call(this, ip, port);
	try {
		const getResults = await promisify(session.get).call(session, data.map((i) => i.oid));
		const oidTypes: Record<string, ObjectType> = {};
		for (const vb of getResults ?? []) {
			if (isVarbindError(vb)) {
				throw new NodeOperationError(
					this.getNode(),
					`OID ${vb.oid} does not exist: ${varbindError(vb)}`,
				);
			}
			// vb.type is a valid ObjectType here — isVarbindError above ruled out error types
			oidTypes[vb.oid] = vb.type as ObjectType;
		}

		const toWrite: Varbind[] = [];
		for (const { oid, value } of data) {
			toWrite.push({ oid, type: oidTypes[oid], value });
		}

		return varbindsToExecutionData.call(this, await promisify(session.set).call(session, toWrite));
	} finally {
		session.close();
	}
}
