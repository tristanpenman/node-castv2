const EventEmitter = require('events');

const PacketStreamWrapper = require('./packet-stream-wrapper');
const Receiver = require('./receiver');
const { CastMessage, DeviceAuthMessage } = require('./proto');

const {
  connectionNamespace,
  deviceAuthNamespace,
  heartbeatNamespace,
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
        break;
    }

    // new logic
    if (this.device.forwardMessage(message)) {
      return;
    }

    // old logic
    switch (message.namespace) {
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

    this.device.sendUtf8(heartbeatNamespace, JSON.stringify({
      type: 'PONG'
    }), message.destinationId, message.sourceId);
  }

  processSetupMessage(message) {
    const request = JSON.parse(message.payloadUtf8);

    this.device.sendUtf8(setupNamespace, JSON.stringify({
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
    }), message.destinationId, message.sourceId);
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
