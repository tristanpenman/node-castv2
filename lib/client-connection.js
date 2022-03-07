const debug = require('debug')('castv2');

const EventEmitter = require('events');
const util = require('util');

const PacketStreamWrapper = require('./packet-stream-wrapper');
const protocol = require('./proto');

const CastMessage = protocol.CastMessage;

class ClientConnection extends EventEmitter {
  constructor(socket, clientId) {
    super();

    this.clientId = clientId;

    this.socket = socket;
    this.socket.once('close', this.handleDisconnect.bind(this));

    this.packetStream = new PacketStreamWrapper(socket);
    this.packetStream.on('packet', this.handlePacket.bind(this));
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

    // CASTV2_1_0
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
  }

  handleDisconnect() {
    debug('client %s disconnected', clientId);

    this.packetStream.removeListener('packet', onpacket);

    this.emit('disconnect', this.clientId);
  }

  send(buf) {
    this.packetStream.send(buf);
  }
}

module.exports = ClientConnection;
