const {
  debugNamespace,
  mediaNamespace,
  remotingNamespace,
  webrtcNamespace
} = require('./namespaces');

class Session {
  constructor(appId, device, displayName, sessionId, transportId) {
    this.appId = appId;
    this.device = device;
    this.displayName = displayName;
    this.sessionId = sessionId;
    this.transportId = transportId;

    this.namespaces = [
      { name: debugNamespace },
      { name: mediaNamespace },
      { name: remotingNamespace },
      { name: webrtcNamespace }
    ];
  }

  handleMessage(message) {
    const { namespace } = message;

    switch (namespace) {
      case webrtcNamespace:
        const request = JSON.parse(message.payloadUtf8);
        console.log('webrtc message received', {
          request
        });
        break;
      default:
        console.warn('ignoring message for unimplemented namespace', {
          namespace
        });
        break;
    }
  }
}

module.exports = Session;
