const EventEmitter = require('events');

const PacketStreamWrapper = require('./packet-stream-wrapper');
const protocol = require('./proto');

const CastMessage = protocol.CastMessage;
const DeviceAuthMessage = protocol.DeviceAuthMessage;

const deviceAuthNamespace = 'urn:x-cast:com.google.cast.tp.deviceauth';

class ClientConnection extends EventEmitter {
  constructor(socket, clientId) {
    super();

    this.clientId = clientId;

    this.handleDisconnect = this.handleDisconnect.bind(this);
    this.handlePacket = this.handlePacket.bind(this);

    this.socket = socket;
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

    this.emit('message',
      this.clientId,
      message.sourceId,
      message.destinationId,
      message.namespace,
      (message.payloadType === 1) // BINARY
        ? message.payloadBinary
        : message.payloadUtf8
    );

    if (message.namespace === deviceAuthNamespace) {
      const deviceAuthMessage = DeviceAuthMessage.parse(message.payloadBinary);
      const challenge = deviceAuthMessage.challenge;

      this.emit('challenge', {
        challenge,
        respond: ({ clientAuthCertificate, intermediateCertificate, signature }) => {
          const payloadBinary = DeviceAuthMessage.serialize({
            response: {
              clientAuthCertificate,
              hashAlgorithm: 1,
              intermediateCertificate,
              signature
            }
          });

          const buf = CastMessage.serialize({
            destinationId: message.sourceId,
            namespace: message.namespace,
            payloadBinary,
            payloadType: 1, // BINARY
            protocolVersion: 0, // CASTV2_1_0
            sourceId: message.destinationId
          });

          this.send(buf);
        }
      });
    }
  }

  send(buf) {
    this.packetStream.send(buf);
  }
}

module.exports = ClientConnection;
