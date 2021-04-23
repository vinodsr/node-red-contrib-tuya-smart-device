const TuyaDevice = require("tuyapi");

module.exports = function (RED) {
    function TuyaSmartDeviceNode(config) {
        RED.nodes.createNode(this, config);
        let node = this;
        let isConnected = false;
        let shouldTryReconnect = true;
        let shouldSubscribeData = true;
        let shouldSubscribeRefreshData = true;
        this.name = config.deviceName;
        this.deviceName = config.deviceName;
        this.deviceId = config.deviceId;
        this.deviceIp = config.deviceIp;
        this.eventMode = config.eventMode || 'event-both'
        node.log(`Recieved the config ${JSON.stringify(config)}`);
        this.retryTimeout = (config.retryTimeout == null || typeof config.retryTimeout == "undefined" || (typeof config.retryTimeout == "string" && config.retryTimeout.trim() == "") || (typeof config.retryTimeout == "number" && config.retryTimeout <= 0) || isNaN(config.retryTimeout)) ? 1000 : config.retryTimeout;
        this.findTimeout = (config.findTimeout == null || typeof config.findTimeout == "undefined" || (typeof config.findTimeout == "string" && config.findTimeout.trim() == "") || (typeof config.findTimeout == "number" && config.findTimeout <= 0) || isNaN(config.findTimeout)) ? 1000 : config.findTimeout;
        this.tuyaVersion = (config.tuyaVersion == null || typeof config.tuyaVersion == "undefined" || (typeof config.tuyaVersion == "string" && config.tuyaVersion.trim() == "") || (typeof config.tuyaVersion == "number" && config.tuyaVersion <= 0) || isNaN(config.tuyaVersion)) ? '3.1' : config.tuyaVersion.trim();

        if (this.eventMode == 'event-data') {
            shouldSubscribeData = true;
            shouldSubscribeRefreshData = false;
        } else if (this.eventMode == 'event-dp-refresh') {
            shouldSubscribeData = false;
            shouldSubscribeRefreshData = true;
        } else { // both case or default case
            shouldSubscribeData = true;
            shouldSubscribeRefreshData = true;
        }
        node.log(`Event subscription : shouldSubscribeData=>${shouldSubscribeData} , shouldSubscribeRefreshData=>${shouldSubscribeRefreshData}`);
        if (this.retryTimeout <= 0) {
            this.retryTimeout = 1000;
        }

        if (this.findTimeout <= 0) {
            this.findTimeout = 1000;
        }
        let findTimeoutHandler = null;
        let retryTimerHandler = null;

        this.deviceKey = config.deviceKey;
        node.on('input', function (msg) {
            let operation = msg.payload.operation || 'SET';
            delete msg.payload.operation;
            switch (operation) {
                case "SET":
                    tuyaDevice.set(msg.payload);
                    break;
                case "REFRESH":
                    tuyaDevice.refresh(msg.payload);
                    break;
                case "GET":
                    tuyaDevice.get(msg.payload);
                    break;
            }
        });
        let setStatusConnecting = function () { return node.status({ fill: "yellow", shape: "ring", text: "connecting" }); };
        let setStatusConnected = function () { return node.status({ fill: "green", shape: "ring", text: "connected" }); };
        let setStatusDisconnected = function () { return node.status({ fill: "red", shape: "ring", text: "disconnected" }); };
        var setStatusOnError = function (errorText, errorShortText = "error", data) {
            node.error(errorText, data);
            return node.status({ fill: "red", shape: "ring", text: errorShortText });
        };
        const connectionParams = {
            id: node.deviceId,
            key: node.deviceKey,
            ip: node.deviceIp,
            issueGetOnConnect: false,
            nullPayloadOnJSONError: false,
            version: node.tuyaVersion
        };
        node.log(`Connecting to Tuya with params ${JSON.stringify(connectionParams)} , findTimeout :  ${node.findTimeout} , retryTimeout:  ${node.retryTimeout} `);
        let tuyaDevice = new TuyaDevice(connectionParams);

        let retryConnection = () => {
            clearTimeout(retryTimerHandler);
            retryTimerHandler = setTimeout(() => {
                connectDevice();
            }, node.retryTimeout)
        }
        node.on('close', function () {
            // tidy up any state
            // clearInterval(int);
            node.log("Cleaning up the state");
            shouldTryReconnect = false;
            tuyaDevice.disconnect();
            node.log("Clearing the find timeout handler");
            clearTimeout(findTimeoutHandler);

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
            setStatusOnError(error, 'Error', {
                context: {
                    message: error,
                    deviceVirtualId: node.deviceId,
                    deviceIp: node.deviceIp,
                    deviceKey: node.deviceKey
                }
            });
            if (shouldTryReconnect) {
                retryConnection();
            }
        });

        if (shouldSubscribeRefreshData) {
            tuyaDevice.on('dp-refresh', data => {
                node.log(`Data from device  [event:dp-refresh]: ${JSON.stringify(data)}`);
                setStatusConnected();
                node.send({
                    payload: {
                        data: data,
                        deviceId: node.deviceId,
                        deviceName: node.deviceName
                    }
                });
            });
        }

        if (shouldSubscribeData) {
            tuyaDevice.on('data', data => {
                node.log(`Data from device  [event:data]: ${JSON.stringify(data)}`);
                setStatusConnected();
                node.send({
                    payload: {
                        data: data,
                        deviceId: node.deviceId,
                        deviceName: node.deviceName
                    }
                });
            });
        }
        let connectDevice = () => {
            clearTimeout(findTimeoutHandler);
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
                setStatusOnError(e.message, "Can't find device", {
                    context: {
                        message: e,
                        deviceVirtualId: node.deviceId,
                        deviceIp: node.deviceIp,
                        deviceKey: node.deviceKey
                    }
                });
                if (shouldTryReconnect) {
                    node.log("Cannot find the device, re-trying...");
                    findTimeoutHandler = setTimeout(findDevice, node.findTimeout);
                } else {
                    node.log("not retrying the find as shouldTryReconnect = false");
                }

            });
        }
        findTimeoutHandler = setTimeout(() => {
            findDevice();
        }, 1000)

    }
    RED.nodes.registerType("tuya-smart-device", TuyaSmartDeviceNode);
}