// This node requires a bound UDP port for SNMP trap reception, which is incompatible
// with n8n Cloud. We use configWithoutCloudSupport to keep the other best-practice
// rules active while dropping the dependency-restriction rules.
import { configWithoutCloudSupport } from '@n8n/node-cli/eslint';

export default [
	...configWithoutCloudSupport,
	// Test files and Jest config live outside the deployed node — exempt them from
	// unused-vars errors introduced by mocking patterns.
	{
		files: ['tests/**/*.ts', 'jest.config.ts'],
		rules: {
			'@typescript-eslint/no-unused-vars': 'off',
		},
	},
];
