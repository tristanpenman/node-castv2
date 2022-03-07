const EventEmitter = require('events');

const WAITING_HEADER = 0;
const WAITING_PACKET = 1;

class PacketStreamWrapper extends EventEmitter {
  state = WAITING_HEADER;
  packetLength = 0;

  constructor(stream) {
    super();

    this.stream = stream;
    this.stream.on('readable', () => {
      while (true) {
        switch (this.state) {
          case WAITING_HEADER:
            const header = stream.read(4);
            if (header === null) {
              return;
            }
            this.packetLength = header.readUInt32BE(0);
            this.state = WAITING_PACKET;
            break;

          case WAITING_PACKET:
            const packet = stream.read(this.packetLength);
            if (packet === null) {
              return;
            }
            this.emit('packet', packet);
            this.state = WAITING_HEADER;
            break;
        }
      }
    });
  }

  send(buf) {
    const header = new Buffer(4);
    header.writeUInt32BE(buf.length, 0);
    this.stream.write(Buffer.concat([header, buf]));
  }
}

module.exports = PacketStreamWrapper;
