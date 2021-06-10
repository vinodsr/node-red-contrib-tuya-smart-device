# node-red-contrib-tuya-smart-device fork for tests

![NPM](https://img.shields.io/npm/dm/node-red-contrib-tuya-smart-device)
![Build and Publish package](https://github.com/vinodsr/node-red-contrib-tuya-smart-device/workflows/Build%20and%20Publish%20package/badge.svg)
![License](https://img.shields.io/github/license/vinodsr/node-red-contrib-tuya-smart-device)

A node-red module which helps you to connect to any tuya device.

Fork from https://github.com/vinodsr/node-red-contrib-tuya-smart-device to test more devices and to standardiuze the behavior.

**Versions**
- node-red-contrib-tuya-smart-device ver. 4.1.1
- tuyAPI ver. 7.2.0

### General criteria 

<ol> <li> User reference configuration: 20+ `node-red-contrib-tuya-smart-device` in the same flow, some devices unconnected, some devices PUSHing data, some devices POLLed (REFRESH/GET) every 5 sec: CPU load and bandwidth must be minimized!
<li> Consequential guidelines, from the "node-red-contrib-tuya-smart-device user" point of view:
<ol type='a'> <li> Functional implementation: as described by the following 'expected behavior' notes.
<li> STATE ERROR msg: on `debug pad`, using node.error(), only in case of UNRECOVERABLE ERROR, a misuse that MUST be correct in the desig phase. In production the node MUST run without ERROR msg.
<li> WARNING: Logs messages to console: minimal, to reduce the CPU load. Only basic INFO and RECOVERABLE misuse WARNINGs, the default is Silent Ignore. (so the log can be of help in fine tuning the app). Using `node.log("..")`. In production the node CAN run without WARNING msg. Anonymized.
<li> TRACE, for node debug, at any function entry, with params, uses debug(). not anonymized.
 </ol></ol>

**TEST flow** used:
![](https://github.com/msillano/tuyaDAEMON/blob/main/pics/ScreenShot_20210609163905.png?raw=true), see file: []()

**Devices** tested: [Wifi Plug](https://github.com/msillano/tuyaDAEMON/blob/main/devices/Wifi_Plug/device_Wifi_Plug.pdf): passed, [Power Strip](https://github.com/msillano/tuyaDAEMON/blob/main/devices/power_strip/device_power_strip.pdf): passed, [LED 700ml Humidifier](https://github.com/msillano/tuyaDAEMON/blob/main/devices/LED_700ml_Humidifier/device_LED_700ml_Humidifier.pdf): passed.

These devices are chosen because all accept SCHEMA. Tuya devices can present many variations to [expected behavior](https://github.com/msillano/tuyaDAEMON/tree/main/tuyaDAEMON#tuya-devices-capabilities-as-currently-known).

-------------------------------------------
### Expected behavior REFRESH
````
9/6/2021, 11:04:11node: Device INPUT
msg.payload : Object
object
   operation: "REFRESH"
   requestedDPS: array[7]
		0: 1
		1: 9
		2: 6
		3: 17
		4: 18
		5: 19
		6: 20

9/6/2021, 11:04:11node: Device Data
msg.payload.data.dps : Object
{ 18: 62, 19: 53 }  // ERROR !!!, expected 1,9,6,17,18,19,20 DPS, found only 18,19
````
note:
  **The expected behavior is not provided by ANY device because the 'tuyAPI' definitions are equivocal, and the implementation of tuyAPI is not consistent with the definitions.**
  The RULES I found on all my devices are, see [ISSUE#469](https://github.com/codetheweb/tuyapi/issues/469#issue-891834622):

>  - REFRESH causes immediate resampling: ALL data is recalculated.
>  - ONLY the CHANGED DPS are sent ALWAYS in output (NOT all DPS (SCHEMA) or the DPS in the `requestedDPS`  array!): i.e. conseguential with Tuya's aim to reduce the bandwidth.
>  - REFRESH, REFRESH SCHEMA, REFRESH DPS: ALL works the SAME WAY: i.e. there is only one REFRESH function (at least, with the implementation under test: tuyAPI ver. 7.1.0 ).
  
  In applications I only use a vanilla REFRESH, applying the above rules, and it works as expected with all my devices.
 
 ---------------------------------------------
 ### Expected behavior: at STARTUP, device _ON_, Disable auto-connect on start: _false_
 ````
9/6/2021, 13:20:41node: Node State
msg.payload : Object
{ state: "DISCONNECTED" }

9/6/2021, 13:20:42node: Node State
msg.payload : Object
{ state: "CONNECTING" }

9/6/2021, 13:20:43node: Node State
msg.payload : Object
{ state: "ERROR", context: object }

9/6/2021, 13:20:43node: Node State
msg.payload : Object
{ state: "DISCONNECTED" }

..... more

9/6/2021, 13:20:50node: Node State
msg.payload : Object
{ state: "CONNECTING" }

9/6/2021, 13:20:51node: Node State
msg.payload : Object
{ state: "CONNECTED" }
````
note:
- The CONNECTING-ERROR-DISCONNECTED cycle can be repeated more times: it is OK, can be 
     a consequence of too small _findTimeout_ value.
- In this case, the ERROR msg is superfluous: enough to ignore it in apps.
- Required: the initial 'DISCONNECTED' and the final 'CONNECTED'.
-------------------------------------------------------------------------
   
  ### Expected behavior: at STARTUP, device _ON_, Disable auto-connect on start: _true_
  
 ````  
 9/6/2021, 17:15:05node: Device State
msg.payload : Object
{ state: "DISCONNECTED" }
OK ---- waiting  CONTROL CONNECT
------ now CONTROL CONNECT

9/6/2021, 17:15:30node: Device INPUT
msg.payload : Object
{ operation: "CONTROL", action: "CONNECT" }

9/6/2021, 17:15:31node: Device State
msg.payload : Object
{ state: "CONNECTING" }

9/6/2021, 17:15:33node: Device State
msg.payload : Object
{ state: "CONNECTED" } 

```` 
 note:
- 'Disable auto-connect on start' is for only the first start after Deploy or Restart flows.
    If later the device goes OFF then back ON, the device is auto-connected.

- Required: user CONTROL 'CONNECT'|'RECONNECT' and the final 'CONNECTED'.
  
 ---------------------------------------------
 ### Expected behavior: at STARTUP, device _OFF_, Disable auto-connect on start: _false_
```` 
9/6/2021, 12:51:53node: Node State
msg.payload : Object
{ state: "DISCONNECTED" }

9/6/2021, 12:51:54node: Node State
msg.payload : Object
{ state: "CONNECTING" }

9/6/2021, 12:52:14node: Node State
msg.payload : Object
state: "ERROR"
    context: object
       message: "Error: find() timed out. Is the device powered on and the ID or IP correct?"
       device: "Wifi plug"
	   
9/6/2021, 12:52:14node: Node State
msg.payload : Object
{ state: "DISCONNECTED" }

9/6/2021, 12:52:24node: Node State
msg.payload : Object
{ state: "CONNECTING" }

9/6/2021, 12:52:44node: Node State
msg.payload : Object
state: "ERROR"
   context: object
      message: "Error: find() timed out. Is the device powered on and the ID or IP correct?"
      device: "Wifi plug"
......  more

````
note:
- Never-ending loop CONNECTING-ERROR-DISCONNECTED.
- In this case, the ERROR msg is superfluous: enough to ignore it in apps.
	- Between CONNECTING-ERROR, 20s == _findTimeout_
	- Between ERROR-DISCONNECTED  0s
	- Between DISCONNECTED-CONNECTING, 10s == _retryTimeout_
	
Required: 	
   - the initial 'DISCONNECTED'.
   - Infinite loop CONNECTING-(ERROR)-DISCONNECTED.
   - No `node.error` messages.
	 
---------------------------------------------	 
 ### Expected behavior:  device _OFF => ON_
```` 
9/6/2021, 13:37:53node: Node State
msg.payload : Object
{ state: "DISCONNECTED" }
// ---- here device goes ON

9/6/2021, 13:37:58node: Node State
msg.payload : Object
{ state: "CONNECTING" }

9/6/2021, 13:38:03node: Node State
msg.payload : Object
state: "ERROR"
   context: object
      message: "Error: find() timed out. Is the device powered on and the ID or IP correct?"
      device: "Wifi plug"
	  
9/6/2021, 13:38:03node: Node State
msg.payload : Object
{ state: "DISCONNECTED" }

9/6/2021, 13:38:08node: Node State
msg.payload : Object
{ state: "CONNECTING" }

9/6/2021, 13:38:10node: Node State
msg.payload : Object
{ state: "CONNECTED" }


9/6/2021, 13:38:32node: Device Data
msg.payload.data.dps : Object
{ 18: 62, 19: 53, 20: 2295 }
````	 
note:
- Required: the final 'CONNECTED'.
	 
---------------------------------------------	 
 ### Expected behavior  device ON => OFF

````	 

9/6/2021, 13:50:21node: Device Data
msg.payload.data.dps : Object
{ 18: 62, 19: 53, 20: 2299 }
//---- here device goes OFF

9/6/2021, 13:50:32node: Node State
msg.payload : Object
{ state: "DISCONNECTED" }

9/6/2021, 13:50:37node: Node State
msg.payload : Object
{ state: "CONNECTING" }

9/6/2021, 13:50:42node: Node State
msg.payload : Object
{ state: "DISCONNECTED" }

9/6/2021, 13:50:52node: Node State
msg.payload : Object
{ state: "CONNECTING" }

9/6/2021, 13:50:57node: Node State
msg.payload : Object
{ state: "DISCONNECTED" }

9/6/2021, 13:51:07node: Node State
msg.payload : Object
{ state: "CONNECTING" }
..........  more
````
note:
- Never-ending loop CONNECTING-DISCONNECTED.
- difference from STARTUP-OFF case: the STATE ERROR message is now missed: no problem, it is superfluous.
	- Between CONNECTING-DISCONNECTED  5s ==  _findTimeout_
	- Between DISCONNECTED-CONNECTING, 10s == _retryTimeout_

Required:
  - Infinite loop CONNECTING-(ERROR)-DISCONNECTED.
  - No 'node.error' messages.

---------------------------------------------	 
 ### Expected behavior:  CONNECT/DISCONNECT/RECONNECT CONTROL
 start condition:  _STARTUP_, device _ON_
````
9/6/2021, 14:03:39node: Node State
msg.payload : Object
{ state: "DISCONNECTED" }

9/6/2021, 14:03:40node: Node State
msg.payload : Object
{ state: "CONNECTING" }

9/6/2021, 14:03:43node: Node State
msg.payload : Object
{ state: "CONNECTED" }
------- now CONTROL DISCONNECT

9/6/2021, 14:03:48node: Device INPUT
msg.payload : Object
{ operation: "CONTROL", action: "DISCONNECT" }

9/6/2021, 14:03:48node: Node State
msg.payload : Object
{ state: "DISCONNECTED" }
OK, done ---- now more CONTROL DISCONNECT

9/6/2021, 14:04:13node: Device INPUT
msg.payload : Object
{ operation: "CONTROL", action: "DISCONNECT" }
OK, no effect ----  now CONTROL CONNECT

9/6/2021, 14:04:24node: Device INPUT
msg.payload : Object
{ operation: "CONTROL", action: "CONNECT" }

9/6/2021, 14:04:25node: Node State
msg.payload : Object
{ state: "CONNECTING" }

9/6/2021, 14:04:26node: Node State
msg.payload : Object
{ state: "CONNECTED" }
// OK, done  ----  now more CONTROL CONNECT

9/6/2021, 14:04:31node: Device INPUT
msg.payload : Object
{ operation: "CONTROL", action: "CONNECT" }
//  OK, no effect --- now CONTROL RECONNECT

9/6/2021, 14:04:44node: Device INPUT
msg.payload : Object
{ operation: "CONTROL", action: "RECONNECT" }

9/6/2021, 14:04:44node: Node State
msg.payload : Object
{ state: "DISCONNECTED" }

9/6/2021, 14:04:45node: Node State
msg.payload : Object
{ state: "CONNECTING" }

9/6/2021, 14:04:45node: Node State
msg.payload : Object
{ state: "CONNECTED" }
//  OK, done --- now second CONTROL RECONNECT

9/6/2021, 14:04:50node: Device INPUT
msg.payload : Object
{ operation: "CONTROL", action: "RECONNECT" }

9/6/2021, 14:04:50node: Node State
msg.payload : Object
{ state: "DISCONNECTED" }

9/6/2021, 14:04:51node: Node State
msg.payload : Object
{ state: "CONNECTING" }
// ok, re-done .....
...........   more

9/6/2021, 15:36:55node: Node State
msg.payload : Object
{ state: "DISCONNECTED" }
------------ now RECONNECT (but device DISCONNECTED)

9/6/2021, 15:36:57node: Device INPUT
msg.payload : Object
{ operation: "CONTROL", action: "RECONNECT" }

9/6/2021, 15:36:59node: Node State
msg.payload : Object
{ state: "CONNECTING" }

9/6/2021, 15:37:00node: Node State
msg.payload : Object
{ state: "CONNECTED" }
// OK, done: connected
````
Required:
  - CONNECT; connects the device, if DISCONNECTED, else does nothing.
 - DISCONNECT; disconnects the device, if CONNECTED, else does nothing.
 - RECONNECT: disconnects the device, if CONNECTED, then (re)connects them.

### Expected behavior: SET/GET/SCHEMA

````
//------------ SET 1, true
9/6/2021, 15:59:47node: Device INPUT
msg.payload : Object
{ dps: 1, set: true }

9/6/2021, 15:59:47node: Device Data
msg.payload.data.dps : Object
{ 1: true }
// OK: as expected --- SET 1, false

9/6/2021, 15:59:49node: Device INPUT
msg.payload : Object
{ dps: 1, set: false }
9/6/2021, 15:59:49node: Device Data
msg.payload.data.dps : Object
{ 1: false }
//  OK: as expected --- GET 1

9/6/2021, 15:59:55node: Device INPUT
msg.payload : Object
{ operation: "GET", dps: 1 }

9/6/2021, 15:59:55node: Device Data
msg.payload.data.dps : Object
{ 1: false
9: 0
17: 2
18: 0
19: 0
20: 2299
21: 1
22: 627
23: 29228
24: 17033
25: 2460
26: 0
38: "memory"
41: ""
42: ""
46: false }
//  ** Device quirk: the GET answer is like 'SCHEMA'
//--------- else using: SET 1, null

9/6/2021, 16:06:10node: Device INPUT
msg.payload : Object
{ dps: 1, set: null }
9/6/2021, 16:06:10node: Device Data
msg.payload.data.dps : Object
{ 1: true }
//  OK, as expected ----- with this device use alway 'SET dp, null' in place of 'GET dp'
// now--------  SCHEMA

9/6/2021, 16:06:16node: Device INPUT
msg.payload : Object
{ operation: "GET", schema: true }

9/6/2021, 16:06:16node: Device Data
msg.payload.data.dps : Object
object
1: true
9: 0
17: 2
18: 0
19: 0
20: 2299
21: 1
22: 627
23: 29228
24: 17033
25: 2460
26: 0
38: "memory"
41: ""
42: ""
46: false }
//  OK, as expected
````
note:
-  The unusual behavior of the 'Wifi Plug' in the case 'GET 1' was  [known](https://github.com/msillano/tuyaDAEMON/blob/main/devices/Wifi_Plug/device_Wifi_Plug.pdf).
- The SET/GET/SCHEMA device behavior is complicated by the presence of some fallbacks on `tuyAPI` implementation, so an unexpected result can become from the devices but also from tuyAPI.
- As `tuyAPI` users, we must accept the `tuyAPI + device` as a unique black-block, ready to accept possibles differences in the behavior for every new version.
