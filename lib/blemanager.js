var noble = require('noble');

var events = require('events');
var util = require('util');

var EXPECTED_MANUFACTURER_DATA_LENGTH = 25;
var APPLE_COMPANY_IDENTIFIER = 0x004c; // https://www.bluetooth.org/en-us/specification/assigned-numbers/company-identifiers
var IBEACON_TYPE = 0x02;
var EXPECTED_IBEACON_DATA_LENGTH = 0x15;



var BLEManager = function () {
    this._subscribedPaths = [];
    this._characteristicsForPaths = {};
    this._connectedPeripheral = {};

};

util.inherits(BLEManager, events.EventEmitter);

BLEManager.prototype.pathsTree = function() {
    var result = {};
    this._subscribedPaths.forEach(function(topic){
        var splitTopic = topic.split('/');
        var deviceID = splitTopic[0];
        var serviceID = splitTopic[1];
        var charID = splitTopic[2];

        if (!(deviceID in result)){
            result[deviceID] = {};
        }
        var device = result[deviceID];

        if (serviceID) {
            if (!(serviceID in device)) {
                device[serviceID] = {};
            }
            var service = device[serviceID];
            if (charID) {
                if (!(charID in service)) {
                    service[charID] = {};
                }
                var char = service[charID];
                char.topicName = topic;

            }

        }

    });

    return result;
};
BLEManager.prototype.discover = function(blePath, callback) {
    this._subscribedPaths.push(blePath);
    if (callback) {
        var self = this;
        var listener = function(discoveredBlePath, characteristic) {
            if (discoveredBlePath==blePath) {
                self.removeListener("characteristicDiscovered", listener);
                callback(null, characteristic);
            }
        };
        this.on("characteristicDiscovered", listener);
    }
};



BLEManager.prototype.write = function(blePath, data) {
    var characteristic = this._characteristicsForPaths[blePath];
    var writeChar = function(characteristic) {
        characteristic.write(data, true , function(error) {
            console.log("Written! error: "+error);
        });

    }
    if (characteristic){
        console.log("writing "+data + " to "+characteristic);
        writeChar(characteristic);
    } else {
        this.discover(blePath, function(error, characteristic) {
            if (!error) {
                writeChar(characteristic);

            }
        });
    }
};

BLEManager.prototype.startScanning = function() {
    var nobleScan = function() {
        noble.startScanning([], true);
    }
    console.log("start scanning");
    if (noble.state=="poweredOn") {
        nobleScan();
    }
    noble.on('stateChange', function(state) {
        if (state === 'poweredOn') {
            nobleScan();
        } else {
            noble.stopScanning();
        }
    });

    noble.on('discover', this.onDiscover.bind(this));
    noble.on('notify', this.onNotify.bind(this));



};


BLEManager.prototype.onNotify = function(characteristic, data) {

};


BLEManager.prototype.onDiscover = function(peripheral) {
    // console.log('DEVICE ' + peripheral.advertisement.localName + ' id: '+peripheral.uuid);

    if (peripheral.uuid in this.pathsTree()) {
        this.connectToPeripheral(peripheral);
    };


    var manufacturerData = peripheral.advertisement.manufacturerData;
    var rssi = peripheral.rssi;

    if (manufacturerData &&
        EXPECTED_MANUFACTURER_DATA_LENGTH <= manufacturerData.length &&
        APPLE_COMPANY_IDENTIFIER === manufacturerData.readUInt16LE(0) &&
        IBEACON_TYPE === manufacturerData.readUInt8(2) &&
        EXPECTED_IBEACON_DATA_LENGTH === manufacturerData.readUInt8(3)) {
        var uuid = manufacturerData.slice(4, 20).toString('hex');
        var major = manufacturerData.readUInt16BE(20);
        var minor = manufacturerData.readUInt16BE(22);
        var measuredPower = manufacturerData.readInt8(24);

        var accuracy = Math.pow(12.0, 1.5 * ((rssi / measuredPower) - 1));
        this.emit("ibeaconFound", uuid+"/"+major+"/"+minor, accuracy);
    }
};

BLEManager.prototype.connectToPeripheral = function connectToPeripheral(peripheral) {
    var self = this;
    if (!(peripheral.uuid in this._connectedPeripheral)) {
        this._connectedPeripheral[peripheral.uuid] = peripheral;
        peripheral.connect(function (error) {
            if (error) { console.error("BLE ERROR: "+error); return; }
            console.log("CONNECT: "+peripheral.uuid);
            peripheral.discoverServices(null, function(error, services) {
                if (error) { console.error("BLE ERROR: "+error); return; }

                for (var i in services) {
                    console.log('SERVICE discovered:  ' + i + ' uuid: ' + services[i].uuid);
                    if (services[i].uuid in self.pathsTree()[peripheral.uuid]) {
                        console.log('SERVICE CONNECTED:  ' + i + ' uuid: ' + services[i].uuid);
                        (function(service) {
                            service.discoverCharacteristics(null, function(error, characteristics){
                                if (error) { console.error("BLE ERROR: "+error); return; }

                                for (var i in characteristics) {
                                    var char = characteristics[i];
                                    console.log('CHAR discovered: ' + i + ' uuid: ' + char.uuid);

                                    if (char.uuid in self.pathsTree()[peripheral.uuid][service.uuid]) {

                                        console.log('CHAR CONNECTED: ' + i + ' uuid: ' + char.uuid);
                                        var topicName = self.pathsTree()[peripheral.uuid][service.uuid][char.uuid].topicName;

                                        self._characteristicsForPaths[topicName] = char;
                                        self.emit("characteristicDiscovered", topicName, char);

                                        //char.notify(true);
                                    }

                                }

                            });
                        })(services[i]);
                    }

                }
            });

        });
    }

}


module.exports = BLEManager;
