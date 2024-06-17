const TuyaDevice = require('tuyapi');
const packageInfo = require('../package.json');
const utils = require('./utils');
const CLIENT_STATUS = {
  DISCONNECTED: 'DISCONNECTED',
  CONNECTED: 'CONNECTED',
  CONNECTING: 'CONNECTING',
  ERROR: 'ERROR',
};

const EVENT_MODES = {
  BOTH: 'event-both',
  DATA: 'event-data',
  DP_REFRESH: 'event-dp-refresh',
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
    this.storeAsCreds = config.storeAsCreds || false;
    if (this.storeAsCreds) {
      // If the deviceId and key are stored in the creds take it from there
      const secretConfig = this.credentials.secretConfig || '{}';
      const secret = JSON.parse(secretConfig);
      console.log(
        'loading the deviceId and deviceKey from secret credentials ...'
      );
      this.deviceId = secret.deviceId;
      this.deviceKey = secret.deviceKey;
    } else {
      console.log('loading the deviceId and deviceKey from config ...');
      this.deviceId = config.deviceId;
      this.deviceKey = config.deviceKey;
    }

    this.deviceIp = config.deviceIp;
    this.disableAutoStart = config.disableAutoStart;
    this.eventMode = config.eventMode || EVENT_MODES.BOTH;
    this.logLevel = config.logLevel || 'log-level-debug';
    const logLevelNum = utils.UI_LOG_LEVELS[this.logLevel] || 3; // default incase of any error is debug
    node.log(`Setting custom log level as ${this.logLevel}`);
    node.logger = utils.createLogger(this, logLevelNum);
    // To be used for local debugging.
    // need to find a log method control in the node.
    /*node.logger.log(
      `Recieved the config ${JSON.stringify({
        ...config,
        credentials: this.credentials,
        moduleVersion: packageInfo.version,
      })}`
    );*/
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

    this.deviceStatus = null;
    // Variable definition ends here

    if (this.eventMode == EVENT_MODES.DATA) {
      shouldSubscribeData = true;
      shouldSubscribeRefreshData = false;
    } else if (this.eventMode == EVENT_MODES.DP_REFRESH) {
      shouldSubscribeData = false;
      shouldSubscribeRefreshData = true;
    } else {
      // both case or default case
      shouldSubscribeData = true;
      shouldSubscribeRefreshData = true;
    }
    node.logger.debug(
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
      node.logger.debug(`Recieved input : ${JSON.stringify(msg)}`);

      let operation = msg.payload.operation || 'SET';
      delete msg.payload.operation;
      if (['GET', 'SET', 'REFRESH'].indexOf(operation) != -1) {
        // the device has to be connected.
        if (!tuyaDevice.isConnected()) {
          // error device not connected
          let errText = `Device not connected. Can't send the ${operation} commmand`;
          node.logger.log(errText);
          setStatusOnError(errText, 'Device not connected !', {
            context: {
              message: errText,
              deviceVirtualId: node.deviceId,
              deviceIp: node.deviceIp,
              deviceName: node.deviceName,
              deviceKey: node.deviceKey,
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
            if (!tuyaDevice.isConnected()) {
              // Connect only when disconnected
              startComm();
            }
          } else if (msg.payload.action == 'DISCONNECT') {
            //Disconnect only when connected.
            // Make disconnect force
            closeComm();
          } else if (msg.payload.action == 'SET_FIND_TIMEOUT') {
            if (!isNaN(msg.payload.value) && msg.payload.value > 0) {
              setFindTimeout(msg.payload.value);
            } else {
              node.logger.error(
                'Invalid find timeout ! - ' + msg.payload.value
              );
            }
          } else if (msg.payload.action == 'SET_RETRY_TIMEOUT') {
            if (!isNaN(msg.payload.value) && msg.payload.value > 0) {
              setRetryTimeout(msg.payload.value);
            } else {
              node.logger.error(
                'Invalid retry timeout ! - ' + msg.payload.value
              );
            }
          } else if (msg.payload.action == 'RECONNECT') {
            if (tuyaDevice.isConnected) {
              closeComm();
            }
            startComm();
          } else if (msg.payload.action == 'SET_EVENT_MODE') {
            shouldSubscribeData = true;
            shouldSubscribeRefreshData = true;
            // if any incorrect value set the event mode as BOTH
            node.eventMode = EVENT_MODES.BOTH;
            if (msg.payload.value === EVENT_MODES.DATA) {
              shouldSubscribeRefreshData = false;
              node.eventMode = EVENT_MODES.DATA;
            } else if (msg.payload.value === EVENT_MODES.DP_REFRESH) {
              shouldSubscribeData = false;
              node.eventMode = EVENT_MODES.DP_REFRESH;
            }
            node.logger.debug(
              `SET_EVENT_MODE : shouldSubscribeData=>${shouldSubscribeData} , shouldSubscribeRefreshData=>${shouldSubscribeRefreshData}`
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
      node.logger.debug(
        'setFindTimeout(): Setting new find timeout :' + newTimeout
      );
      node.findTimeout = newTimeout;
    };

    const setRetryTimeout = (newTimeout) => {
      node.logger.debug(
        'setRetryTimeout(): Setting new retry timeout :' + newTimeout
      );
      node.retryTimeout = newTimeout;
    };

    const closeComm = () => {
      node.logger.log('closeComm(): Cleaning up the state');
      node.logger.debug('closeComm(): Clearing the find timeout handler');
      clearTimeout(findTimeoutHandler);
      shouldTryReconnect = false;
      node.logger.debug('closeComm(): Disconnecting from Tuya Device');
      tuyaDevice.disconnect();
      setStatusDisconnected();
    };

    const startComm = () => {
      // This 1 sec timeout will make sure that the diconnect happens ..
      // otherwise connect will not hanppen as the state is not changed
      findTimeoutHandler = setTimeout(() => {
        shouldTryReconnect = true;
        node.logger.log(`startComm(): Connecting to Tuya`);
        node.logger.debug(
          `startComm(): Connecting to Tuya with params ${JSON.stringify(
            utils.maskSensitiveData(connectionParams)
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
      node.logger.error(errorText, data);
      if (node.deviceStatus != CLIENT_STATUS.ERROR) {
        node.deviceStatus = CLIENT_STATUS.ERROR;
        node.send([null, sendDeviceConnectStatus()]);
      }
      return node.status({ fill: 'red', shape: 'ring', text: errorShortText });
    };
    const connectionParams = {
      id: node.deviceId,
      key: node.deviceKey,
      ip: node.deviceIp,
      issueGetOnConnect: false,
      nullPayloadOnJSONError: false,
      version: node.tuyaVersion,
      issueRefreshOnConnect: false,
    };

    let tuyaDevice = new TuyaDevice(connectionParams);

    let retryConnection = () => {
      clearTimeout(retryTimerHandler);
      retryTimerHandler = setTimeout(() => {
        node.logger.log('Retrying connection...');
        connectDevice();
      }, node.retryTimeout);
      node.logger.debug(
        `Will try to reconnect after ${node.retryTimeout} milliseconds`
      );
    };
    node.on('close', function () {
      // tidy up any state
      // clearInterval(int);
      closeComm();
    });

    // Add event listeners
    tuyaDevice.on('connected', () => {
      node.logger.log(
        'Connected to device! name : ' +
          node.deviceName +
          ', ip : ' +
          node.deviceIp
      );
      setStatusConnected();
    });

    tuyaDevice.on('disconnected', () => {
      node.logger.log(
        'Disconnected from tuyaDevice. shouldTryReconnect = ' +
          shouldTryReconnect
      );
      setStatusDisconnected();
      if (shouldTryReconnect) {
        retryConnection();
      }
    });

    tuyaDevice.on('error', (error) => {
      node.logger.error(
        'Error from tuyaDevice. shouldTryReconnect = ' +
          shouldTryReconnect +
          ', error  = ' +
          JSON.stringify(error)
      );
      // Anonymize
      setStatusOnError(error, 'Error : ' + JSON.stringify(error), {
        context: {
          message: error,
          deviceVirtualId: node.deviceId,
          deviceIp: node.deviceIp,
          deviceKey: node.deviceKey,
        },
      });
      if (
        typeof error === 'string' &&
        error.startsWith('Timeout waiting for status response')
      ) {
        node.logger.error(
          'This error can be due to invalid DPS values. Please check the dps values in the payload !!!!'
        );
      }
      if (shouldTryReconnect) {
        retryConnection();
      }
    });

    tuyaDevice.on('dp-refresh', (data) => {
      if (shouldSubscribeRefreshData) {
        node.logger.debug(
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

    tuyaDevice.on('data', (data) => {
      if (shouldSubscribeData) {
        node.logger.debug(
          `Data from device  [event:data]: ${JSON.stringify(data)}`
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

    let connectDevice = () => {
      clearTimeout(findTimeoutHandler);
      if (tuyaDevice.isConnected() === false) {
        setStatusConnecting();
        const connectHandle = tuyaDevice.connect();
        connectHandle.catch((e) => {
          setStatusDisconnected();
          node.logger.error(
            `connectDevice(): An error had occurred with tuya API on connect method : ${JSON.stringify(
              e
            )}`
          );
          if (shouldTryReconnect) {
            node.logger.log('connectDevice(): retrying the connect');
            if (findTimeoutHandler) {
              clearTimeout(findTimeoutHandler);
            }
            findTimeoutHandler = setTimeout(findDevice, node.retryTimeout);
          } else {
            node.logger.debug(
              'connectDevice(): not retrying the find as shouldTryReconnect = false'
            );
          }
        });
      } else {
        node.logger.debug(
          'connectDevice() : already connected. skippig the connect call'
        );
        setStatusConnected();
      }
    };
    let findDevice = () => {
      setStatusConnecting();
      node.logger.log('findDevice(): Initiating the find command');
      tuyaDevice
        .find({
          timeout: parseInt(node.findTimeout / 1000),
        })
        .then(() => {
          node.logger.log('findDevice(): Found device, going to connect');
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
              deviceName: node.deviceName,
            },
          });
          setStatusDisconnected();
          if (shouldTryReconnect) {
            node.logger.error(
              'findDevice(): Cannot find the device, re-trying...'
            );
            findTimeoutHandler = setTimeout(findDevice, node.retryTimeout);
          } else {
            node.logger.debug(
              'findDevice(): not retrying the find as shouldTryReconnect = false'
            );
          }
        });
    };

    // Initial state
    setTimeout(() => {
      setStatusDisconnected();
    }, 500);

    // Start probing
    if (!node.disableAutoStart) {
      node.logger.log('Auto start probe on connect...');
      startComm();
    } else {
      node.logger.log('Auto start probe is disabled ');
    }
  }
  RED.nodes.registerType('tuya-smart-device', TuyaSmartDeviceNode, {
    credentials: {
      secretConfig: { type: 'text' },
    },
  });
};
