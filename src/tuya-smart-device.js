// 26/08/22
const VER = '5.0.1 + fixes01';  
const TuyaDevice = require('tuyapi');
const packageInfo = require('../package.json');
const CLIENT_STATUS = {
  DISCONNECTED: 'DISCONNECTED',
  CONNECTED: 'CONNECTED',
  CONNECTING: 'CONNECTING',
  ERROR: 'ERROR',
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
// 26/08/22: anonymize the log
//    console.log('CREDS', this.credentials, config.deviceId);  
    this.name = config.deviceName;
    this.deviceName = config.deviceName;
    this.storeAsCreds = config.storeAsCreds || false;
    if (this.storeAsCreds) {
      // If the deviceId and key are stored in the creds take it from there
      const secretConfig = this.credentials.secretConfig || '{}';
      const secret = JSON.parse(secretConfig);
// 26/08/22: anonymize the log
//      console.log('Using secrets :: ', secret);  
      this.deviceId = secret.deviceId;
      this.deviceKey = secret.deviceKey;
    } else {
      this.deviceId = config.deviceId;
      this.deviceKey = config.deviceKey;
    }
// 26/08/22: anonymize the log
//    console.log('NEW DEVICE ID', this.deviceId); 
    this.deviceIp = config.deviceIp;
    this.disableAutoStart = config.disableAutoStart;
    this.eventMode = config.eventMode || 'event-both';
// 26/08/22: filter to exclude node-red stuff, like info: can be hurge
    let publicConfig = Object.keys(config).filter(key => !['deviceId', 'deviceKey', 'x', 'y', 'wires', 'info'].includes(key)).reduce((obj, key) => {
            obj[key] = config[key];
            return obj;
        }, {});
        publicConfig.codeVersion = VER;
        publicConfig.moduleVersion = packageInfo.version;
        node.log(`Recieved the config ${JSON.stringify(publicConfig)}`);
 //   node.log(
 //     `Recieved the config ${JSON.stringify({
 //       ...config,
 //       credentials: this.credentials,
 //       moduleVersion: packageInfo.version,
 //     })}`
 //   );
    this.retryTimeout =
      config.retryTimeout == null ||
      typeof config.retryTimeout == 'undefined' ||
      (typeof config.retryTimeout == 'string' &&
        config.retryTimeout.trim() == '') ||
      (typeof config.retryTimeout == 'number' && config.retryTimeout <= 0) ||
      isNaN(config.retryTimeout)
        ? 1000
        : config.retryTimeout;
    this.findTimeout =
      config.findTimeout == null ||
      typeof config.findTimeout == 'undefined' ||
      (typeof config.findTimeout == 'string' &&
        config.findTimeout.trim() == '') ||
      (typeof config.findTimeout == 'number' && config.findTimeout <= 0) ||
      isNaN(config.findTimeout)
        ? 1000
        : config.findTimeout;
    this.tuyaVersion =
      config.tuyaVersion == null ||
      typeof config.tuyaVersion == 'undefined' ||
      (typeof config.tuyaVersion == 'string' &&
        config.tuyaVersion.trim() == '') ||
      (typeof config.tuyaVersion == 'number' && config.tuyaVersion <= 0) ||
      isNaN(config.tuyaVersion)
        ? '3.1'
        : config.tuyaVersion.trim();
// 07/06/21: to force always a 'DISCONNECTED' message at startup
//    this.deviceStatus = CLIENT_STATUS.DISCONNECTED;
      this.deviceStatus = null;
    // Variable definition ends here

    if (this.eventMode == 'event-data') {
      shouldSubscribeData = true;
      shouldSubscribeRefreshData = false;
    } else if (this.eventMode == 'event-dp-refresh') {
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

    node.on('input', function (msg) {
      node.log(`Recieved input : ${JSON.stringify(msg)}`);
      let operation = msg.payload.operation || 'SET';
      delete msg.payload.operation;
      if (['GET', 'SET', 'REFRESH'].indexOf(operation) != -1) {
        // the device has to be connected.
        if (!tuyaDevice.isConnected()) {
          // error device not connected
          let errText = `Device not connected. Can't send the ${operation} commmand`;
          node.log(errText);
          setStatusOnError(errText, 'Device not connected !', {
            context: {
              message: errText,
// 08/06/21: anonymize the log      
              device: node.deviceName,
//              deviceVirtualId: node.deviceId,
              deviceIp: node.deviceIp,
//             deviceKey: node.deviceKey,
            },
          });
          return;
        }
      }
      switch (operation) {
        case 'SET':
          tuyaDevice.set(msg.payload);
          break;
        case 'REFRESH':
          tuyaDevice.refresh(msg.payload);
          break;
        case 'GET':
          tuyaDevice.get(msg.payload);
          break;
        case 'CONTROL':
          if (msg.payload.action == 'CONNECT') {
// 08/06/21: CONNECT only if disconnected 
            if (!tuyaDevice.isConnected())
            startComm();
          } else if (msg.payload.action == 'DISCONNECT') {
// 08/06/21: DISCONNECT only if connected 
            if (tuyaDevice.isConnected()) 
            closeComm();
          } else if (msg.payload.action == 'SET_FIND_TIMEOUT') {
            if (!isNaN(msg.payload.value) && msg.payload.value > 0) {
              setFindTimeout(msg.payload.value);
            } else {
              node.log('Invalid find timeout ! - ' + msg.payload.value);
            }
          } else if (msg.payload.action == 'SET_RETRY_TIMEOUT') {
            if (!isNaN(msg.payload.value) && msg.payload.value > 0) {
              setRetryTimeout(msg.payload.value);
            } else {
              node.log('Invalid retry timeout ! - ' + msg.payload.value);
            }
          } else if (msg.payload.action == 'RECONNECT') {
// ms 08/06/21: difference CONNECT vs RECONNECT: RECONNECT forces always
          if (tuyaDevice.isConnected)
                        closeComm();
              startComm();
          }
// ms 26/08/22: added new COMMAND SET_DATA_EVENT = "both"|"event-data"|"event-dp-refresh"
          else if (msg.payload.action == 'SET_DATA_EVENT') {
                    shouldSubscribeData = true;
                    shouldSubscribeRefreshData = true;
                    if (msg.payload.value === 'event-data')
                        shouldSubscribeRefreshData = false;
                    if (msg.payload.value === 'event-dp-refresh')
                        shouldSubscribeData = false;
                    node.log(
`Event subscription: shouldSubscribeData=>${shouldSubscribeData} , shouldSubscribeRefreshData=>${shouldSubscribeRefreshData}`
                    );
          }
          
          break;
      }
    });

    const enableNode = () => {
      console.log('enableNode(): enabling the node', node.id);
      startComm();
    };

    const disableNode = () => {
      console.log('disableNode(): disabling the node', node.id);
      closeComm();
    };

    const setFindTimeout = (newTimeout) => {
      node.log('setFindTimeout(): Setting new find timeout :' + newTimeout);
      node.findTimeout = newTimeout;
    };

    const setRetryTimeout = (newTimeout) => {
      node.log('setRetryTimeout(): Setting new retry timeout :' + newTimeout);
      node.retryTimeout = newTimeout;
    };

    const closeComm = () => {
      node.log('closeComm(): Cleaning up the state');
      node.log('closeComm(): Clearing the find timeout handler');
      clearTimeout(findTimeoutHandler);
      shouldTryReconnect = false;
      node.log('closeComm(): Disconnecting from Tuya Device');
      tuyaDevice.disconnect();
      setStatusDisconnected();
    };

    const startComm = () => {
// 08/06/21: disconnect  not required here.      
      // closeComm();
      // This 1 sec timeout will make sure that the diconnect happens ..
      // otherwise connect will not hanppen as the state is not changed
      findTimeoutHandler = setTimeout(() => {
        shouldTryReconnect = true;
// 08/06/21: anonymize the log: filter
          let publicParams = Object.keys(connectionParams).filter(key => !['id', 'key', 'ip'].includes(key)).reduce((obj, key) => {
             obj[key] = connectionParams[key];
             return obj;
             }, {});

        node.log(
          `startComm(): Connecting to Tuya with params ${JSON.stringify(
            publicParams
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
      return node.status({ fill: 'yellow', shape: 'ring', text: 'connecting' });
    };
    const setStatusConnected = function () {
      if (node.deviceStatus != CLIENT_STATUS.CONNECTED) {
        node.deviceStatus = CLIENT_STATUS.CONNECTED;
        node.send([null, sendDeviceConnectStatus()]);
      }
      return node.status({ fill: 'green', shape: 'ring', text: 'connected' });
    };
    const setStatusDisconnected = function () {
      if (node.deviceStatus != CLIENT_STATUS.DISCONNECTED) {
        node.deviceStatus = CLIENT_STATUS.DISCONNECTED;
        node.send([null, sendDeviceConnectStatus()]);
      }
      return node.status({ fill: 'red', shape: 'ring', text: 'disconnected' });
    };
    const setStatusOnError = function (
      errorText,
      errorShortText = 'error',
      data
    ) {
 // ms 08/06/21:  not required the console ERROR output    
    //  node.error(errorText, data);
        node.send([null, {
                        payload: {
                            state: CLIENT_STATUS.ERROR,
                            ...data
                        }
                    }
                ]);
 // ms 08/06/21: ERROR is a MESSAGE, it doesn't have to change the internal deviceStatus CONNECTED/DISCONNECTED...     
   //   if (node.deviceStatus != CLIENT_STATUS.ERROR) {
   //     node.deviceStatus = CLIENT_STATUS.ERROR;
   //     node.send([null, sendDeviceConnectStatus()]);
   //   }
      return node.status({ fill: 'red', shape: 'ring', text: errorShortText });
    };
    const connectionParams = {
      id: node.deviceId,
      key: node.deviceKey,
      ip: node.deviceIp,
      issueGetOnConnect: false,
 // ms 07/06/21:  set REFRESH under user control
      issueRefreshOnConnect: false,
      
      nullPayloadOnJSONError: false,
      version: node.tuyaVersion,
    };

    let tuyaDevice = new TuyaDevice(connectionParams);

    let retryConnection = () => {
      clearTimeout(retryTimerHandler);
      retryTimerHandler = setTimeout(() => {
        node.log('Retrying connection...');
        connectDevice();
      }, node.retryTimeout);
      node.log(`Will try to reconnect after ${node.retryTimeout} milliseconds`);
    };
    node.on('close', function () {
      // tidy up any state
      // clearInterval(int);
      closeComm();
    });

    // Add event listeners
    tuyaDevice.on('connected', () => {
 // 08/06/21: anonymize the log
      node.log("Connected to device! " + node.deviceName + " " + node.deviceIp);
  //    node.log('Connected to device! ' + node.deviceId);
      setStatusConnected();
    });

    tuyaDevice.on('disconnected', () => {
      node.log(
        'Disconnected from tuyaDevice. shouldTryReconnect = ' +
          shouldTryReconnect
      );
      setStatusDisconnected();
      if (shouldTryReconnect) {
        retryConnection();
      }
    });

    tuyaDevice.on('error', (error) => {
      node.log(
        'Error from tuyaDevice. shouldTryReconnect = ' +
          shouldTryReconnect +
          ', error  = ' +
          JSON.stringify(error)
      );
      setStatusOnError(error, 'Error : ' + JSON.stringify(error), {
        context: {
          message: error,
 // ms 08/06/21: anonymize the log
          device: node.deviceName,
//          deviceVirtualId: node.deviceId,
          deviceIp: node.deviceIp,
//          deviceKey: node.deviceKey,
        },
      });
      if (
        typeof error === 'string' &&
        error.startsWith('Timeout waiting for status response')
      ) {
        node.log(
          'This error can be due to invalid DPS values. Please check the dps values in the payload !!!!'
        );
      }
      if (shouldTryReconnect) {
        retryConnection();
      }
    });

// ms 26/08/22: deplaced 
   //   if (shouldSubscribeRefreshData) {
      tuyaDevice.on('dp-refresh', (data) => {
   if (shouldSubscribeRefreshData) {
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
      }
    });
//    }
// ms 26/08/22: deplaced
 //   if (shouldSubscribeData) {
      tuyaDevice.on('data', (data) => {
         if (shouldSubscribeData) {
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
      }
    });
 //   }
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
// ms 08/06/21 reduce log
        //     node.log('connectDevice(): retrying the connect');
        //     clearTimeout(findTimeoutHandler);
            findTimeoutHandler = setTimeout(findDevice, node.retryTimeout);
          } else {
            node.log(
              'connectDevice(): not retrying the find as shouldTryReconnect = false'
            );
          }
        });
      } else {
        node.log(
          'connectDevice() : already connected. skippig the connect call'
        );
        setStatusConnected();
      }
    };
    let findDevice = () => {
      setStatusConnecting();
      node.log('findDevice(): Initiating the find command');
      tuyaDevice
        .find({
          timeout: parseInt(node.findTimeout / 1000),
        })
        .then(() => {
// 08/06/21 reduce log
 //         node.log('findDevice(): Found device, going to connect');
          // Connect to device
          connectDevice();
        })
        .catch((e) => {
          // We need to retry
          setStatusOnError(e.message, "Can't find device", {
            context: {
              message: e,
 // 08/06/21: anonymize the log
              device: node.deviceName,              
    //          deviceVirtualId: node.deviceId,
              deviceIp: node.deviceIp,
    //          deviceKey: node.deviceKey,
            },
          });
// ms 08/06/21    
           setStatusDisconnected();
          if (shouldTryReconnect) {
            node.log('findDevice(): Cannot find the device, re-trying...');
            findTimeoutHandler = setTimeout(findDevice, node.retryTimeout);
          } else {
            node.log(
              'findDevice(): not retrying the find as shouldTryReconnect = false'
            );
          }
        });
    };
    // Start probing
//08/06/21: deplaced here, always status DISCONNECTED at start
     // If we dont use timeout , state will not be emitted,
      setTimeout(() => {
        setStatusDisconnected();
      }, 1000);
    
    if (!node.disableAutoStart) {
      node.log('Auto start probe on connect...');
      startComm();
    } else {
      node.log('Auto start probe is disabled ');
 //     // If we dont use timeout , state will not be emitted,
 //     setTimeout(() => {
 //      setStatusDisconnected();
 //     }, 1000);
    }
  }
  RED.nodes.registerType('tuya-smart-device', TuyaSmartDeviceNode, {
    credentials: {
      secretConfig: { type: 'text' },
    },
  });
};
