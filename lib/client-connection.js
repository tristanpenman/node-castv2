const EventEmitter = require('events');

const PacketStreamWrapper = require('./packet-stream-wrapper');
const { CastMessage, DeviceAuthMessage } = require('./proto');

// namespaces
const connectionNamespace = 'urn:x-cast:com.google.cast.tp.connection';
const deviceAuthNamespace = 'urn:x-cast:com.google.cast.tp.deviceauth';
const discoveryNamespace = 'urn:x-cast:com.google.cast.receiver.discovery';
const heartbeatNamespace = 'urn:x-cast:com.google.cast.tp.heartbeat';
const multizoneNamespace = 'urn:x-cast:com.google.cast.multizone';
const receiverNamespace = 'urn:x-cast:com.google.cast.receiver';
const setupNamespace = 'urn:x-cast:com.google.cast.setup';
const webrtcNamespace = 'urn:x-cast:com.google.cast.webrtc';

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

    // otherwise we ignore further connection attempts
    switch (message.namespace) {
      case connectionNamespace:
        console.error('already connected; ignoring message', {
          message
        });
        return;
      case deviceAuthNamespace:
        return this.processDeviceAuthMessage(message);
      case heartbeatNamespace:
        return this.processHeartbeatRequest(message);
      case setupNamespace:
        return this.processSetupMessage(message);
      case discoveryNamespace:
      case multizoneNamespace:
      case receiverNamespace:
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

  processHeartbeatRequest(message) {
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
