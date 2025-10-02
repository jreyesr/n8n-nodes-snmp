import type { ICredentialType, INodeProperties } from 'n8n-workflow';

// eslint-disable-next-line n8n-nodes-base/cred-class-name-unsuffixed
export class Snmp implements ICredentialType {
	// eslint-disable-next-line n8n-nodes-base/cred-class-field-name-unsuffixed
	name = 'snmp';

	// eslint-disable-next-line n8n-nodes-base/cred-class-field-display-name-missing-api
	displayName = 'SNMP';

	documentationUrl =
		'https://www.npmjs.com/package/net-snmp#snmpcreatesession-target-community-options';

	properties: INodeProperties[] = [
		{
			displayName: 'Version',
			name: 'version',
			type: 'options',
			default: 'v2c',
			options: [
				{ name: 'Version 1', value: 'v1' },
				{ name: 'Version 2c', value: 'v2c' },
				{ name: 'Version 3', value: 'v3' },
			],
		},
		{
			displayName: 'Community name',
			name: 'community',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: 'public',
			description: 'Defaults to <code>public</code>',
			required: true,
			displayOptions: {
				show: {
					'/version': ['v1', 'v2c'],
				},
			},
		},
		{
			displayName: 'User',
			name: 'user',
			type: 'string',
			required: true,
			default: '',
			displayOptions: {
				show: {
					'/version': ['v3'],
				},
			},
		},
		{
			displayName: 'Security level',
			name: 'level',
			type: 'options',
			required: true,
			default: 'authPriv',
			description: 'Whether to authenticate and/or encrypt messages',
			options: [
				{ name: 'No authentication, no encryption', value: 'noAuthNoPriv' },
				{ name: 'Authentication, no encryption', value: 'authNoPriv' },
				{ name: 'Authentication and encryption', value: 'authPriv' },
			],
			displayOptions: {
				show: {
					'/version': ['v3'],
				},
			},
		},
		{
			displayName: 'Authentication protocol',
			name: 'authProtocol',
			type: 'options',
			required: true,
			default: 'sha512',
			options: [
				{ name: 'HMAC-MD5', value: 'md5' },
				{ name: 'HMAC-SHA-1', value: 'sha' },
				{ name: 'HMAC-SHA-224', value: 'sha224' },
				{ name: 'HMAC-SHA-256', value: 'sha256' },
				{ name: 'HMAC-SHA-384', value: 'sha384' },
				{ name: 'HMAC-SHA-512', value: 'sha512' },
			],
			displayOptions: {
				show: {
					'/version': ['v3'],
					'/level': ['authNoPriv', 'authPriv'],
				},
			},
		},
		{
			displayName: 'Authentication key',
			name: 'authKey',
			type: 'string',
			required: true,
			default: '',
			typeOptions: { password: true },
			displayOptions: {
				show: {
					'/version': ['v3'],
					'/level': ['authNoPriv', 'authPriv'],
				},
			},
		},
		{
			displayName: 'Encryption protocol',
			name: 'privProtocol',
			type: 'options',
			required: true,
			default: 'aes',
			options: [
				{ name: 'CBC-DES', value: 'des' },
				{ name: 'CFB-AES-128', value: 'aes' },
				{
					name: 'CFB-AES-256 with "Blumenthal" key localization',
					value: 'aes256b',
					description: 'Not standard',
				},
				{
					name: 'CFB-AES-256 with "Reeder" key localization',
					value: 'aes256r',
					description: 'Not standard. Used by Cisco and other vendors',
				},
			],
			displayOptions: {
				show: {
					'/version': ['v3'],
					'/level': ['authPriv'],
				},
			},
		},
		{
			displayName: 'Encryption key',
			name: 'privKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			displayOptions: {
				show: {
					'/version': ['v3'],
					'/level': ['authPriv'],
				},
			},
		},
	];
}
