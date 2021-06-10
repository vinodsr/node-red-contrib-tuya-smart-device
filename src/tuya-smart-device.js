const TuyaDevice = require("tuyapi");
const packageInfo = require("../package.json");
// to use trace debug
const debug = require('debug')('tuya-smart-device');

const CLIENT_STATUS = {
  DISCONNECTED: "DISCONNECTED",
  CONNECTED: "CONNECTED",
  CONNECTING: "CONNECTING",
  ERROR: "ERROR",
};
//ms 10/06 1000 is too little. so can be easy changed (avoid magic numbers).
const DEFAULTTIMEOUT = 2000;
const LIMITTIMEOUT = 1000;

// base version 4.1... differences marked '// ms 07/06, 05/06'
const VER = '4.1.1 ms 08/06';

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
    this.disableAutoStart = config.disableAutoStart;
    this.eventMode = config.eventMode || "event-both";
    // ms 08/06 reduces and anonymizes the log (this log because useful info about config)
     let publicConfig = Object.keys(config).filter(key => !['deviceId', 'deviceKey', 'deviceIp', 'x', 'y', 'wires', 'info'].includes(key)).reduce((obj, key) => {
            obj[key] = config[key];
            return obj;
         }, {});
       node.log(`Recieved the config ${JSON.stringify({ ...publicConfig, moduleVersion: packageInfo.version,})}`);
      // ms 10/06 old code cleanup
      this.retryTimeout =
        isNaN(config.retryTimeout) || (config.retryTimeout <= LIMITTIMEOUT)  ? DEFAULTTIMEOUT : config.retryTimeout;
      this.findTimeout =
        isNaN(config.findTimeout) || (config.findTimeout <= LIMITTIMEOUT)  ? DEFAULTTIMEOUT : config.findTimeout;

