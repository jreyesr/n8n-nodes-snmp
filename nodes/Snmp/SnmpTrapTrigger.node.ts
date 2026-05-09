import {
	INodeType,
	type INodeTypeDescription,
	type ITriggerFunctions,
	type ITriggerResponse,
	NodeConnectionTypes,
} from 'n8n-workflow';
import { connectForTrap, typeToDetailed, varbindsToDetailedExecutionData } from './utils';
import { ReceiverNotification } from 'net-snmp';

// eslint-disable-next-line @n8n/community-nodes/node-usable-as-tool
export class SnmpTrapTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SNMP Trap Trigger',
		name: 'snmpTrapTrigger',
		icon: 'file:snmp.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '=UDP port {{$parameter["port"]}}',
		description: 'Receive SNMP traps (v1, v2c, v3) on a local UDP port',
		defaults: {
			name: 'SNMP Trap',
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

		const manualTriggerFunction = async () => {
			let resolveFirstMessage: () => void;
			const firstMessage = new Promise<void>((resolve) => {
				resolveFirstMessage = resolve;
			});

			session = await connectForTrap.call(this, port, (error, notification) => {
				if (error) {
					this.emitError(error);
					// closeFunction() isn't called when emitError is called, so close manually
					session.close();
				} else {
					onMessage(notification);
				}
				resolveFirstMessage();
			});

			await firstMessage;
		};

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
			try {
				session.close();
			} catch {
				// Session may have already been closed (e.g. on emitError in manual mode)
			}
		};

		return {
			closeFunction,
			manualTriggerFunction: this.getMode() === 'manual' ? manualTriggerFunction : undefined,
		};
	}
}
