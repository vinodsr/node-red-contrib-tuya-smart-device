const TuyaDevice = require("tuyapi");

module.exports = function (RED) {
    function TuyaSmartDeviceNode(config) {
        RED.nodes.createNode(this, config);
        let node = this;
        let shouldTryReconnect = true;
        this.deviceName = config.deviceName;
        this.deviceId = config.deviceId;
        this.deviceKey = config.deviceKey;
        node.on('input', function (msg) {
            let operation = msg.payload.operation || 'SET';
            delete msg.payload.operation;
            switch (operation) {
                case "SET":
                    tuyaDevice.set(msg.payload);
                    break;
                case "GET":
                    tuyaDevice.get(msg.payload);
                    break;
            }
        });
        let setStatusConnecting = function () { return node.status({ fill: "yellow", shape: "ring", text: "connecting" }); };
        let setStatusConnected = function () { return node.status({ fill: "green", shape: "ring", text: "connected" }); };
        let setStatusDisconnected = function () { return node.status({ fill: "red", shape: "ring", text: "disconnected" }); };
        var setStatusOnError = function (e) {
            node.error(e, "An error had occured ");
            return node.status({ fill: "red", shape: "ring", text: "error" });
        };

        let tuyaDevice = new TuyaDevice({
            id: node.deviceId,
            key: node.deviceKey,
        });


        node.on('close', function () {
            // tidy up any state
            // clearInterval(int);
            shouldTryReconnect = false;
            tuyaDevice.disconnect();
        });


        // Add event listeners
        tuyaDevice.on('connected', () => {
            node.log('Connected to device! ' + node.deviceId);
            setStatusConnected();
        });

        tuyaDevice.on('disconnected', () => {
            node.log('Disconnected from tuyaDevice.');
            setStatusDisconnected();
            if (shouldTryReconnect) {
                setTimeout(() => {
                    connectDevice();
                }, 1000)
            }

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
                    deviceId: node.deviceId,
                    deviceName: node.deviceName
                }
            });
        });

        let connectDevice = () => {
            setStatusConnecting();
            tuyaDevice.connect();
        }

        tuyaDevice.find().then(() => {
            // Connect to device
            connectDevice();
        }).catch(setStatusOnError);
    }
    RED.nodes.registerType("tuya-smart-device", TuyaSmartDeviceNode);
}