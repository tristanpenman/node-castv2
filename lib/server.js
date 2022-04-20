const EventEmitter = require('events').EventEmitter;
const tls = require('tls');
const protocol = require('./proto');
const ClientConnection = require('./client-connection');

const CastMessage = protocol.CastMessage;

class Server extends EventEmitter {
  constructor({ device, certs, clientPrefix }) {
    super();

    this.handleConnect = this.handleConnect.bind(this);
    this.handleError = this.handleError.bind(this);
    this.handleShutdown = this.handleShutdown.bind(this);

    this.clients = {};
    this.clientPrefix = clientPrefix;
    this.device = device;
    this.server = new tls.Server({
      cert: certs['pu'],
      key: certs['pr']
    });

    this.server.on('secureConnection', this.handleConnect);
    this.server.on('error', this.handleError);
    this.server.once('close', this.handleShutdown);
  }

  close() {
    this.server.close();

    for (const clientId in this.clients) {
      const socket = this.clients[clientId].socket;
      socket.end();
    }
  }

  handleConnect(socket) {
    const clientId = [socket.remoteAddress, socket.remotePort].join(':');

    if (this.clientPrefix && !socket.remoteAddress.startsWith(this.clientPrefix)) {
      return;
    }

    this.emit('connect', {
      clientId
    });

    this.clients[clientId] = new ClientConnection({
      clientId,
      device: this.device,
      socket
    });
  }

  handleError(err) {
    this.emit('error', err);
  }

  handleShutdown() {
    this.server.removeListener('secureConnection', this.handleConnect);
    this.emit('close');
  }

  listen(port, host) {
    this.server.listen(port, host, () => {
      const addr = this.server.address();
      this.emit('listening', {
        host: addr.address,
        port: addr.port
      });
    });
  };
 
  send(clientId, sourceId, destinationId, namespace, data) {
    const clientConnection = this.clients[clientId];
    if (!clientConnection) {
      // error
      return;
    }
  
    const message = {
      protocolVersion: 0,
      sourceId: sourceId,
      destinationId: destinationId,
      namespace: namespace
    };
  
    if (Buffer.isBuffer(data)) {
      message.payloadType = 1 // BINARY;
      message.payloadBinary = data;
    } else {
      message.payloadType = 0 // STRING;
      message.payloadUtf8 = data;
    }

    clientConnection.send(CastMessage.serialize(message));
  }
}

module.exports = Server;
