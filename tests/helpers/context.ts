/**
 * Lightweight n8n execution context mocks for unit and integration tests.
 * Only the methods actually called by our operation functions are implemented.
 */

import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	ITriggerFunctions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

const MOCK_NODE = {
	name: 'SNMP Test',
	type: 'snmp',
	id: 'test-node-1',
	typeVersion: 1,
	position: [0, 0] as [number, number],
	parameters: {},
};

const silentLogger = {
	debug: jest.fn(),
	info: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
	verbose: jest.fn(),
};

type ParamMap = Record<string, unknown>;
type Credentials = Record<string, unknown>;

// ---------------------------------------------------------------------------
// IExecuteFunctions / ILoadOptionsFunctions mock
// ---------------------------------------------------------------------------

export function createExecContext(
	params: ParamMap,
	credentials?: Credentials,
): IExecuteFunctions & ILoadOptionsFunctions {
	return {
		getNodeParameter(name: string, _itemIndexOrDefault?: unknown, defaultValue?: unknown) {
			// Handle both (name, itemIndex, default) and (name, default) call signatures
			const effectiveDefault =
				typeof _itemIndexOrDefault === 'number' ? defaultValue : _itemIndexOrDefault;
			return name in params ? params[name] : effectiveDefault;
		},
		async getCredentials(name: string) {
			if (credentials === undefined) {
				throw new NodeOperationError(
					MOCK_NODE as never,
					`No credentials configured for "${name}"`,
				);
			}
			return credentials;
		},
		getNode: () => MOCK_NODE as never,
		getInputData: () => [{ json: {}, pairedItem: { item: 0 } }] as INodeExecutionData[],
		continueOnFail: () => false,
		logger: silentLogger as never,
		helpers: {} as never,
	} as unknown as IExecuteFunctions & ILoadOptionsFunctions;
}

// ---------------------------------------------------------------------------
// ITriggerFunctions mock — also exposes collected emissions for assertions
// ---------------------------------------------------------------------------

export interface MockTriggerCtx extends ITriggerFunctions {
	/** All data arrays passed to emit() in order */
	emitted: INodeExecutionData[][][];
	/** All errors passed to emitError() in order */
	errors: Error[];
}

export function createTriggerContext(
	params: ParamMap,
	credentials?: Credentials,
	mode: 'trigger' | 'manual' = 'trigger',
): MockTriggerCtx {
	const emitted: INodeExecutionData[][][] = [];
	const errors: Error[] = [];

	const ctx = {
		// ITriggerFunctions.getNodeParameter has no itemIndex argument
		getNodeParameter(name: string, defaultValue?: unknown) {
			return name in params ? params[name] : defaultValue;
		},
		async getCredentials(name: string) {
			if (credentials === undefined) {
				throw new NodeOperationError(
					MOCK_NODE as never,
					`No credentials configured for "${name}"`,
				);
			}
			return credentials;
		},
		getNode: () => MOCK_NODE as never,
		getMode: () => mode,
		emit(data: INodeExecutionData[][]) {
			emitted.push(data);
		},
		emitError(error: Error) {
			errors.push(error);
		},
		logger: silentLogger as never,
		helpers: {} as never,
		emitted,
		errors,
	};

	return ctx as unknown as MockTriggerCtx;
}
