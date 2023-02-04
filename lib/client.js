const EventEmitter = require('events');
const tls = require('tls');
const protocol = require('./proto');
const PacketStreamWrapper = require('./packet-stream-wrapper');

const CastMessage = protocol.CastMessage;

class Client extends EventEmitter {
  constructor(options) {
    super();

    this.options = options;
    this.socket = null;
    this.packetStream = null;
  }

  connect(callback) {
    this.socket = tls.connect(this.options, () => {
      this.packetStream = new PacketStreamWrapper(this.socket);
      this.packetStream.on('packet', this.handlePacket.bind(this));

      if (callback) {
        callback();
      }
    });
  }

  handlePacket(buf) {
    const message = CastMessage.parse(buf);

    if (message.protocolVersion !== 0) {
      this.socket.end();
      return;
    }

    this.emit('message', message);
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

module.exports = Client;
