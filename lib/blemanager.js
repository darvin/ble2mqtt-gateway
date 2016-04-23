var noble = require('noble');

var events = require('events');
var util = require('util');



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
    if (characteristic){
        characteristic.write(data);
    } else {
        this.discover(blePath, function(error, characteristic) {
            if (!error) {
                if (characteristic) {
                    characteristic.write(data);
                }
            }
        });
    }
};

BLEManager.prototype.startScanning = function() {

    noble.on('stateChange', function(state) {
        if (state === 'poweredOn') {
            noble.startScanning([], true);
        } else {
            noble.stopScanning();
        }
    });

    noble.on('discover', this.onDiscover.bind(this));



};

BLEManager.prototype.onDiscover = function(peripheral) {
    console.log('DEVICE ' + peripheral.advertisement.localName + ' id: '+peripheral.uuid);

    if (peripheral.uuid in this.pathsTree()) {
        this.connectToPeripheral(peripheral);
    };
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
                                    console.log('CHAR discovered: ' + i + ' uuid: ' + characteristics[i].uuid);

                                    if (characteristics[i].uuid in self.pathsTree()[peripheral.uuid][service.uuid]) {

                                        console.log('CHAR CONNECTED: ' + i + ' uuid: ' + characteristics[i].uuid);
                                        var topicName = self.pathsTree()[peripheral.uuid][service.uuid][characteristics[i].uuid].topicName;

                                        self._characteristicsForPaths[topicName] = characteristics[i];
                                        self.emit("characteristicDiscovered", topicName, characteristics[i]);
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
