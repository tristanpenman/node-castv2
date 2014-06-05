var EventEmitter  = require('events').EventEmitter;
var util          = require('util');
var debug         = require('debug')('castv2-message-bus');

function Channel(bus, namespace, encoding) {
  EventEmitter.call(this);

  this.bus = bus;
  this.namespace = namespace;
  this.encoding = encoding;

  var self = this;

  this.bus.on('message', onmessage);
  this.once('close', onclose);

  function onmessage(sourceId, destinationId, namespace, data) {
    if(namespace !== self.namespace) return;
    self.emit('message', sourceId, destinationId, decode(data, self.encoding));
  }

  function onclose() {
    self.bus.removeListener('message', onmessage);
  }
}

util.inherits(Channel, EventEmitter);

Channel.prototype.send = function(sourceId, destinationId, data) {
  this.bus.send(
    sourceId,
    destinationId,
    this.namespace,
    encode(data, this.encoding)
  );
};

Channel.prototype.close = function() {
  this.emit('close');
};

function encode(data, encoding) {
  if(!encoding) return data;
  switch(encoding) {
    case 'JSON': return JSON.stringify(data);
    default: throw new Error('Unsupported channel encoding: ' + encoding);
  }
}

function decode(data, encoding) {
  if(!encoding) return data;
  switch(encoding) {
    case 'JSON': return JSON.parse(data);
    default: throw new Error('Unsupported channel encoding: ' + encoding);
  }
}

module.exports = Channel;