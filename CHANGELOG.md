## v0.0.4 (TODO)

* Add Write operation to perform changes on managed devices
* Add SNMP Trap trigger to receive Trap (v1/v2) and Inform requests from agents

## v0.0.3 (2025-10-04)

* Add the Read Table operation to read subtrees like `BASE.1.COLUMN.ENTRY`, in tabular form
* Add SNMP credentials (v1, v2c, v3)

## v0.0.2 (2025-09-28)

* Fixes the plugin failing to install

## v0.0.1 (2025-09-28)

Initial release, contains the following operations:

* List OIDs: works like snmpwalk, walks over a part of the MIB tree and retrieves all descendants
* Get Values: Retrieves the value of one or multiple OIDs
