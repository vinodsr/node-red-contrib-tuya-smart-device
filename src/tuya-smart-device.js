const TuyaDevice = require("tuyapi");

module.exports = function (RED) {
    function TuyaSmartDeviceNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        this.name = config.name;
        this.id = config.id;
        this.key = config.key;
        node.on('input', function (msg) {
            tuyaDevice.set(msg.payload);
        });
        node.status({ fill: "yellow", shape: "ring", text: "connecting" });
        let setStatusConnected = function () { return node.status({ fill: "green", shape: "ring", text: "connected" }); };
        let setStatusDisconnected = function () { return node.status({ fill: "red", shape: "ring", text: "disconnected" }); };
        var setStatusOnError = function (e) {
            node.error(e, "An error had occured ");
            return node.status({ fill: "red", shape: "ring", text: "error" });
        };

        let tuyaDevice = new TuyaDevice({
            id: node.id,
            key: node.key,
        });


        node.on('close', function () {
            // tidy up any state
            // clearInterval(int);
            tuyaDevice.disconnect();
        });
        // Add event listeners
        tuyaDevice.on('connected', () => {
            node.log('Connected to device! ' + this.id);
            setStatusConnected();
        });

        tuyaDevice.on('disconnected', () => {
            node.log('Disconnected from tuyaDevice.');
            setStatusDisconnected();
            setTimeout(() => {
            }, 1000)
        });

        tuyaDevice.on('error', error => {
            setStatusOnError(error);
        });

        tuyaDevice.on('data', data => {
            node.log(data, 'Data from device:');

            setStatusConnected();
            node.send({
                payload: {
                    data: data,
                    deviceId: node.id,
                    deviceName: node.name
                }
            });
        });

        tuyaDevice.find().then(() => {
            // Connect to device
            tuyaDevice.connect();
        }).catch(setStatusOnError);
    }
    RED.nodes.registerType("tuya-smart-device", TuyaSmartDeviceNode);
}