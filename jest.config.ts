import type { Config } from 'jest';

const config: Config = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	testMatch: ['<rootDir>/tests/**/*.test.ts'],
	testTimeout: 15000,
	// Force-exit after all tests so lingering UDP sockets don't stall Jest
	forceExit: true,
	transform: {
		'^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
	},
};

export default config;
