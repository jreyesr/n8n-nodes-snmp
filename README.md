# n8n-nodes-snmp

This is an n8n community node. It lets you access SNMP-enabled devices in your n8n workflows.

SNPM is a network management protocol that is widely used to monitor and control network devices (e.g. routers and
switches), as well as other network-connected devices such as servers, IP phones and printers.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Compatibility](#compatibility)
[Usage](#usage)
[Resources](#resources)
[Version history](#version-history)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community
nodes documentation.

## Operations

### List OIDs

Retrieves a part of the device's MIB, starting at a certain root element. Similar in functionality to [the
`snmpwalk` command](https://linux.die.net/man/1/snmpwalk).

By default, this operation walks the subtree rooted at SNMPv2-SMI::mib-2 (`1.3.6.1.2.1`, or
`iso.org.dod.internet.mgmt.mib-2`), like `snmpwalk`. This should surface most standardized fields, but it'll leave out,
for example, any vendor-specific fields (which may be under `1.3.6.1.4.1`, the Private Enterprises section). This can be
configured with the advanced option **Root OID**.

### Get Values

Reads one or multiple OIDs. Static OIDs (or expressions that resolve to a single OID) can be written in the OIDs list.

If you need to read a variable list of OIDs (where the number of items isn't known and comes from an expression), add
an item to the list of OIDs and write an expression that resolves to an array. The node supports a mix of single and
multiple OIDs:

![a screenshot of the SNMP node showing the Read OIDs operation with an array on the field for the OIDs to read](images/get_array.png)

### Get Table

There are parts of MIB trees that contain table data (two-dimensional lists),
in [column-major order](https://en.wikipedia.org/wiki/Row-_and_column-major_order) (all the values for column A first,
then all the values for column B, and so on). For example, `1.3.6.1.2.1.2.2`
is [the interfaces table](https://oidref.com/1.3.6.1.2.1.2.2), comprised of all the values of the form
`<BASE_OID>.1.<COLUMN_INDEX>.<ENTRY_INDEX>`:

| ↓ ENTRY_INDEX | COLUMN_INDEX = 1 = ifIndex | COLUMN_INDEX = 2 = ifDescr | COLUMN_INDEX = 3 = ifType | ... |
|---------------|----------------------------|----------------------------|---------------------------|-----|
| 1             | 1                          | lo                         | 24                        | ... |
| 2             | 2                          | eth1                       | 6                         | ... |
| ...           |                            |                            |                           |     |

To read a table, provide the OID under which the table is stored. _Do not_ include the final `.1` that is typically (
always?) appended to it. This operation will return multiple output items, all with the same shape/schema (dictated by
the fields returned by the SNMP agent while listing all children of the Base OID)

## Credentials

This node supports the authentication methods of SNMP v1, v2c (both just use a Community Name) and v3 (username and,
optionally, separate passwords for message authentication and encryption).

The node can also be used without a credential, in which case it'll default to v2c with the community `public`. To use
v1 or v3, provide a credential (which is necessary in any case for v3 because there isn't a v3 equivalent to the
`public` community that is very widely used in v1/v2c).

## Compatibility

This node has been developed in N8N v1.111. It should work on somewhat older versions (released a few months ago before
2025-09). Please [open an issue](https://github.com/jreyesr/n8n-nodes-snmp/issues) if you encounter any problems.

## Usage

_This is an optional section. Use it to help users with any difficult or confusing aspects of the node._

_By the time users are looking for community nodes, they probably already know n8n basics. But if you expect new users,
you can link to the [Try it out](https://docs.n8n.io/try-it-out/) documentation to help them get started._

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
* [The underlying library used](https://www.npmjs.com/package/net-snmp)

## Version history

See [the CHANGELOG.md file](./CHANGELOG.md)