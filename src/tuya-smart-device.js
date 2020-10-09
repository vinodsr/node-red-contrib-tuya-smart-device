const TuyaDevice = require("tuyapi");

module.exports = function (RED) {
    function TuyaSmartDeviceNode(config) {
        RED.nodes.createNode(this, config);
        let node = this;
        let isConnected = false;
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
        var setStatusOnError = function (e, message = "error") {
            node.error(e, "An error had occured ");
            return node.status({ fill: "red", shape: "ring", text: message });
        };

        let tuyaDevice = new TuyaDevice({
            id: node.deviceId,
            key: node.deviceKey,
        });

        let retryTimer = null;
        let retryConnection = () => {
            if (retryTimer !== null) {
                clearTimeout(retryTimer);
            }
            retryTimer = setTimeout(() => {
                connectDevice();
            }, 1000)
        }
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
                retryConnection();
            }

        });

        tuyaDevice.on('error', error => {
            setStatusOnError(error);
            if (shouldTryReconnect) {
                retryConnection();
            }
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
        let findTimeout = null;
        let connectDevice = () => {
            if (findTimeout) {
                clearTimeout(findTimeout);
            }
            if (tuyaDevice.isConnected() === false) {
                setStatusConnecting();
                tuyaDevice.connect();
            } else {
                node.log("already connected. skippig the connect call");
                setStatusConnected();
            }
        }
        let findDevice = () => {
            setStatusConnecting();
            node.log("initiating the find command");
            tuyaDevice.find().then(() => {
                // Connect to device
                connectDevice();
            }).catch((e) => {
                // We need to retry 
                setStatusOnError(e, "Can't find device");
                node.log("Cannot find the device, re-trying...");
                setTimeout(findDevice, 1000);
            });
        }
        findDevice();

    }
    RED.nodes.registerType("tuya-smart-device", TuyaSmartDeviceNode);
}