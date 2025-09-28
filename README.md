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

## Credentials

_If users need to authenticate with the app/service, provide details here. You should include prerequisites (such as
signing up with the service), available authentication methods, and how to set them up._

## Compatibility

_State the minimum n8n version, as well as which versions you test against. You can also include any known version
incompatibility issues._

## Usage

_This is an optional section. Use it to help users with any difficult or confusing aspects of the node._

_By the time users are looking for community nodes, they probably already know n8n basics. But if you expect new users,
you can link to the [Try it out](https://docs.n8n.io/try-it-out/) documentation to help them get started._

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
* _Link to app/service documentation._

## Version history

_This is another optional section. If your node has multiple versions, include a short description of available versions
and what changed, as well as any compatibility impact._
