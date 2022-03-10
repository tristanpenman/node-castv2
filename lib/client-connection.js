const EventEmitter = require('events');

const PacketStreamWrapper = require('./packet-stream-wrapper');
const Receiver = require('./receiver');
const { CastMessage, DeviceAuthMessage } = require('./proto');

const {
  connectionNamespace,
  deviceAuthNamespace,
  heartbeatNamespace,
  receiverNamespace,
  setupNamespace,
} = require('./namespaces');

class ClientConnection extends EventEmitter {
  constructor({ clientId, device, socket }) {
    super();

    this.clientId = clientId;
    this.device = device;
    this.socket = socket;

    this.receiver = new Receiver(this, this.device, 'receiver-0');
    this.device.registerTransport(this.receiver);

    // set when a CONNECT message is received
    // TODO: make this dynamic
    this.receiverId = 'receiver-0';
    this.senderId = 'sender-0';

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
        // TODO
        break;
      case deviceAuthNamespace:
        return this.processDeviceAuthMessage(message);
      default:
        break;
    }

    // new logic
    if (this.device.forwardMessage(message)) {
      return;
    }

    // old logic
    switch (message.namespace) {
      case connectionNamespace:
        return this.processConnectionMessage(message);
      case heartbeatNamespace:
        return this.processHeartbeatMessage(message);
      case setupNamespace:
        // TODO: this may be obsolete
        return this.processSetupMessage(message);
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

  processSetupMessage(message) {
    const request = JSON.parse(message.payloadUtf8);

    this.sendUtf8(setupNamespace, JSON.stringify({
      data: {
        device_info: {
          ssdp_udn: this.device.udn
        },
        name: this.device.friendlyName,
        version: 8
      },
      request_id: request.requestId,
      response_code: 200,
      response_string: "OK",
      type: "eureka_info"
    }));
  }

  //
  // Helpers for sending messages
  //

  sendBinary(namespace, payloadBinary, destinationId = null) {
    this.packetStream.send(
      CastMessage.serialize({
        destinationId: destinationId || this.senderId,
        namespace,
        payloadBinary,
        payloadType: 1,
        protocolVersion: 0,
        sourceId: this.receiverId
      })
    );
  }

  sendUtf8(namespace, payloadUtf8, destinationId = null) {
    this.packetStream.send(
      CastMessage.serialize({
        destinationId: destinationId || this.senderId,
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
