const EventEmitter = require('events');

const PacketStreamWrapper = require('./packet-stream-wrapper');
const Receiver = require('./receiver');
const { CastMessage, DeviceAuthMessage } = require('./proto');

const {
  connectionNamespace,
  deviceAuthNamespace,
} = require('./namespaces');

class ClientConnection extends EventEmitter {
  constructor({ clientId, device, socket }) {
    super();

    this.clientId = clientId;
    this.device = device;
    this.socket = socket;

    this.receiver = new Receiver(this, this.device, 'receiver-0');
    this.device.registerTransport(this.receiver);
    this.device.registerSubscription(this, 'sender-0', 'receiver-0');

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

    switch (message.namespace) {
      case connectionNamespace:
        return this.processConnectionMessage(message);
      case deviceAuthNamespace:
        return this.processDeviceAuthMessage(message);
      default:
        return this.device.forwardMessage(message);
    }
  }

  processConnectionMessage(message) {
    this.device.registerSubscription(this, message.sourceId, message.destinationId)
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
      }), message.destinationId, message.sourceId);
    };

    this.device.emitChallenge(challenge, respond);
  }

  //
  // Helpers for sending messages
  //

  sendBinary(namespace, payloadBinary, sourceId, destinationId) {
    this.packetStream.send(
      CastMessage.serialize({
        destinationId,
        namespace,
        payloadBinary,
        payloadType: 1,
        protocolVersion: 0,
        sourceId
      })
    );
  }

  sendUtf8(namespace, payloadUtf8, sourceId, destinationId) {
    this.packetStream.send(
      CastMessage.serialize({
        destinationId,
        namespace,
        payloadUtf8,
        payloadType: 0,
        protocolVersion: 0,
        sourceId
      })
    );
  }
}

module.exports = ClientConnection;
