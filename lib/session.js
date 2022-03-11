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
        return this.processWebrtcMessage(message);
      default:
        console.warn('ignoring message for unimplemented namespace', {
          namespace
        });
        break;
    }
  }

  processWebrtcMessage(message) {
    const request = JSON.parse(message.payloadUtf8);
    const { type } = request;

    if (type !== 'OFFER') {
      console.warn('unknown webrtc message type', {
        type
      });
      return;
    }

    const respond = (answer) => {
      const payloadUtf8 = JSON.stringify({
        answer,
        type: 'ANSWER'
      });

      this.device.sendUtf8(webrtcNamespace, payloadUtf8, this.transportId, message.sourceId);
    };

    this.device.emitOffer(request.offer, this.sessionId, respond);
  }
}

module.exports = Session;
