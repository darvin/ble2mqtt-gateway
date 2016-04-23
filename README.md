## MQTT topics

 - `ble/<dev-id>/<service-id>/<char-id>/discover` - publish anything here for discovery. 
 Upon discovery, gateway will subscribe on characteristic
 - `ble/<dev-id>/<service-id>/<char-id>/write` - publish data that will be written to characteristic by gateway
 - `ble/<dev-id>/<service-id>/<char-id>` - subscribe to receive updates
 - `ble/ibeacons/<ibeacon-uuid>/<major>/<minor>` - subscribe to receive announcements of specific ibeacon