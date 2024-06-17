const TuyaDevice = require('tuyapi');
const packageInfo = require('../package.json');
const utils = require('./utils');

module.exports = function (RED) {
  function TuyaSmartDeviceSelfNode(config) {
    RED.nodes.createNode(this, config);
    let node = this;
    let shouldSubscribeData = true;
    let shouldSubscribeRefreshData = true;
    this.name = config.name;
    this.eventMode = config.eventMode || 'event-both';
    this.logLevel = config.logLevel || 'log-level-debug';
    const logLevelNum = utils.UI_LOG_LEVELS[this.logLevel] || 3; // default incase of any error is debug
    node.log(`Setting custom log level as ${this.logLevel}`);
    this.logger = utils.createLogger(this, logLevelNum);
    this.operations = [];
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
    node.on('input', function (msg) {
      let operation = msg.payload.operation || 'SET';
      delete msg.payload.operation;
      let requestID = new Date().getTime();
      node.logger.log(
        `[${requestID}] recieved data on input : ${JSON.stringify({
          ...msg,
          moduleVersion: packageInfo.version,
        })}`
      );
      // Initiate the device connection and then send the payload
      node.operations.push(1);
      const tuyaProtocolVersion =
        msg.payload.version == null ||
        typeof msg.payload.version == 'undefined' ||
        msg.payload.version.trim() == '' ||
        isNaN(msg.payload.version)
          ? '3.1'
          : msg.payload.version.trim();
      const connectionParams = {
        id: msg.payload.deviceVirtualId,
        key: msg.payload.deviceKey,
        ip: msg.payload.deviceIp,
        issueGetOnConnect: false,
        nullPayloadOnJSONError: false,
        version: tuyaProtocolVersion,
      };
      node.logger.debug(
        `Connecting to tuya with params : ${JSON.stringify(connectionParams)}`
      );
      let tuyaDevice = new TuyaDevice(connectionParams);

      tuyaDevice.on('disconnected', () => {
        node.logger.log(`[${requestID}]  Disconnected from tuyaDevice.`);
        node.operations.pop();
        if (node.operations.length === 0) {
          // Show the disconnected status if there is no more active connections.
          setStatusDisconnected();
        }
      });

      tuyaDevice.on('error', (error) => {
        node.operations.pop();
        setStatusOnError(error, requestID, 'Error', {
          context: {
            message: error,
            deviceVirtualId: msg.payload.deviceVirtualId,
            deviceKey: msg.payload.deviceKey,
            deviceIp: msg.payload.deviceIp,
            requestID: requestID,
          },
        });
      });
      tuyaDevice.on('connected', () => {
        node.logger.log(
          `[${requestID}]  Connected to device! ${msg.payload.deviceVirtualId}`
        );
        setStatusConnected();
        switch (operation) {
          case 'SET':
            node.logger.debug(
              `[${requestID}]  sending command SET : ${JSON.stringify(
                msg.payload.payload
              )}`
            );
            tuyaDevice.set(msg.payload.payload);
            break;
          default:
            node.logger.error(`[${requestID}] Invalid operation ${operation}`);
        }
      });

      if (shouldSubscribeRefreshData) {
        tuyaDevice.on('dp-refresh', (data) => {
          node.logger.debug(
            `[${requestID}] Data from device [event:dp-refresh]: ${JSON.stringify(
              data
            )}`
          );
          tuyaDevice.disconnect();
          node.send({
            payload: {
              data: data,
              deviceVirtualId: msg.payload.deviceVirtualId,
              deviceKey: msg.payload.deviceKey,
              deviceName: msg.payload.deviceName,
              deviceIp: msg.payload.deviceIp,
              requestID: requestID,
            },
          });
        });
      }

      if (shouldSubscribeData) {
        tuyaDevice.on('data', (data) => {
          node.logger.debug(
            `[${requestID}] Data from device [event:data]: ${JSON.stringify(
              data
            )}`
          );
          tuyaDevice.disconnect();
          node.send({
            payload: {
              data: data,
              deviceVirtualId: msg.payload.deviceVirtualId,
              deviceKey: msg.payload.deviceKey,
              deviceName: msg.payload.deviceName,
              deviceIp: msg.payload.deviceIp,
              requestID: requestID,
            },
          });
        });
      }
      let findDevice = () => {
        setStatusConnecting();
        node.logger.debug(`[${requestID}] initiating the find command`);
        tuyaDevice
          .find({})
          .then(() => {
            // Connect to device
            tuyaDevice.connect();
          })
          .catch((e) => {
            // We need to retry
            setStatusOnError(e.message, requestID, "Can't find device", {
              context: {
                message: e,
                deviceVirtualId: msg.payload.deviceVirtualId,
                deviceKey: msg.payload.deviceKey,
                deviceIp: msg.payload.deviceIp,
              },
            });
            node.logger.error(`[${requestID}] Cannot find the device`);
            //setTimeout(findDevice, 1000);
          });
      };
      findDevice();
    });
    let setStatusConnecting = function () {
      return node.status({ fill: 'yellow', shape: 'ring', text: 'connecting' });
    };
    let setStatusConnected = function () {
      return node.status({ fill: 'green', shape: 'ring', text: 'connected' });
    };
    let setStatusDisconnected = function () {
      return node.status({ fill: 'red', shape: 'ring', text: 'disconnected' });
    };
    var setStatusOnError = function (
      errorText,
      requestID,
      errorShortText = 'error',
      data
    ) {
      node.error(`[${requestID}] An error had occured : ${errorText}`, data);
      return node.status({ fill: 'red', shape: 'ring', text: errorShortText });
    };

    node.on('close', function () {
      // tidy up any state
      // clearInterval(int);
      //shouldTryReconnect = false;
      //tuyaDevice.disconnect();
    });
  }
  RED.nodes.registerType('tuya-smart-device-generic', TuyaSmartDeviceSelfNode);
};
