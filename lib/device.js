const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

const Session = require('./session');

const androidMirroringAppId = '674A0243';
const chromeMirroringAppId = '0F5096E8';

class Device extends EventEmitter {
  constructor({ deviceModel, friendlyName, id, udn }) {
    super();

    this.deviceModel = deviceModel;
    this.friendlyName = friendlyName;
    this.id = id;
    this.udn = udn;

    this.transports = [];

    this.availableApps = [
      androidMirroringAppId,
      chromeMirroringAppId
    ];

    this.sessions = {};
    this.nextPid = 1;
  }

  forwardMessage(message) {
    const { destinationId } = message;

    const transport = this.transports[destinationId];
    if (!transport) {
      console.error('message destination is not a registered transport', {
        destinationId
      });
      return;
    }

    transport.transport.handleMessage(message);
  }

  registerSubscription(clientConnection, remoteId, localId) {
    const transport = this.transports[localId];
    if (!transport) {
      console.error('local transport is not a registered transport', {
        localId
      });
      return;
    }

    transport.subscriptions.push({
      clientConnection,
      remoteId
    });
  }

  registerTransport(transport) {
    this.transports[transport.transportId] = {
      transport,
      subscriptions: []
    };
  }

  broadcastBinary(namespace, payloadBinary, sourceId) {
    const transport = this.transports[sourceId];
    if (!transport) {
      console.error('message source is not a registered transport', {
        sourceId
      });
      return;
    }

    const clientConnections = {};
    transport.subscriptions.forEach(({ clientConnection }) => {
      clientConnections[clientConnection.clientId] = clientConnection;
    });

    Object.values(clientConnections).forEach((clientConnection) => {
      clientConnection.sendBinary(namespace, payloadBinary, sourceId, '*');
    });
  }

  broadcastUtf8(namespace, payloadUtf8, sourceId) {
    const transport = this.transports[sourceId];
    if (!transport) {
      console.error('message source is not a registered transport', {
        sourceId
      });
      return;
    }

    const clientConnections = {};
    transport.subscriptions.forEach(({ clientConnection }) => {
      clientConnections[clientConnection.clientId] = clientConnection;
    });

    Object.values(clientConnections).forEach((clientConnection) => {
      clientConnection.sendUtf8(namespace, payloadUtf8, sourceId, '*');
    });
  }

  sendBinary(namespace, payloadBinary, sourceId, destinationId) {
    const transport = this.transports[sourceId];
    if (!transport) {
      console.error('message source is not a registered transport', {
        sourceId
      });
      return;
    }

    const clientConnections = {};
    transport.subscriptions.forEach(({ clientConnection, remoteId }) => {
      if (remoteId === destinationId) {
        clientConnections[clientConnection.clientId] = clientConnection;
      }
    });

    Object.values(clientConnections).forEach((clientConnection) => {
      clientConnection.sendBinary(namespace, payloadBinary, sourceId, destinationId);
    });
  }

  sendUtf8(namespace, payloadUtf8, sourceId, destinationId) {
    const transport = this.transports[sourceId];
    if (!transport) {
      console.error('message source is not a registered transport', {
        sourceId
      });
      return;
    }

    const clientConnections = {};
    transport.subscriptions.forEach(({ clientConnection, remoteId }) => {
      if (remoteId === destinationId) {
        clientConnections[clientConnection.clientId] = clientConnection;
      }
    });

    Object.values(clientConnections).forEach((clientConnection) => {
      clientConnection.sendUtf8(namespace, payloadUtf8, sourceId, destinationId);
    });
  }

  startMirroringSession(appId, displayName) {
    const sessionId = uuidv4();
    const transportId = `pid-${this.nextPid}`;
    this.nextPid++;

    const session = new Session(appId, this, displayName, sessionId, transportId);
    this.sessions[sessionId] = session;
    this.registerTransport(session);

    this.emit('start', sessionId);
  }

  startApplication(appId) {
    if (Object.values(this.sessions).some((session) => session.appId === appId)) {
      console.log('application already started', {
        appId
      });
      return;
    }

    switch (appId) {
      case androidMirroringAppId:
        this.startMirroringSession(appId, 'Android Mirroring');
        break;
      case chromeMirroringAppId:
        this.startMirroringSession(appId, 'Chrome Mirroring');
        break;
      default:
        console.log('unsupported app', {
          appId
        });
    }
  }

  stopApplication(sessionId) {
    const session = this.sessions[sessionId];
    if (!session) {
      console.log('session not found', {
        sessionId
      });
      return;
    }

    delete this.sessions[sessionId];

    // TODO: properly tidy up session

    this.emit('stop', session.sessionId);
  }
}

module.exports = Device;
