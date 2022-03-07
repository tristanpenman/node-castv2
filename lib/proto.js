const { join } = require('path');
const ProtoBuf = require("protobufjs");

const extensions = {};
const messages = [
  'CastMessage',
  'AuthChallenge',
  'AuthResponse',
  'AuthError',
  'DeviceAuthMessage'
];

ProtoBuf.load(__dirname + "/cast_channel.proto", (err, root) => {
  if (err) {
    throw err;
  }

  messages.forEach(function(message) {
    extensions[message] = root.lookupType(`extensions.api.cast_channel.${message}`);
  });
});

messages.forEach((message) => {
  module.exports[message] = {
    serialize: function(data) {
      const Message = extensions[message];
      if (!Message) {
        throw new Error('extension not loaded yet');
      }
      return Message.encode(data).finish();
    },
    parse: function(data) {
      const Message = extensions[message];
      if (!Message) {
        throw new Error('extension not loaded yet');
      }
      return Message.decode(data);
    }
  };
});
