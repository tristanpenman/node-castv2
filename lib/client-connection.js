const debug = require('debug')('castv2');

const EventEmitter = require('events');
const util = require('util');

const PacketStreamWrapper = require('./packet-stream-wrapper');
const protocol = require('./proto');

const CastMessage = protocol.CastMessage;
const DeviceAuthMessage = protocol.DeviceAuthMessage;

const deviceAuthNamespace = "urn:x-cast:com.google.cast.tp.deviceauth"

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
    debug('client %s disconnected', this.clientId);

    this.packetStream.removeListener('packet', this.handlePacket);
    this.emit('disconnect', this.clientId);
  }

  handlePacket(buf) {
    const message = CastMessage.parse(buf);

    debug(
      'recv message: clientId=%s protocolVersion=%s sourceId=%s destinationId=%s namespace=%s data=%s',
      this.clientId,
      message.protocolVersion,
      message.sourceId,
      message.destinationId,
      message.namespace,
      (message.payloadType === 1) // BINARY
        ? util.inspect(message.payloadBinary)
        : message.payloadUtf8
    );

    if (message.protocolVersion !== 0) {
      debug('client error: clientId=%s unsupported protocol version (%s)', clientId, message.protocolVersion);

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
      this.emit('challenge', ({ icaCert, platformCert, signature }) => {
        const payloadBinary = DeviceAuthMessage.serialize({
          response: {
            clientAuthCertificate: platformCert,
            intermediateCertificate: [icaCert],
            hashAlgorithm: 1,
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

        this.send(buf)
      });
    }
  }

  send(buf) {
    this.packetStream.send(buf);
  }
}

module.exports = ClientConnection;
