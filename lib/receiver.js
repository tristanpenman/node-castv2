const { receiverNamespace } = require('./namespaces');

class Receiver {
  constructor(clientConnection, device, transportId) {
    this.clientConnection = clientConnection;
    this.device = device;
    this.transportId = transportId;
  }

  handleMessage(message) {
    const request = JSON.parse(message.payloadUtf8);

    switch (request.type) {
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
          request
        });
    }
  }

  receiverGetAppAvailability({ appId, requestId }) {
    const availability = {}
    appId.forEach((id) => {
      availability[id] = this.device.availableApps.includes(id) ? 'APP_AVAILABLE' : 'APP_UNAVAILABLE'
    });

    this.clientConnection.sendUtf8(receiverNamespace, JSON.stringify({
      availability,
      requestId,
      responseType: 'GET_APP_AVAILABILITY'
    }), '*');
  }

  receiverGetStatus({ requestId }) {
    this.clientConnection.sendUtf8(receiverNamespace, JSON.stringify({
      requestId,
      status: {
        applications: this.device.applications,
        isActiveInput: true,
        volume: {
          level: 1.0,
          muted: false
        }
      },
      type: 'RECEIVER_STATUS'
    }), '*');
  }

  receiverLaunch(request) {
    this.device.startApplication(request.appId);
    this.receiverGetStatus(request);
  }

  receiverStop(request) {
    this.device.stopApplication(request.sessionId);
    this.receiverGetStatus(request);
  }
}

module.exports = Receiver;