const CLIENT_STATUS = {
  DISCONNECTED: "DISCONNECTED",
  CONNECTED: "CONNECTED",
  CONNECTING: "CONNECTING",
  ERROR: "ERROR",
};
    
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
    this.disableAutoStart = config.disableAutoStart;
    this.eventMode = config.eventMode || "event-both";
    node.log(
      `Recieved the config ${JSON.stringify({
        ...config,
        moduleVersion: packageInfo.version,
      })}`
    );
    // ms 10/06 old code cleanup
     this.retryTimeout =
        isNaN(config.retryTimeout) || (config.retryTimeout <= LIMITTIMEOUT)  ? DEFAULTTIMEOUT : config.retryTimeout;
     this.findTimeout =
        isNaN(config.findTimeout) || (config.findTimeout <= LIMITTIMEOUT)  ? DEFAULTTIMEOUT : config.findTimeout;

     this.tuyaVersion =
      config.tuyaVersion == null ||
      typeof config.tuyaVersion == "undefined" ||
      (typeof config.tuyaVersion == "string" &&
        config.tuyaVersion.trim() == "") ||
      (typeof config.tuyaVersion == "number" && config.tuyaVersion <= 0) ||
      isNaN(config.tuyaVersion)
        ? "3.1"
        : config.tuyaVersion.trim();
    
    //  ms 07/06 to send the first STATE
    this.deviceStatus = null;
    // Variable definition ends here

    // ms 10/06 old code cleanup
    if (this.eventMode == "event-data") {
       shouldSubscribeRefreshData = false;
    } else if (this.eventMode == "event-dp-refresh") {
       shouldSubscribeData = false;
    }
    node.log(
      `Event subscription : shouldSubscribeData=>${shouldSubscribeData} , shouldSubscribeRefreshData=>${shouldSubscribeRefreshData}`
    );
    /*
   // ms 10/06 old code cleanup
    if (this.retryTimeout <= 0) {
      this.retryTimeout = 1000;
    }

    if (this.findTimeout <= 0) {
      this.findTimeout = 1000;
    }
    */
    let findTimeoutHandler = null;
    let retryTimerHandler = null;

    this.deviceKey = config.deviceKey;
    
    node.on("input", function (msg) {
      node.log(`Recieved input : ${JSON.stringify(msg)}`);
      let operation = msg.payload.operation || "SET";
      delete msg.payload.operation;
      if (["GET", "SET", "REFRESH"].indexOf(operation) != -1) {
        // the device has to be connected.
        if (!tuyaDevice.isConnected()) {
          // error device not connected
          let errText = `Device not connected. Can't send the ${operation} commmand`;
          node.log(errText);
          setStatusOnError(errText, "Device not connected !", {
            context: {
              message: errText,
              deviceVirtualId: node.deviceId,
              deviceIp: node.deviceIp,
              deviceKey: node.deviceKey,
            },
          });
          return;
        }
      }
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
        case "CONTROL":
          if (msg.payload.action == "CONNECT") {
            startComm();
          } else if (msg.payload.action == "DISCONNECT") {
            closeComm();
          } else if (msg.payload.action == "SET_FIND_TIMEOUT") {
            if (!isNaN(msg.payload.value) && msg.payload.value > 0) {
              setFindTimeout(msg.payload.value);
            } else {
              node.log("Invalid find timeout ! - " + msg.payload.value);
            }
          } else if (msg.payload.action == "SET_RETRY_TIMEOUT") {
            if (!isNaN(msg.payload.value) && msg.payload.value > 0) {
              setRetryTimeout(msg.payload.value);
            } else {
              node.log("Invalid retry timeout ! - " + msg.payload.value);
            }
          } else if (msg.payload.action == "RECONNECT") {
            startComm();
          }
          break;
      }
    });

    const enableNode = () => {
      console.log("enableNode(): enabling the node", node.id);
      startComm();
    };

    const disableNode = () => {
      console.log("disableNode(): disabling the node", node.id);
      closeComm();
    };

    const setFindTimeout = (newTimeout) => {
      node.log("setFindTimeout(): Setting new find timeout :" + newTimeout);
      node.findTimeout = newTimeout;
    };

    const setRetryTimeout = (newTimeout) => {
      node.log("setRetryTimeout(): Setting new retry timeout :" + newTimeout);
      node.retryTimeout = newTimeout;
    };

    const closeComm = () => {
      node.log("closeComm(): Cleaning up the state");
      node.log("closeComm(): Clearing the find timeout handler");
      clearTimeout(findTimeoutHandler);
      shouldTryReconnect = false;
      node.log("closeComm(): Disconnecting from Tuya Device");
      tuyaDevice.disconnect();
      setStatusDisconnected();
    };

    const startComm = () => {
      closeComm();
      // This 1 sec timeout will make sure that the diconnect happens ..
      // otherwise connect will not hanppen as the state is not changed
      findTimeoutHandler = setTimeout(() => {
        shouldTryReconnect = true;
        node.log(
          `startComm(): Connecting to Tuya with params ${JSON.stringify(
            connectionParams
          )} , findTimeout :  ${node.findTimeout} , retryTimeout:  ${
            node.retryTimeout
          } `
        );
        findDevice();
      }, 1000);
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
      if (node.deviceStatus != CLIENT_STATUS.CONNECTING) {
        node.deviceStatus = CLIENT_STATUS.CONNECTING;
        node.send([null, sendDeviceConnectStatus()]);
      }
      return node.status({ fill: "yellow", shape: "ring", text: "connecting" });
    };
    const setStatusConnected = function () {
      if (node.deviceStatus != CLIENT_STATUS.CONNECTED) {
        node.deviceStatus = CLIENT_STATUS.CONNECTED;
        node.send([null, sendDeviceConnectStatus()]);
      }
      return node.status({ fill: "green", shape: "ring", text: "connected" });
    };
    const setStatusDisconnected = function () {
      if (node.deviceStatus != CLIENT_STATUS.DISCONNECTED) {
        node.deviceStatus = CLIENT_STATUS.DISCONNECTED;
        node.send([null, sendDeviceConnectStatus()]);
      }
      return node.status({ fill: "red", shape: "ring", text: "disconnected" });
    };
    const setStatusOnError = function (
      errorText,
      errorShortText = "error",
      data
    ) {
      node.error(errorText, data);
      if (node.deviceStatus != CLIENT_STATUS.ERROR) {
        node.deviceStatus = CLIENT_STATUS.ERROR;
        node.send([null, sendDeviceConnectStatus()]);
      }
      return node.status({ fill: "red", shape: "ring", text: errorShortText });
    };
    const connectionParams = {
      id: node.deviceId,
      key: node.deviceKey,
      ip: node.deviceIp,
      issueGetOnConnect: false,
      nullPayloadOnJSONError: false,
      version: node.tuyaVersion,
    };

    let tuyaDevice = new TuyaDevice(connectionParams);

    let retryConnection = () => {
      clearTimeout(retryTimerHandler);
      retryTimerHandler = setTimeout(() => {
        node.log("Retrying connection...");
        connectDevice();
      }, node.retryTimeout);
      node.log(`Will try to reconnect after ${node.retryTimeout} milliseconds`);
    };
    node.on("close", function () {
      // tidy up any state
      // clearInterval(int);
      closeComm();
    });

    // Add event listeners
    tuyaDevice.on("connected", () => {
      node.log("Connected to device! " + node.deviceId);
      setStatusConnected();
    });

    tuyaDevice.on("disconnected", () => {
      node.log(
        "Disconnected from tuyaDevice. shouldTryReconnect = " +
          shouldTryReconnect
      );
      setStatusDisconnected();
      if (shouldTryReconnect) {
        retryConnection();
      }
    });

    tuyaDevice.on("error", (error) => {
      node.log(
        "Error from tuyaDevice. shouldTryReconnect = " +
          shouldTryReconnect +
          ", error  = " +
          JSON.stringify(error)
      );
      setStatusOnError(error, "Error : " + JSON.stringify(error), {
        context: {
          message: error,
          deviceVirtualId: node.deviceId,
          deviceIp: node.deviceIp,
          deviceKey: node.deviceKey,
        },
      });
      if (
        typeof error === "string" &&
        error.startsWith("Timeout waiting for status response")
      ) {
        node.log(
          "This error can be due to invalid DPS values. Please check the dps values in the payload !!!!"
        );
      }
      if (shouldTryReconnect) {
        retryConnection();
      }
    });

    if (shouldSubscribeRefreshData) {
      tuyaDevice.on("dp-refresh", (data) => {
        node.log(
          `Data from device  [event:dp-refresh]: ${JSON.stringify(data)}`
        );
        setStatusConnected();
        node.send([
          {
            payload: {
              data: data,
              deviceId: node.deviceId,
              deviceName: node.deviceName,
            },
          },
          null,
        ]);
      });
    }

    if (shouldSubscribeData) {
      tuyaDevice.on("data", (data) => {
        node.log(`Data from device  [event:data]: ${JSON.stringify(data)}`);
        setStatusConnected();
        node.send([
          {
            payload: {
              data: data,
              deviceId: node.deviceId,
              deviceName: node.deviceName,
            },
          },
          null,
        ]);
      });
    }
    let connectDevice = () => {
      clearTimeout(findTimeoutHandler);
      if (tuyaDevice.isConnected() === false) {
        setStatusConnecting();
        const connectHandle = tuyaDevice.connect();
        connectHandle.catch((e) => {
          setStatusDisconnected();
          node.log(
            `connectDevice(): An error had occurred with tuya API on connect method : ${JSON.stringify(
              e
            )}`
          );
          if (shouldTryReconnect) {
            node.log("connectDevice(): retrying the connect");
            clearTimeout(findTimeoutHandler);
            findTimeoutHandler = setTimeout(findDevice, node.retryTimeout);
          } else {
            node.log(
              "connectDevice(): not retrying the find as shouldTryReconnect = false"
            );
          }
        });
      } else {
        node.log(
          "connectDevice() : already connected. skippig the connect call"
        );
        setStatusConnected();
      }
    };
    let findDevice = () => {
      setStatusConnecting();
      node.log("findDevice(): Initiating the find command");
      tuyaDevice
        .find({
          timeout: parseInt(node.findTimeout / 1000),
        })
        .then(() => {
          node.log("findDevice(): Found device, going to connect");
          // Connect to device
          connectDevice();
        })
        .catch((e) => {
          // We need to retry
          setStatusOnError(e.message, "Can't find device", {
            context: {
              message: e,
              deviceVirtualId: node.deviceId,
              deviceIp: node.deviceIp,
              deviceKey: node.deviceKey,
            },
          });
          if (shouldTryReconnect) {
            node.log("findDevice(): Cannot find the device, re-trying...");
            findTimeoutHandler = setTimeout(findDevice, node.retryTimeout);
          } else {
            node.log(
              "findDevice(): not retrying the find as shouldTryReconnect = false"
            );
          }
        });
    };
    // Start probing
    if (!node.disableAutoStart) {
      node.log("Auto start probe on connect...");
      startComm();
    } else {
      node.log("Auto start probe is disabled ");
      // If we dont use timeout , state will not be emitted,
      setTimeout(() => {
        setStatusDisconnected();
      }, 1000);
    }
  }
  RED.nodes.registerType("tuya-smart-device", TuyaSmartDeviceNode);
};

        ? 1000
        : config.findTimeout;
    this.tuyaVersion =
      config.tuyaVersion == null ||
      typeof config.tuyaVersion == "undefined" ||
      (typeof config.tuyaVersion == "string" &&
        config.tuyaVersion.trim() == "") ||
      (typeof config.tuyaVersion == "number" && config.tuyaVersion <= 0) ||
      isNaN(config.tuyaVersion)
        ? "3.1"
        : config.tuyaVersion.trim();

    this.deviceStatus = CLIENT_STATUS.DISCONNECTED;
    // Variable definition ends here

    if (this.eventMode == "event-data") {
      shouldSubscribeData = true;
      shouldSubscribeRefreshData = false;
    } else if (this.eventMode == "event-dp-refresh") {
      shouldSubscribeData = false;
      shouldSubscribeRefreshData = true;
    } else {
      // both case or default case
      shouldSubscribeData = true;
      shouldSubscribeRefreshData = true;
    }
    node.log(
      `Event subscription : shouldSubscribeData=>${shouldSubscribeData} , shouldSubscribeRefreshData=>${shouldSubscribeRefreshData}`
    );
    if (this.retryTimeout <= 0) {
      this.retryTimeout = 1000;
    }

    if (this.findTimeout <= 0) {
      this.findTimeout = 1000;
    }
    let findTimeoutHandler = null;
    let retryTimerHandler = null;

    this.deviceKey = config.deviceKey;
    node.on("input", function (msg) {
      node.log(`Recieved input : ${JSON.stringify(msg)}`);
      let operation = msg.payload.operation || "SET";
      delete msg.payload.operation;
      if (["GET", "SET", "REFRESH"].indexOf(operation) != -1) {
        // the device has to be connected.
        if (!tuyaDevice.isConnected()) {
          // error device not connected
          let errText = `Device not connected. Can't send the ${operation} commmand`;
          node.log(errText);
          setStatusOnError(errText, "Device not connected !", {
            context: {
              message: errText,
              deviceVirtualId: node.deviceId,
              deviceIp: node.deviceIp,
              deviceKey: node.deviceKey,
            },
          });
          return;
        }
      }
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
        case "CONTROL":
          if (msg.payload.action == "CONNECT") {
            startComm();
          } else if (msg.payload.action == "DISCONNECT") {
            closeComm();
          } else if (msg.payload.action == "SET_FIND_TIMEOUT") {
            if (!isNaN(msg.payload.value) && msg.payload.value > 0) {
              setFindTimeout(msg.payload.value);
            } else {
              node.log("Invalid find timeout ! - " + msg.payload.value);
            }
          } else if (msg.payload.action == "SET_RETRY_TIMEOUT") {
            if (!isNaN(msg.payload.value) && msg.payload.value > 0) {
              setRetryTimeout(msg.payload.value);
            } else {
              node.log("Invalid retry timeout ! - " + msg.payload.value);
            }
          } else if (msg.payload.action == "RECONNECT") {
            startComm();
          }
          break;
      }
    });

    const enableNode = () => {
      console.log("enableNode(): enabling the node", node.id);
      startComm();
    };

    const disableNode = () => {
      console.log("disableNode(): disabling the node", node.id);
      closeComm();
    };

    const setFindTimeout = (newTimeout) => {
      node.log("setFindTimeout(): Setting new find timeout :" + newTimeout);
      node.findTimeout = newTimeout;
    };

    const setRetryTimeout = (newTimeout) => {
      node.log("setRetryTimeout(): Setting new retry timeout :" + newTimeout);
      node.retryTimeout = newTimeout;
    };

    const closeComm = () => {
      node.log("closeComm(): Cleaning up the state");
      node.log("closeComm(): Clearing the find timeout handler");
      clearTimeout(findTimeoutHandler);
      shouldTryReconnect = false;
      node.log("closeComm(): Disconnecting from Tuya Device");
      tuyaDevice.disconnect();
      setStatusDisconnected();
    };

    const startComm = () => {
      closeComm();
      // This 1 sec timeout will make sure that the diconnect happens ..
      // otherwise connect will not hanppen as the state is not changed
      findTimeoutHandler = setTimeout(() => {
        shouldTryReconnect = true;
        node.log(
          `startComm(): Connecting to Tuya with params ${JSON.stringify(
            connectionParams
          )} , findTimeout :  ${node.findTimeout} , retryTimeout:  ${
            node.retryTimeout
          } `
        );
        findDevice();
      }, 1000);
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
      if (node.deviceStatus != CLIENT_STATUS.CONNECTING) {
        node.deviceStatus = CLIENT_STATUS.CONNECTING;
        node.send([null, sendDeviceConnectStatus()]);
      }
      return node.status({ fill: "yellow", shape: "ring", text: "connecting" });
    };
    const setStatusConnected = function () {
      if (node.deviceStatus != CLIENT_STATUS.CONNECTED) {
        node.deviceStatus = CLIENT_STATUS.CONNECTED;
        node.send([null, sendDeviceConnectStatus()]);
      }
      return node.status({ fill: "green", shape: "ring", text: "connected" });
    };
    const setStatusDisconnected = function () {
      if (node.deviceStatus != CLIENT_STATUS.DISCONNECTED) {
        node.deviceStatus = CLIENT_STATUS.DISCONNECTED;
        node.send([null, sendDeviceConnectStatus()]);
      }
      return node.status({ fill: "red", shape: "ring", text: "disconnected" });
    };
    const setStatusOnError = function (
      errorText,
      errorShortText = "error",
      data
    ) {
      node.error(errorText, data);
      if (node.deviceStatus != CLIENT_STATUS.ERROR) {
        node.deviceStatus = CLIENT_STATUS.ERROR;
        node.send([null, sendDeviceConnectStatus()]);
      }
      return node.status({ fill: "red", shape: "ring", text: errorShortText });
    };
    const connectionParams = {
      id: node.deviceId,
      key: node.deviceKey,
      ip: node.deviceIp,
      issueGetOnConnect: false,
      nullPayloadOnJSONError: false,
      version: node.tuyaVersion,
    };

    let tuyaDevice = new TuyaDevice(connectionParams);

    let retryConnection = () => {
      clearTimeout(retryTimerHandler);
      retryTimerHandler = setTimeout(() => {
        node.log("Retrying connection...");
        connectDevice();
      }, node.retryTimeout);
      node.log(`Will try to reconnect after ${node.retryTimeout} milliseconds`);
    };
    node.on("close", function () {
      // tidy up any state
      // clearInterval(int);
      closeComm();
    });

    // Add event listeners
    tuyaDevice.on("connected", () => {
      node.log("Connected to device! " + node.deviceId);
      setStatusConnected();
    });

    tuyaDevice.on("disconnected", () => {
      node.log(
        "Disconnected from tuyaDevice. shouldTryReconnect = " +
          shouldTryReconnect
      );
      setStatusDisconnected();
      if (shouldTryReconnect) {
        retryConnection();
      }
    });

    tuyaDevice.on("error", (error) => {
      node.log(
        "Error from tuyaDevice. shouldTryReconnect = " +
          shouldTryReconnect +
          ", error  = " +
          JSON.stringify(error)
      );
      setStatusOnError(error, "Error : " + JSON.stringify(error), {
        context: {
          message: error,
          deviceVirtualId: node.deviceId,
          deviceIp: node.deviceIp,
          deviceKey: node.deviceKey,
        },
      });
      if (
        typeof error === "string" &&
        error.startsWith("Timeout waiting for status response")
      ) {
        node.log(
          "This error can be due to invalid DPS values. Please check the dps values in the payload !!!!"
        );
      }
      if (shouldTryReconnect) {
        retryConnection();
      }
    });

    if (shouldSubscribeRefreshData) {
      tuyaDevice.on("dp-refresh", (data) => {
        node.log(
          `Data from device  [event:dp-refresh]: ${JSON.stringify(data)}`
        );
        setStatusConnected();
        node.send([
          {
            payload: {
              data: data,
              deviceId: node.deviceId,
              deviceName: node.deviceName,
            },
          },
          null,
        ]);
      });
    }

    if (shouldSubscribeData) {
      tuyaDevice.on("data", (data) => {
        node.log(`Data from device  [event:data]: ${JSON.stringify(data)}`);
        setStatusConnected();
        node.send([
          {
            payload: {
              data: data,
              deviceId: node.deviceId,
              deviceName: node.deviceName,
            },
          },
          null,
        ]);
      });
    }
    let connectDevice = () => {
      clearTimeout(findTimeoutHandler);
      if (tuyaDevice.isConnected() === false) {
        setStatusConnecting();
        const connectHandle = tuyaDevice.connect();
        connectHandle.catch((e) => {
          setStatusDisconnected();
          node.log(
            `connectDevice(): An error had occurred with tuya API on connect method : ${JSON.stringify(
              e
            )}`
          );
          if (shouldTryReconnect) {
            node.log("connectDevice(): retrying the connect");
            clearTimeout(findTimeoutHandler);
            findTimeoutHandler = setTimeout(findDevice, node.retryTimeout);
          } else {
            node.log(
              "connectDevice(): not retrying the find as shouldTryReconnect = false"
            );
          }
        });
      } else {
        node.log(
          "connectDevice() : already connected. skippig the connect call"
        );
        setStatusConnected();
      }
    };
    let findDevice = () => {
      setStatusConnecting();
      node.log("findDevice(): Initiating the find command");
      tuyaDevice
        .find({
          timeout: parseInt(node.findTimeout / 1000),
        })
        .then(() => {
          node.log("findDevice(): Found device, going to connect");
          // Connect to device
          connectDevice();
        })
        .catch((e) => {
          // We need to retry
          setStatusOnError(e.message, "Can't find device", {
            context: {
              message: e,
              deviceVirtualId: node.deviceId,
              deviceIp: node.deviceIp,
              deviceKey: node.deviceKey,
            },
          });
          if (shouldTryReconnect) {
            node.log("findDevice(): Cannot find the device, re-trying...");
            findTimeoutHandler = setTimeout(findDevice, node.retryTimeout);
          } else {
            node.log(
              "findDevice(): not retrying the find as shouldTryReconnect = false"
            );
          }
        });
    };
    // Start probing
    if (!node.disableAutoStart) {
      node.log("Auto start probe on connect...");
      startComm();
    } else {
      node.log("Auto start probe is disabled ");
      // If we dont use timeout , state will not be emitted,
      setTimeout(() => {
        setStatusDisconnected();
      }, 1000);
    }
  }
  RED.nodes.registerType("tuya-smart-device", TuyaSmartDeviceNode);
};
