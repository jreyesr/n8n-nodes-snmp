import {
	INodeType,
	type INodeTypeDescription,
	type ITriggerFunctions,
	type ITriggerResponse,
	NodeConnectionTypes,
} from 'n8n-workflow';
import { connectForTrap, typeToDetailed, varbindsToDetailedExecutionData } from './utils';
import { ReceiverNotification } from 'net-snmp';

export class SnmpTrapTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SNMP Trap Trigger',
		name: 'snmpTrapTrigger',
		icon: { light: 'file:snmp.svg', dark: 'file:snmp.svg' },
		group: ['trigger'],
		version: 1,
		description: 'SNMP Trap Trigger',
		defaults: {
			name: 'Trap Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				// eslint-disable-next-line n8n-nodes-base/node-class-description-credentials-name-unsuffixed
				name: 'snmp',
				required: false,
			},
		],
		properties: [
			{
				displayName: 'Port',
				name: 'port',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 162,
				required: true,
				description: 'UDP port number where notifications will be received',
			},
			{
				displayName:
					'Binding to ports ≤1024 on some systems requires N8N to be run with administrative privileges. If this is not possible then choose a port greater than 1024.',
				name: 'privilegedPortNotice',
				type: 'notice',
				default: '',
				displayOptions: {
					show: {
						'/port': [{ _cnd: { lte: 1024 } }],
					},
				},
			},
		],
	};

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const port = this.getNodeParameter('port', 162) as number;

		let session: Awaited<ReturnType<typeof connectForTrap>>;

		const onMessage = (notification: ReceiverNotification) => {
			this.emit([
				[
					{
						json: {
							...notification,
							pdu: {
								...notification.pdu,
								type: typeToDetailed(notification.pdu.type),
								varbinds: varbindsToDetailedExecutionData.call(this, notification.pdu.varbinds),
							},
						},
					},
				],
			]);
		};

		const manualTriggerFunction = async () =>
			// eslint-disable-next-line no-async-promise-executor
			await new Promise<void>(async (resolve) => {
				session = await connectForTrap.call(this, port, (error, notification) => {
					if (error) {
						this.emitError(error);
						// Apparently closeFunction() isn't called when emitError is called, so do it by hand here
						session.close();
					} else {
						onMessage(notification);
					}
					resolve();
				});
			});

		if (this.getMode() === 'trigger') {
			session = await connectForTrap.call(this, port, (error, notification) => {
				// For automatic executions, we only emit if successful
				// This is because errors include invalid auth, and no other nodes that I know of
				// (e.g. Webhook) show every invalid auth to them as errored executions.
				// Also, if we emitError() as part of normal execution, it seems to prod N8N into restarting
				// the WF, so emitError() is probably reserved for abnormal conditions (e.g. network
				// disconnection for the Postgres trigger and such?)
				if (!error) {
					onMessage(notification);
				}
			});
		}

		const closeFunction = async () => {
			session.close();
		};

		return {
			closeFunction,
			manualTriggerFunction: this.getMode() === 'manual' ? manualTriggerFunction : undefined,
		};
	}
}
