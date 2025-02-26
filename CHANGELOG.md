# Changelog

## 5.3.1

- Added support for Tuyapi 7.7.0 (supports protocol version 3.5)

## 5.3.0

- Added log level control to each node

## 5.2.0

- Added new control action "SET_EVENT_MODE"
- Improve the code base
- Improved example

## 5.1.0

- Update tuya CLI to v7.5.1 (https://github.com/vinodsr/node-red-contrib-tuya-smart-device/pull/110)

## 5.0.1

- Fix error validating the creds in the view mode. This is an known issue [node-red#3420](https://github.com/node-red/node-red/issues/3420)

## 5.0.0

- Updated TuyaAPI to `7.3.0`
- Added support to store device Id and device Key as credentials [#77](https://github.com/vinodsr/node-red-contrib-tuya-smart-device/issues/77)
- Changed the default find timeout value to 10 seconds
- Renamed `tuya smart device generic` node to `tuya smart device hub`
  > Thanks to [foxylion](https://github.com/foxylion) for suggesting the crendentials feature

## 4.1.1

- Fix retry timeout not set via command
- Fix state change issues with the state output of the node.
- Handled the TuyAPI unhandled exception( Thanks to @msillano)
- Check for connection before sending message
- Added troubleshooting section in README

## 4.1.0

- Added CONTROL commands as input (CONNECT, DISCONNECT, RECONNECT)
- Seperate output node for device status and client status
- Dynamically set the find and retry timeout (Not saved permanently in the config)
- Disable auto connect on start

## 4.0.2

- Added support for both data and dp-refresh event [#54](https://github.com/vinodsr/node-red-contrib-tuya-smart-device/issues/54)

## 4.0.1

- Renamed data event to dp-refresh (Tuya 7.1 changes)

## 4.0.0

- Update to Tuya 7.1.0. Closes [#51](https://github.com/vinodsr/node-red-contrib-tuya-smart-device/issues/51)

## 3.1.0

- Added support for catch node. If there a catch node in the flow, the tuya smart device node will not throw any error to the debug window. Implementing [#47](https://github.com/vinodsr/node-red-contrib-tuya-smart-device/issues/47)

## 3.0.2

- Fixes [#43](https://github.com/vinodsr/node-red-contrib-tuya-smart-device/issues/43)

## 3.0.1

- Fixes protocol default value not set for existing nodes

## 3.0.0

Fixes [#35](https://github.com/vinodsr/node-red-contrib-tuya-smart-device/issues/35)
Fixes [#39](https://github.com/vinodsr/node-red-contrib-tuya-smart-device/issues/39)

- Optimized code

## 2.0.0

Fixes [#33](https://github.com/vinodsr/node-red-contrib-tuya-smart-device/issues/33)

- Tuya api library updated to 6.1.1
- No more null data payload on json undefined error. :)

## 1.2.1

Fixes [#25](https://github.com/vinodsr/node-red-contrib-tuya-smart-device/issues/25)

## 1.2.0

- Added a generic SET node which can be controller with message.payload. One node to set command for many devices. Thanks to formatBCE for the suggestion.

## 1.1.4

- Bug fixes

## 1.1.3

- Added more extensive retry logic. Previously on find error, the logic hangs

## 1.1.0

- Initial Version
