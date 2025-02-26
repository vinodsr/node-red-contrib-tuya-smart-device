# node-red-contrib-tuya-smart-device

![npm](https://img.shields.io/npm/v/node-red-contrib-tuya-smart-device)
![NPM](https://img.shields.io/npm/dm/node-red-contrib-tuya-smart-device)
![Build and Publish package](https://github.com/vinodsr/node-red-contrib-tuya-smart-device/workflows/Build%20and%20Publish%20package/badge.svg)
![License](https://img.shields.io/github/license/vinodsr/node-red-contrib-tuya-smart-device)

A node-red module which helps you to connect to any tuya device using [tuyapi](https://github.com/codetheweb/tuyapi) library

![image](./img/sample.png)

# Table of contents

- [Requirements](#requirements)
- [Features](#features)
- [Getting Started](#getting-started)
- [Setup](#setup)
  - [Input Format](#input-format)
  - [Output Format](#output-format)
- [License](#license)
- [Contributing](#contributing)

# Requirements

- nodeJS >= 16.0.0
- node-red >= 2.5.0

# Features

- Controls tuya device
- Controls multiple device using a single node using generic node (hub node)
- Can use device IP for communication
- Configure retry and find intervals
- Ability to setup Tuya Protocol Version
- Ability to listen to both `Data` and `DP-Refresh` event
- Can store deviceId and deviceKey as crendentials
- Better error handling
- Better log handling

# Getting Started

Instructions for getting the device id is available [here](https://github.com/codetheweb/tuyapi/blob/master/docs/SETUP.md)

> Another technique for getting all deviceid linked to your tuya account
>
> [https://github-wiki-see.page/m/iRayanKhan/homebridge-tuya/wiki/Get-Local-Keys-for-your-devices](https://github.com/iRayanKhan/homebridge-tuya/wiki/Get-Local-Keys-for-your-devices)

You will get the device id and the key once you run the wizard program as per the instructiions

Get more details about latest version changes in the [CHANGELOG.md](./changelog.md)

# Setup

[(Back to top)](#table-of-contents)

The node takes one input and one output. Once you drop the node into the flow, you need to use the deviceid and devicekey that you got from the getting started step.

Once you setup the node, you can then use input to send any command to the device as per the tuya standards.

# Input Format

[(Back to top)](#table-of-contents)

![image](./img/input.png)

# Output Format

[(Back to top)](#table-of-contents)

![image](./img/output.png)

> If you need the error thrown by the node use the catch node.

> The status output sends the state of the client (CONNECTING,CONNECTED,ERROR or DISCONNECTED). It will only send message if the state has been changed. . eg: even though multiple errors have been thrown, only once the ERROR state will be send. One possible scenario is
> `ERROR -> CONNECTING -> CONNECTED`. again if ERROR occurs , then the state is send out of the node.

# Examples

You can refer the [example flow](./examples/latest.json) to get started

# Troubleshooting

- **I am getting "Can't find device error"**

  The can't find device error can be due to many reasons

  1.  Make sure the device is powered on
  1.  Make sure the Device ID / IP / Key are correct
  1.  Make sure that you haven't created multiple nodes for the same device. Multiple connections to the same device is not possible. This is a limitation of TuyAPI.

- **What is the difference between FindTimeout and RetryTimeout?**

  `FindTimeout` is the time in milliseconds that tuya api will check for a device. Once the timeout has breached, the can't find device error is shown.

  `RetryTimeout` is the time in milliseconds to wait for the node to retry the connection once the device connection is disconnected due to some unexpected errors.

- **What is the purpose of the status output ?**

  The status output can be used to get the state of the current node(client). Whether disconnected or in error. You can make logic in node-red using this status. If you need to catch the whole error use the catch node.

# License

[(Back to top)](#table-of-contents)

MIT License - Copyright (c) 2020 Vinod S R

# Contributing

[(Back to top)](#table-of-contents)

Your contributions are always welcome! Please have a look at the [contribution guidelines](CONTRIBUTING.md) first. :tada:
