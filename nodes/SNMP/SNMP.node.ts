import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
import { list, options as listOptions } from './operations/list';
import { get, properties as getProperties } from './operations/get';

export class SNMP implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SNMP',
		name: 'snmp',
		icon: { light: 'file:snmp.svg', dark: 'file:snmp.svg' },
		group: ['input'],
		version: 1,
		description: 'SNMP Node',
		defaults: {
			name: 'SNMP',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		properties: [
			{
				displayName: 'IP Address',
				name: 'address',
				type: 'string',
				default: '',
				required: true,
				description: 'The IP address of the agent/device',
			},
			{
				displayName: 'Port',
				name: 'port',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 161,
				required: true,
				description: 'UDP port number where the agent is listening',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'listOIDs',
				noDataExpression: true,
				options: [
					{
						name: 'List OIDs',
						value: 'listOIDs',
						action: 'List OIDs', // eslint-disable-line n8n-nodes-base/node-param-operation-option-action-miscased
						description: 'Walks the SNMP tree and returns all descendant entries',
					},
					{
						name: 'Get Values',
						value: 'get',
						action: 'Get values',
						description: 'Retrieve the values of one or several OIDs',
					},
				],
			},
			...getProperties,
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				options: [...listOptions],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0, 'listOIDs') as string;

		for (let itemIndex = 0; itemIndex < this.getInputData().length; itemIndex++) {
			// try {
			switch (operation) {
				case 'listOIDs':
					items.push(
						...(await list.call(this, itemIndex)).map((e) => ({
							json: e,
							pairedItem: { item: itemIndex },
						})),
					);
					break;
				case 'get':
					items.push(...(await get.call(this, itemIndex)).map((i) => ({ json: i })));
					break;
			}
			// } catch (error) {
			// 	if (this.continueOnFail()) {
			// 		items.push({ json: this.getInputData(itemIndex)[0].json, error, pairedItem: itemIndex });
			// 	} else {
			// 		if (error.context) {
			// 			error.context.itemIndex = itemIndex;
			// 			throw error;
			// 		}
			// 		throw new NodeOperationError(this.getNode(), error, {
			// 			itemIndex,
			// 		});
			// 	}
			// }
		}

		return [items];
	}
}
