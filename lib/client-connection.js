const EventEmitter = require('events');

const PacketStreamWrapper = require('./packet-stream-wrapper');
const { CastMessage, DeviceAuthMessage } = require('./proto');

const {
  connectionNamespace,
  deviceAuthNamespace,
  discoveryNamespace,
  heartbeatNamespace,
  multizoneNamespace,
  receiverNamespace,
  setupNamespace,
  webrtcNamespace
} = require('./namespaces');

class ClientConnection extends EventEmitter {
  constructor({ clientId, device, socket }) {
    super();

    this.clientId = clientId;
    this.device = device;
    this.socket = socket;

    // set when a CONNECT message is received
    this.connected = false;
    this.receiverId = '0';
    this.senderId = '0';

    this.handleDisconnect = this.handleDisconnect.bind(this);
    this.handlePacket = this.handlePacket.bind(this);

    this.socket.once('close', this.handleDisconnect);

    this.packetStream = new PacketStreamWrapper(socket);
    this.packetStream.on('packet', this.handlePacket);
  }

  //
  // Socket / packet stream handlers
  //

  handleDisconnect() {
    this.packetStream.removeListener('packet', this.handlePacket);
    this.emit('disconnect', this.clientId);
  }

  handlePacket(buf) {
    const message = CastMessage.parse(buf);

    if (message.protocolVersion !== 0) {
      this.socket.end();
      return;
    }

    // only process connection and device auth messages when not yet connected
    if (!this.connected) {
      switch (message.namespace) {
        case connectionNamespace:
          return this.processConnectionMessage(message);
        case deviceAuthNamespace:
          return this.processDeviceAuthMessage(message);
        default:
          console.log('not connected; ignoring message', {
            message
          });
          return;
      }
    }

    this.processMessageWhileConnected(message);
  }

  //
  // Route messages normally while connected
  //

  processMessageWhileConnected(message) {
    switch (message.namespace) {
      case connectionNamespace:
        console.error('already connected; ignoring message', {
          message
        });
        return;
      case deviceAuthNamespace:
        return this.processDeviceAuthMessage(message);
      case heartbeatNamespace:
        return this.processHeartbeatMessage(message);
      case receiverNamespace:
        return this.processReceiverMessage(message);
      case setupNamespace:
        return this.processSetupMessage(message);
      case discoveryNamespace:
      case multizoneNamespace:
      case webrtcNamespace:
        console.log('known but unimplemented namespace; ignoring message', {
          message
        });
        return;
      default:
        console.log('unrecognised namespace; ignoring message', {
          message
        });
        return;
    }
  }

  //
  // Message handlers for all namespaces
  //

  processConnectionMessage(message) {
    this.connected = true;
    this.receiverId = message.destinationId;
    this.senderId = message.sourceId;
  }

  processDeviceAuthMessage(message) {
    const request = DeviceAuthMessage.parse(message.payloadBinary);
    const challenge = request.challenge;

    // supply callback for responding to the device authentication challenge
    const respond = ({ clientAuthCertificate, intermediateCertificate, signature }) => {
      this.sendBinary(deviceAuthNamespace, DeviceAuthMessage.serialize({
        response: {
          clientAuthCertificate,
          hashAlgorithm: 1,
          intermediateCertificate,
          signature
        }
      }));
    };

    this.emit('challenge', {
      challenge,
      respond
    });
  }

  processHeartbeatMessage(message) {
    const request = JSON.parse(message.payloadUtf8);

    if (request.type !== 'PING') {
      console.log('unexpected heartbeat request type', {
        request
      });
      return;
    }

    this.sendUtf8(heartbeatNamespace, JSON.stringify({
      type: 'PONG'
    }));
  }

  processReceiverMessage(message) {
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

  processSetupMessage(message) {
    const request = JSON.parse(message.payloadUtf8);

    this.sendUtf8(setupNamespace, JSON.stringify({
      data: {
        device_info: {
          // TODO: shouldn't hard code this...
          ssdp_udn: "ce391871-f16d-4b9c-8bab-05e856297f0a"
        },
        name: this.device.friendlyName,
        version: 8
      },
      request_id: request.request_id,
      response_code: 200,
      response_string: "OK",
      type: "eureka_info"
    }));
  }

  //
  // Message handlers for receiver namespace
  //

  receiverGetAppAvailability({ appId, requestId }) {
    const availability = {}
    appId.forEach((id) => {
      availability[id] = this.device.availableApps.includes(id) ? 'APP_AVAILABLE' : 'APP_UNAVAILABLE'
    });

    this.sendUtf8(receiverNamespace, JSON.stringify({
      availability,
      requestId,
      responseType: 'GET_APP_AVAILABILITY'
    }));
  }

  receiverGetStatus({ requestId }) {
    this.sendUtf8(receiverNamespace, JSON.stringify({
      requestId,
      status: {
        applications: this.device.applications,
        isActiveInput: true,
        volume: {
          level: 1,
          muted: false
        }
      },
      type: 'RECEIVER_STATUS'
    }));
  }

  receiverLaunch(request) {
    this.device.startApplication(request.appId);
    this.receiverGetStatus(request);
  }

  receiverStop(_request) {
    // TODO
  }

  //
  // Helpers for sending messages
  //

  sendBinary(namespace, payloadBinary) {
    this.packetStream.send(
      CastMessage.serialize({
        destinationId: this.senderId,
        namespace,
        payloadBinary,
        payloadType: 1,
        protocolVersion: 0,
        sourceId: this.receiverId
      })
    );
  }

  sendUtf8(namespace, payloadUtf8) {
    this.packetStream.send(
      CastMessage.serialize({
        destinationId: this.senderId,
        namespace,
        payloadUtf8,
        payloadType: 0,
        protocolVersion: 0,
        sourceId: this.receiverId
      })
    );
  }
}

module.exports = ClientConnection;
