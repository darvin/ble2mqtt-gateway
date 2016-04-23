var events = require('events');
var util = require('util');
var mqtt    = require('mqtt');

var MQTTManager = function () {
    this._client = null;
};

util.inherits(MQTTManager, events.EventEmitter);



MQTTManager.prototype.postBeacon = function(beaconPath, data) {
    this._client.publish("ble/ibeacons/"+beaconPath, data.toString());
};

MQTTManager.prototype.readUpdated = function(blePath, data) {
    this._client.publish("ble/"+blePath, data);
};

MQTTManager.prototype.onMessage = function (topic, message) {
    // message is Buffer
    var regWrite = /^ble\/(.*)\/write$/;
    var regDiscover = /^ble\/(.*)\/discover$/;
    var data = message;

    try {
        var msgString = message.toString();
        data = new Buffer(msgString, "hex");
        console.log("Writing request:  "+ msgString+ " decoded!");
    } catch (err) {

    }

    if (topic.match(regWrite)) {
        this.emit('write', topic.match(regWrite)[1], data);
    }

    if (topic.match(regDiscover)) {
        this.emit('discover', topic.match(regDiscover)[1]);
    }

}


MQTTManager.prototype.connect = function(opts, callback) {
    this._client = mqtt.connect(opts);
    this._client.on('connect', function () {
        console.log("mqtt connected");
        this.subscribe("ble/#");
        callback();

    });

    this._client.on('message', this.onMessage.bind(this));

    this._client.on("error", function(error) {
        console.log("ERROR: ", error);
    });

    this._client.on('offline', function() {
        console.log("offline");
    });

    this._client.on('reconnect', function() {
        console.log("reconnect");
    });

};


module.exports = MQTTManager;
