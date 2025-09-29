import { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';
import { connect } from './utils';
import { listOIDs } from './operations/list';

export async function listOIDsInDefaultTree(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const ip = this.getNodeParameter('address', '') as string;
	const port = this.getNodeParameter('port', 161) as number;

	const session = connect.call(this, ip, port);
	const oids = await listOIDs.call(this, session);

	return {
		results: oids
			.filter(
				(e) =>
					!filter ||
					e.oid.includes(filter.toLowerCase()) ||
					e.name.toLowerCase().includes(filter.toLowerCase()),
			)
			.map((e) => ({ name: `${e.name} (${e.oid})`, value: e.oid })),
	};
}
