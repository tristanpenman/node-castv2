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
          return this.processConnectionRequest(message);
        case deviceAuthNamespace:
          return this.processDeviceAuthRequest(message);
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
        return this.processDeviceAuthRequest(message);
      case discoveryNamespace:
      case heartbeatNamespace:
      case multizoneNamespace:
      case receiverNamespace:
      case setupNamespace:
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

  processConnectionRequest(message) {
    this.connected = true;
    this.receiverId = message.destinationId;
    this.senderId = message.sourceId;
  }

  processDeviceAuthRequest(message) {
    const deviceAuthMessage = DeviceAuthMessage.parse(message.payloadBinary);
    const challenge = deviceAuthMessage.challenge;

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
