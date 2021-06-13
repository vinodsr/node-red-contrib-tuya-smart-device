const TuyaDevice = require("tuyapi");
const packageInfo = require("../package.json");
// ms 10/06, to get clean debug: SET DEBUG = tuya-smart-device (TuyAPI)
const debug = require('debug')('tuya-smart-device');

const CLIENT_STATUS = {
    DISCONNECTED: "DISCONNECTED",
    CONNECTED: "CONNECTED",
    CONNECTING: "CONNECTING",
    ERROR: "ERROR",
};

// ms 10/06 I found the default 1000 too short and this avoids magic numbers.
const DEFAULTTIMEUT = 2000;
const MINIMALTIMEOUT = 100;

// ms 11/06 for errors filtering
const TUYAPIERRORTIMEOUT = "Error: connection timed out";
const TUYAPIERRORFIND = "Error: find() timed out.";
const TUYAPIERRORWAITING = "Timeout waiting for status";
const TUYAPIERRORPAYLOAD = "TypeError: Packet missing payload";
// "TypeError: ID and IP are missing" OK as is, FATAL
// "TypeError: Key is missing" OK as is, FATAL
// "Error from socket" maybe to be filtered, but difficult to reproduce
// "json object data unvalid" maybe to be filtered, but difficult to reproduce

