const { 
  heartbeatNamespace,
  receiverNamespace,
  setupNamespace
} = require('./namespaces');

class Receiver {
  constructor(clientConnection, device, transportId) {
    this.clientConnection = clientConnection;
    this.device = device;
    this.transportId = transportId;
  }

  handleMessage(message) {
    const { namespace } = message;
    switch (namespace) {
      case heartbeatNamespace:
        return this.processHeartbeatMessage(message);
      case receiverNamespace:
        return this.processReceiverMessage(message);
      case setupNamespace:
        return this.processSetupMessage(message);
      default:
        console.error('unknown namespace', {
          namespace
        });
    }
  }

  //
  // heartbeat namespace
  //

  processHeartbeatMessage(message) {
    const { type } = JSON.parse(message.payloadUtf8);

    if (type !== 'PING') {
      console.error("unknown heartbeat message type", {
        type
      });
      return;
    }

    const payloadUTf8 = JSON.stringify({
      type: 'PONG'
    });

    this.device.sendUtf8(heartbeatNamespace, payloadUTf8, message.destinationId, message.sourceId);
  }

  //
  // receiver namespace
  //

  processReceiverMessage(message) {
    const request = JSON.parse(message.payloadUtf8);
    const { type } = request;

    switch (type) {
      case 'GET_APP_AVAILABILITY':
        return this.receiverGetAppAvailability(request);
      case 'GET_STATUS':
        return this.receiverGetStatus(request);
      case 'LAUNCH':
        return this.receiverLaunch(request);
      case 'STOP':
        return this.receiverStop(request);
      default:
        console.log('unknown receiver message type', {
          type
        });
    }
  }

  receiverGetAppAvailability({ appId, requestId }) {
    const availability = {}
    appId.forEach((id) => {
      availability[id] = this.device.availableApps.includes(id) ? 'APP_AVAILABLE' : 'APP_UNAVAILABLE'
    });

    const payloadUtf8 = JSON.stringify({
      availability,
      requestId,
      responseType: 'GET_APP_AVAILABILITY'
    });

    this.device.broadcastUtf8(receiverNamespace, payloadUtf8, this.transportId);
  }

  receiverGetStatus({ requestId }) {
    const applications = Object.values(this.device.sessions).map((session) => ({
      appId: session.appId,
      displayName: session.displayName,
      isIdleScreen: false,
      namespaces: session.namespaces,
      sessionId: session.sessionId,
      statusText: '',
      transportId: session.transportId
    }));

    const payloadUtf8 = JSON.stringify({
      requestId,
      status: {
        applications,
        isActiveInput: true,
        volume: {
          level: 1.0,
          muted: false
        }
      },
      type: 'RECEIVER_STATUS'
    });

    this.device.broadcastUtf8(receiverNamespace, payloadUtf8, this.transportId);
  }

  receiverLaunch(request) {
    this.device.startApplication(request.appId);
    this.receiverGetStatus(request);
  }

  receiverStop(request) {
    this.device.stopApplication(request.sessionId);
    this.receiverGetStatus(request);
  }

  //
  // setup namespace
  //

  processSetupMessage(message) {
    const request = JSON.parse(message.payloadUtf8);
    const { requestId } = request;
    const { friendlyName, udn } = this.device;

    const payloadUtf8 = JSON.stringify({
      data: {
        device_info: {
          ssdp_udn: udn
        },
        name: friendlyName,
        version: 8
      },
      request_id: requestId,
      response_code: 200,
      response_string: "OK",
      type: "eureka_info"
    });

    this.device.sendUtf8(setupNamespace, payloadUtf8, message.destinationId, message.sourceId);
  }
}

module.exports = Receiver;
