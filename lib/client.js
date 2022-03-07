const EventEmitter = require('events').EventEmitter;
const util = require('util');
const tls = require('tls');
const debug = require('debug')('castv2');
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

    debug(
      'recv message: protocolVersion=%s sourceId=%s destinationId=%s namespace=%s data=%s',
      message.protocol_version,
      message.source_id,
      message.destination_id,
      message.namespace,
      (message.payload_type === 1) // BINARY
        ? util.inspect(message.payload_binary)
        : message.payload_utf8
    );

    if (message.protocol_version !== 0) {
      debug('client error: unsupported protocol version (%s)', message.protocolVersion);
      // TODO
      return;
    }

    this.emit('message',
      message.source_id,
      message.destination_id,
      message.namespace,
      (message.payload_type === 1) // BINARY
        ? message.payload_binary
        : message.payload_utf8
    );
  }

  send(sourceId, destinationId, namespace, data) {
    if (!this.packetStream) {
      throw 'not connected';
    }

    const message = {
      protocol_version: 0,
      source_id: sourceId,
      destination_id: destinationId,
      namespace: namespace
    };

    if (Buffer.isBuffer(data)) {
      message.payload_type = 1 // BINARY;
      message.payload_binary = data;
    } else {
      message.payload_type = 0 // STRING;
      message.payload_utf8 = data;
    }

    debug(
      'send message: protocolVersion=%s sourceId=%s destinationId=%s namespace=%s data=%s',
      message.protocol_version,
      message.source_id,
      message.destination_id,
      message.namespace,
      (message.payload_type === 1) // BINARY
        ? util.inspect(message.payload_binary)
        : message.payload_utf8
    );

    const buf = CastMessage.serialize(message);
    this.packetStream.send(buf);
  }
}

module.exports = Client;
