const EventEmitter = require('events').EventEmitter;
const util = require('util');
const tls = require('tls');
const debug = require('debug')('castv2');
const protocol = require('./proto');
const ClientConnection = require('./client-connection');

const CastMessage = protocol.CastMessage;

class Server extends EventEmitter {
  constructor({ device, certs }) {
    super();

    this.handleConnect = this.handleConnect.bind(this);
    this.handleError = this.handleError.bind(this);
    this.handleListen = this.handleListen.bind(this);
    this.handleShutdown = this.handleShutdown.bind(this);

    this.callback = null;
    this.clients = {};
    this.device = device;
    this.server = new tls.Server({
      cert: certs['pu'],
      key: certs['pr']
    });
  }

  close() {
    this.server.close();

    for (const clientId in this.clients) {
      const socket = this.clients[clientId].socket;
      socket.end();
    }
  }

  handleConnect(socket) {
    debug('connection from %s:%d', socket.remoteAddress, socket.remotePort);

    const clientId = [socket.remoteAddress, socket.remotePort].join(':');

    const clientConnection = new ClientConnection({
      clientId,
      device: this.device,
      socket
    });

    clientConnection.on('challenge', (respond) => {
      // allow the application to handle device authentication challenges
      this.emit('challenge', respond);
    });

    this.clients[clientId] = clientConnection;
  }

  handleError(err) {
    debug('error: %s %j', err.message, err);

    this.emit('error', err);
  }

  handleListen() {
    const addr = this.server.address();

    debug('server listening on %s:%d', addr.address, addr.port);

    if (this.callback) {
      this.callback();
    }
  }

  handleShutdown() {
    debug('server shutting down');

    this.server.removeListener('secureConnection', this.handleConnect);
    this.emit('close');
  }

  listen(_port, _host, _callback) {
    const args = Array.prototype.slice.call(arguments);
    if (typeof args[args.length - 1] === 'function') {
      this.callback = args.pop();
    }
  
    this.server.listen.apply(this.server, args.concat([this.handleListen]));
  
    this.server.on('secureConnection', this.handleConnect);
    this.server.on('error', this.handleError);
    this.server.once('close', this.handleShutdown);
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
  
    debug(
      'send message: clientId=%s protocolVersion=%s sourceId=%s destinationId=%s namespace=%s data=%s',
      clientId,
      message.protocolVersion,
      message.sourceId,
      message.destinationId,
      message.namespace,
      (message.payloadType === 1) // BINARY
        ? util.inspect(message.payloadBinary)
        : message.payloadUtf8
    );
  
    const buf = CastMessage.serialize(message);
  
    clientConnection.send(buf);
  }
}

module.exports = Server;
