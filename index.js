#!/usr/bin/env node
/**
 * Created by darvin on 4/17/16.
 */


var noble = require('noble');
var mqtt    = require('mqtt');
var client  = null;


var topics = [
    "/bba0560c1107/ffe0/ffe1",
];

function topicsToTree() {
    var result = {};
    topics.forEach(function(topic){
        var splitTopic = topic.split('/');
        var deviceID = splitTopic[1];
        var serviceID = splitTopic[2];
        var charID = splitTopic[3];

        if (!(deviceID in result)){
            result[deviceID] = {};
        }
        var device = result[deviceID];

        if (!(serviceID in device)) {
            device[serviceID] = {};
        }
        var service = device[serviceID];

        if (!(charID in service)) {
            service[charID] = {};
        }
        var char = service[charID];
        char.topicName = topic;

    });

    return result;
}

var TOPICS_TREE = topicsToTree();
var CHARACTERISTICS_FOR_TOPICS = {};


function connectToPeripheral(peripheral) {
    peripheral.connect(function (error) {
        if (error) { console.error("BLE ERROR: "+error); return; }
        console.log("CONNECT: "+peripheral.uuid);
        peripheral.discoverServices(null, function(error, services) {
            if (error) { console.error("BLE ERROR: "+error); return; }

            for (var i in services) {
                console.log('SERVICE discovered:  ' + i + ' uuid: ' + services[i].uuid);
                if (services[i].uuid in TOPICS_TREE[peripheral.uuid]) {
                    console.log('SERVICE CONNECTED:  ' + i + ' uuid: ' + services[i].uuid);
		(function(service) {
		    service.discoverCharacteristics(null, function(error, characteristics){
                        if (error) { console.error("BLE ERROR: "+error); return; }

                        for (var i in characteristics) {
			    console.log('CHAR discovered: ' + i + ' uuid: ' + characteristics[i].uuid);
                            console.log (TOPICS_TREE, peripheral.uuid, service.uuid);
			
				if (characteristics[i].uuid in TOPICS_TREE[peripheral.uuid][service.uuid]) {

                                console.log('CHAR CONNECTED: ' + i + ' uuid: ' + characteristics[i].uuid);
                                var topicName = TOPICS_TREE[peripheral.uuid][service.uuid][characteristics[i].uuid].topicName;

                                client.subscribe(topicName);
                                CHARACTERISTICS_FOR_TOPICS[topicName] = characteristics[i];
                            }

                        }

                    });
})(services[i]);
                }

            }
        });

    });
}




function  scanDevices () {
    noble.on('stateChange', function(state) {
        if (state === 'poweredOn') {
            noble.startScanning();
        } else {
            noble.stopScanning();
        }
    });


    noble.on('discover', function(peripheral) {
        console.log('DEVICE ' + peripheral.advertisement.localName + ' id: '+peripheral.uuid);
        console.log();

        if (peripheral.uuid in TOPICS_TREE) {
            connectToPeripheral(peripheral);
        };
    });
}


function startMQTTClient() {
    client = mqtt.connect({
        host:"localhost",
        qos: 0,
        retain: false,
        clean: true,
        //keepAlive: 5, // 30 sec
        clientId:"ble2mqtt_gateway"

    });
    client.on('connect', function () {
console.log("mqtt connected");
        scanDevices();

    });

    client.on('message', function (topic, message) {
        // message is Buffer
        var msgString = message.toString();
        var msgBuffer = new Buffer(msgString, "hex");
        console.log("WRITE: "+topic+"  "+msgBuffer.toString('hex') + " to "+CHARACTERISTICS_FOR_TOPICS[topic]);

        CHARACTERISTICS_FOR_TOPICS[topic].write(msgBuffer, function(error) {
	if (error) {
console.log("ERROR: "+error);
} else {
console.log("WRITTEN!");
}
});
    });

    client.on("error", function(error) {
        console.log("ERROR: ", error);
    });

    client.on('offline', function() {
        console.log("offline");
    });

    client.on('reconnect', function() {
        console.log("reconnect");
    });

}


module.exports = startMQTTClient;

if (require.main === module) {
    startMQTTClient();
}
