const ProtoBuf = require("protobufjs");

const extensions = {};
const messages = [
  'AuthChallenge',
  'AuthError',
  'AuthResponse',
  'CastMessage',
  'DeviceAuthMessage'
];

ProtoBuf.load(__dirname + "/cast_channel.proto", (err, root) => {
  if (err) {
    throw err;
  }

  messages.forEach((message) => {
    extensions[message] = root.lookupType(`cast_channel.${message}`);
  });
});

messages.forEach((message) => {
  module.exports[message] = {
    serialize: (data) => {
      const Message = extensions[message];
      if (!Message) {
        throw new Error('extension not loaded yet');
      }
      const err = Message.verify(data);
      if (err) {
        throw new Error(err);
      }
      return Message.encode(data).finish();
    },
    parse: (data) => {
      const Message = extensions[message];
      if (!Message) {
        throw new Error('extension not loaded yet');
      }
      return Message.decode(data);
    }
  };
});
