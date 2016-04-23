#!/usr/bin/env node
/**
 * Created by darvin on 4/17/16.
 */
var argv = require('yargs').number("delay").argv;

var BLEManager = require("./lib/blemanager");
var MQTTManager = require("./lib/mqttmanager");

module.exports = {

}

function start () {




    var ble = new BLEManager();
    var mqtt = new MQTTManager();


    mqtt.on('discover', function(blePath) {
        ble.discover(blePath);
    });

    mqtt.on('write', function(blePath, data) {
        ble.write(blePath, data);
    });


    ble.on('notify', function(blePath, data) {
        mqtt.readUpdated(blePath, data);
    });

    ble.on('ibeaconFound', function(uuid, major, minor, accuracy){
       mqtt.postBeacon(uuid, major, minor, accuracy);
    });

    mqtt.connect({
        host:"localhost",
        qos: 0,
        retain: false,
        clean: true,
        //keepAlive: 5, // 30 sec
        clientId:"ble2mqtt_gateway"

    }, function() {
        ble.startScanning();
    });

}


if (require.main === module) {

    setTimeout(start,argv.delay || 0);
}