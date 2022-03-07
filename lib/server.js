const EventEmitter = require('events').EventEmitter;
const util = require('util');
const tls = require('tls');
const debug = require('debug')('castv2');
const protocol = require('./proto');
const ClientConnection = require('./client-connection');

const CastMessage = protocol.CastMessage;

function genClientId(socket) {
  return [socket.remoteAddress, socket.remotePort].join(':');
}

function Server(options) {
  EventEmitter.call(this);

  this.server = new tls.Server(options);
  this.clients = {};
}

util.inherits(Server, EventEmitter);

Server.prototype.listen = function(port, host, callback) {
  const self = this;

  const args = Array.prototype.slice.call(arguments);
  if (typeof args[args.length - 1] === 'function') {
    callback = args.pop();
  }

  this.server.listen.apply(this.server, args.concat([onlisten]));

  this.server.on('secureConnection', onconnect);
  this.server.on('error', onerror);
  this.server.once('close', onshutdown);

  function onlisten() {
    var addr = self.server.address();

    debug('server listening on %s:%d', addr.address, addr.port);

    if (callback) {
      callback();
    }
  }

  function onconnect(socket) {
    debug('connection from %s:%d', socket.remoteAddress, socket.remotePort);

    const clientId = genClientId(socket);

    self.clients[clientId] = new ClientConnection(socket, clientId);
  }

  function onshutdown() {
    debug('server shutting down');

    self.server.removeListener('secureConnection', onconnect);
    self.emit('close');
  }

  function onerror(err) {
    debug('error: %s %j', err.message, err);

    self.emit('error', err);
  }
};

Server.prototype.close = function() {
  this.server.close();
  for (const clientId in this.clients) {
    const socket = this.clients[clientId].socket;
    socket.end();
  }
};

Server.prototype.send = function(clientId, sourceId, destinationId, namespace, data) {
  const clientConnection = this.clients[clientId];
  if (!clientConnection) {
    // error
    return;
  }

  const message = {
    protocolVersion: 0, // CASTV2_1_0
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
};

module.exports = Server;