module.exports = function (RED) {
    function TuyaSmartDeviceNode(config) {
        RED.nodes.createNode(this, config);
        config.disableAutoStart = config.disableAutoStart || false;
        let node = this;
        let isConnected = false;
        let shouldTryReconnect = true;
        let shouldSubscribeData = true;
        let shouldSubscribeRefreshData = true;
        this.name = config.deviceName;
        this.deviceName = config.deviceName;
        this.deviceId = config.deviceId;
        this.deviceIp = config.deviceIp;
        this.deviceKey = config.deviceKey;
        this.disableAutoStart = config.disableAutoStart;
        this.eventMode = config.eventMode || "event-both";

        // ms 08/06 reduces and anonymize. On log, because one time and contains useful info
        let publicConfig = Object.keys(config).filter(key => !['deviceId', 'deviceKey', 'deviceIp', 'x', 'y', 'wires', 'info'].includes(key)).reduce((obj, key) => {
            obj[key] = config[key];
            return obj;
        }, {});
        node.log("Received the config");
        node.log(JSON.stringify({
                ...publicConfig,
                moduleVersion: packageInfo.version
            }, null, 4));

        // ms 10/06 cleanup old  code
        this.retryTimeout = (isNaN(config.retryTimeout) || (config.retryTimeout < MINIMALTIMEOUT))
         ? DEFAULTTIMEUT : Number(config.retryTimeout);
        this.findTimeout = (isNaN(config.findTimeout) || (config.findTimeout < MINIMALTIMEOUT))
         ? DEFAULTTIMEUT : Number(config.findTimeout);

        this.tuyaVersion =
            config.tuyaVersion == null ||
            typeof config.tuyaVersion == "undefined" ||
            (typeof config.tuyaVersion == "string" &&
                config.tuyaVersion.trim() == "") ||
            (typeof config.tuyaVersion == "number" && config.tuyaVersion <= 0) ||
            isNaN(config.tuyaVersion) ? "3.1" : config.tuyaVersion.trim();

        // ms 07/06 to send also the first DISCONNECTED/RECONNECT
        this.deviceStatus = null;
        // Variable definition ends here

        // ms 10/06 cleanup old  code
        if (this.eventMode == "event-data") {
            shouldSubscribeRefreshData = false;
        } else if (this.eventMode == "event-dp-refresh") {
            shouldSubscribeData = false;
        }

        debug('UI: shouldSubscribeData = ' + shouldSubscribeData);
        debug('UI: shouldSubscribeRefreshData = ' + shouldSubscribeRefreshData);

        let findTimeoutHandler = null;
        let retryTimerHandler = null;

        node.on("input", function (msg) {
            debug('[onInput] received the input msg:');
            debug(msg);
            let operation = msg.payload.operation || "SET";
            delete msg.payload.operation;
            if (["GET", "SET", "REFRESH"].indexOf(operation) != -1) {
                // the device has to be connected.
                if (!tuyaDevice.isConnected()) {
                    // Warning device not connected
                    node.log(`Device disconnected. Skipped the ${operation} operation`);
                    debug('[onInput] exit: not connected, skip');
                    return;
                }
            }

            switch (operation) {
            case "SET":
                // ms 10/06 added limited check, to prevent grave device errors
                if ((msg.payload.set === undefined) && (msg.payload.multiple == undefined)) {
                    node.log('Malformed SET command: skipped.');
                    node.log(JSON.stringify(msg, null, 4));
                    debug('[onInput] exit: malformed SET, skip');
                } else
                    tuyaDevice.set(msg.payload);
                debug('[onInput] exit: OK, called tuyaDevice.set()');
                break;
            case "REFRESH":
                tuyaDevice.refresh(msg.payload);
                debug('[onInput] exit: OK, called tuyaDevice.refresh()');
                break;
            case "GET":
                // ms 10/06 added limited check, to prevent grave device errors
                if ((msg.payload.dps === undefined) && (msg.payload.schema == undefined)) {
                    node.log('Malformed GET command: skipped.');
                    node.log(JSON.stringify(msg, null, 4));
                } else
                    tuyaDevice.get(msg.payload);
                debug('[onInput] exit: OK, called tuyaDevice.get()');
                break;
            case "CONTROL":
                debug(`Device connected = ${tuyaDevice.isConnected()}`);
                switch (msg.payload.action) {
                case 'CONNECT':
                    // ms 07/06 the test here reduces messages
                    if (!tuyaDevice.isConnected()) {
                        debug('[onInput] exit: OK, called startComm()');
                        startComm();
                    } else
                        debug('[onInput] exit: OK, already connected ');
                    break;
                case 'DISCONNECT':
                    // DISCONNECT when device already disconnected is OK
                    // so we stop the  connecting loop: the device will not auto re-connected
                    closeComm();
                    node.log("Device in STANDBY: is required a CONNECT COMMAND to connect.");
                    break;
                case 'RECONNECT':
                    // ms 07/06 this differentiate from CONNECT
                    if (tuyaDevice.isConnected()) {
                        closeComm();
                    }
                    startComm();
                    debug('[onInput] exit: OK, called (re)startComm()');
                    break;
                case 'SET_FIND_TIMEOUT':
                    if (!isNaN(msg.payload.value) && msg.payload.value >= MINIMALTIMEOUT) {
                        setFindTimeout(msg.payload.value);
                        debug('[onInput] exit: OK, called setFindTimeout()');
                    } else {
                        node.log(`Invalid find timeout (${msg.payload.value}): Skipped.`);
                    }
                    break;
                case 'SET_RETRY_TIMEOUT':
                    if (!isNaN(msg.payload.value) && msg.payload.value >= MINIMALTIMEOUT) {
                        setRetryTimeout(msg.payload.value);
                        debug('[onInput] exit: OK, called setRetryTimeout()');
                    } else {
                        node.log(`Invalid retry timeout (${msg.payload.value}): Skipped.`);
                    }
                    break;
                default:
                    // ms 10/06 added warning
                    node.log(`Invalid CONTROL command: skipped.`);
                    node.log(JSON.stringify(msg, null, 4));
                } // end CONTROL
                break;
            default:
                // ms 10/06 added warning
                node.log(`Malformed DATA command. Skipped.`);
                node.log(JSON.stringify(msg, null, 4));
            } // end OPERATION
        });

        const enableNode = () => {
            debug("[enableNode] enabling the node " + node.id);
            startComm();
        };

        const disableNode = () => {
            debug("[disableNode] disabling the node  " + node.id);
            closeComm();
        };

        const setFindTimeout = (newTimeout) => {
            debug("[setFindTimeout()] Setting new find timeout: " + newTimeout);
            node.findTimeout = newTimeout;
        };

        const setRetryTimeout = (newTimeout) => {
            debug("[setRetryTimeout()] Setting new retry timeout: " + newTimeout);
            node.retryTimeout = newTimeout;
        };

        const closeComm = () => {
            debug("[closeComm] Clearing findTimeoutHandler and disconnecting");
            clearTimeout(findTimeoutHandler);
            shouldTryReconnect = false;
            tuyaDevice.disconnect();
            setStatusDisconnected();
        };

        const startComm = () => {
            // ms 07/06 generates superfluous messages
            //        closeComm();
            //  If required, (never in my tests) the setTimeout()...
            //  must be placed not here but on the 'RECONNECT' case,
            //  the unique condition where a closeComm() is followed by a startComm().
            debug("[startComm]  Connecting to Tuya with params:");
            debug(connectionParams);
            shouldTryReconnect = true;
            findDevice();
        };

        const sendDeviceConnectStatus = (data) => {
            return {
                payload: {
                    state: node.deviceStatus,
                    ...data,
                },
            };
        };
        const setStatusConnecting = function () {
            debug("[setStatusConnecting] old status = " + node.deviceStatus);
            if (node.deviceStatus != CLIENT_STATUS.CONNECTING) {
                node.deviceStatus = CLIENT_STATUS.CONNECTING;
                node.send([null, sendDeviceConnectStatus()]);
            }
            return node.status({
                fill: "yellow",
                shape: "ring",
                text: "node-red:common.status.connecting"
            });
        };
        const setStatusConnected = function () {
            debug("[setStatusConnected] old status = " + node.deviceStatus);
            if (node.deviceStatus != CLIENT_STATUS.CONNECTED) {
                node.deviceStatus = CLIENT_STATUS.CONNECTED;
                node.send([null, sendDeviceConnectStatus()]);
            }
            return node.status({
                fill: "green",
                shape: "ring",
                text: "node-red:common.status.connected"
            });
        };
        const setStatusDisconnected = function () {
            debug("[setStatusDisconnected] old status = " + node.deviceStatus);
            if (node.deviceStatus != CLIENT_STATUS.DISCONNECTED) {
                node.deviceStatus = CLIENT_STATUS.DISCONNECTED;
                node.send([null, sendDeviceConnectStatus()]);
            }
            return node.status({
                fill: "red",
                shape: "ring",
                // for internationalization
                text: "node-red:common.status.disconnected"
            });
        };

        const setStatusOnError = function (
            errorText,
            errorShortText = "error",
            data) {
            data.message = errorText;
            node.error(errorText, data);
            node.send([null, {
                        payload: {
                            state: CLIENT_STATUS.ERROR,
                            ...data,
                        }
                    }
                ]);
            // ERROR is not a state, is a message: device can be connected before and after the error
            return node.status({
                fill: "red",
                shape: "ring",
                text: errorShortText
            });
        };

        const connectionParams = {
            id: node.deviceId,
            key: config.deviceKey,
            ip: node.deviceIp,
            nullPayloadOnJSONError: false,
            issueGetOnConnect: false,
            issueRefreshOnConnect: false,
            version: node.tuyaVersion
        };

        let tuyaDevice = new TuyaDevice(connectionParams);

        let retryConnection = () => {
            debug("[retryConnection] entry");
            clearTimeout(retryTimerHandler);
            retryTimerHandler = setTimeout(() => {
                connectDevice();
            }, node.retryTimeout);
            node.log(`Will try to reconnect after ${node.retryTimeout} milliseconds`);
        };

        node.on("close", function () {
            debug("[onClose] entry.");
            // tidy up any state
            // clearInterval(int);
            closeComm();
        });

        // Add event listeners
        tuyaDevice.on("connected", () => {
            debug("[onConnected] entry.");
            node.log("Connected to tuyaDevice! ");
            setStatusConnected();
        });

        tuyaDevice.on("disconnected", () => {
            debug("[onDisconnected] entry.");
            node.log(
                "Disconnected from tuyaDevice. shouldTryReconnect = " +
                shouldTryReconnect);
            setStatusDisconnected();
            if (shouldTryReconnect) {
                retryConnection();
            }
        });

        tuyaDevice.on("error", (error) => {
            node.log("ERROR from TuyAPI onError: ");
            debug(error);
            //       node.warn(["error:", error.toString(), error]); // temporary

            // error selection, todo: update more cases
            let info = {
                inFunction: "onError",
                deviceName: node.deviceName,
                deviceId: node.deviceId,
                deviceIp: node.deviceIp
            };
            // error selection, todo add more cases

            if (error.toString().startsWith(TUYAPIERRORPAYLOAD)) {
                // nothing to do, bad data packet from device
                node.log("[HIT] nothing to do.");
            } else
                if (error.toString().startsWith(TUYAPIERRORWAITING)) {
                    //  optional to send it to debug-pad via setStatusOnError():
                    //     'bad DP' is a FATAL error? maybe,it can have more causes?...
                    // ok, sended: now changing the STATE messages (but in debug the originals)
                    let longError = "Status timeout while waiting for device data.";
                    let shortError = "Error: data timeout";
                    setStatusOnError(longError, shortError, {
                        context: info
                    });
                    // in any case, goes to log:
					// in my devices that error from: bad KEY, nonexistent DPS, bad value (e.g. string in place of boolean) 
                    node.log("[HIT] Check the KEY, the DPS, and if the value is valid for this DPS.");
                } else { // default for unknown (?) errors
                    setStatusOnError(error, "Error: " + error, {
                        context: info
                    });
                    node.log("Unexpected error.");
                }
            // always retryConnection(): for connecting loop or for node status look update.
            if (shouldTryReconnect) {
                retryConnection();
            }
        });

        tuyaDevice.on("dp-refresh", (data) => {
            debug('[onDP_rerfresh] entry with shouldSubscribeRefreshData = ' + shouldSubscribeRefreshData);
            debug(data);
            if (shouldSubscribeRefreshData) {
                //                setStatusConnected();
                node.send([{
                            payload: {
                                data: data,
                                deviceId: node.deviceId,
                                deviceName: node.deviceName,
                            },
                        },
                        null,
                    ]);
            }
        });

        tuyaDevice.on("data", (data) => {
            debug('[onData] entry with shouldSubscribeData = ' + shouldSubscribeData);
            debug(data);
            if (shouldSubscribeData) {
                node.send([{
                            payload: {
                                data: data,
                                deviceId: node.deviceId,
                                deviceName: node.deviceName,
                            },
                        },
                        null,
                    ]);
            }
        });

        let connectDevice = () => {
            debug('[connectDevice] entry with device connected = ' + tuyaDevice.isConnected());
            clearTimeout(findTimeoutHandler);
            if (tuyaDevice.isConnected() === false) {
                setStatusConnecting();
                const connectHandle = tuyaDevice.connect();
                connectHandle.catch((e) => {
                    setStatusDisconnected();
                    node.log("ERROR from TuyAPI connect(): ");
                    //                   node.warn(["error:", e.toString(), e]); // temporary
                    let info = {
                        inFunction: "connectDevice",
                        deviceName: node.deviceName,
                        deviceId: node.deviceId,
                        deviceIp: node.deviceIp
                    };
                    // error selection, todo add more cases
                    if (e.toString() === TUYAPIERRORTIMEOUT) {
                        // nothing to do, loop CONNECTING-DISCONNECTED
                        node.log("[HIT] If device OFF nothing to do: auto-retry connection, else check device ID/IP.");
                    } else { // default for unknown (?) errors
                        setStatusOnError(e, "Error: " + e, {
                            context: info
                        });
                        node.log("Unexpected error.");
                    }

                    if (shouldTryReconnect) {
                        debug("[connectDevice] exit: retry the connection");
                        clearTimeout(findTimeoutHandler);
                        findTimeoutHandler = setTimeout(findDevice, node.retryTimeout);
                    } else {
                        debug("[connectDevice] exit: not retrying the find as shouldTryReconnect = false");
                    }
                });
            } else {
                debug("[connectDevice] exit: already connected. skipping the connection call");
                setStatusConnected();
            }
        };

        let findDevice = () => {
            debug('[findDevice] entry ');
            setStatusConnecting();
            tuyaDevice
            .find({
                timeout: parseInt(node.findTimeout / 1000),
            })
            .then(() => {
                debug("[findDevice] exit: Found device, going to connect");
                // Connect to device
                connectDevice();
            })
            .catch((e) => {
                debug('[findDevice] An error had occurred in tuyAPI :');
                debug(e);
                //              node.warn(["error:", e.toString(), e]); // temporary
                let info = {
                    inFunction: "findDevice",
                    deviceName: node.deviceName,
                    deviceId: node.deviceId,
                    deviceIp: node.deviceIp
                };

                node.log("ERROR from TuyAPI in findDevice: ");
                // error selection, todo add more cases
                if (e.toString().startsWith(TUYAPIERRORFIND)) {
                    // nothing to do, loop CONNECTING-DISCONNECTED
                    node.log("[HIT] If device OFF nothing to do: auto-retry connection, else check device ID/IP.");

                } else { // default
                    setStatusOnError(e, "Error: " + e, {
                        context: info
                    });
                    node.log("Unexpected error.");
                }

                setStatusDisconnected();
                if (shouldTryReconnect) {
                    debug("[findDevice] exit: Cannot find the device, re - trying...");
                    findTimeoutHandler = setTimeout(findDevice, node.retryTimeout);
                } else {
                    debug("[findDevice] exit: not retrying the find as shouldTryReconnect = false ");
                }
            });
        };

        // Start probing
        if (!node.disableAutoStart) {
            node.log(" Auto start probe on connect...");
            startComm();
        } else {
            node.log(" Auto start probe is disabled ");
            setTimeout(() => {
                setStatusDisconnected();
                node.log(" Device in STANDBY: is required a CONNECT COMMAND to connect.");
            }, 2000);
        }
    }

    RED.nodes.registerType("tuya-smart-device", TuyaSmartDeviceNode);
};
