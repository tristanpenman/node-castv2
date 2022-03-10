const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

const {
  debugNamespace,
  mediaNamespace,
  remotingNamespace,
  webrtcNamespace
} = require('./namespaces');

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

    this.applications = [];
  }

  forwardMessage(message) {
    const { destinationId } = message;

    const transport = this.transports[destinationId];
    if (!transport) {
      // TODO: temporary
      return false;

      // console.error('message destination does not exist', {
      //   destinationId
      // });
    }

    transport.transport.handleMessage(message);
    return true;
  }

  registerSubscription(clientConnection, remoteId, localId) {
    const transport = this.transports[localId];
    if (!transport) {
      // uh oh
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
      // uh oh
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
      // uh oh
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
      // uh oh
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
      // uh oh
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

  newAndroidMirroring() {
    return {
      appId: androidMirroringAppId,
      displayName: 'Android Mirroring',
      isIdleScreen: false,
      namespaces: [
        { name: mediaNamespace },
        { name: webrtcNamespace }
      ],
      sessionId: uuidv4(),
      statusText: '',
      transportId: 'web-5'
    };
  }

  newChromeMirroring() {
    return {
      appId: chromeMirroringAppId,
      displayName: 'Chrome Mirroring',
      isIdleScreen: false,
      namespaces: [
        { name: debugNamespace },
        { name: mediaNamespace },
        { name: remotingNamespace },
        { name: webrtcNamespace }
      ],
      sessionId: uuidv4(),
      statusText: '',
      transportId: 'web-5'
    };
  }

  startApplication(appId) {
    if (this.applications.some((app) => app.appId === appId)) {
      console.log('application already started', {
        appId
      });
      return;
    }

    switch (appId) {
      case androidMirroringAppId:
        this.applications.push(this.newAndroidMirroring());
        break;
      case chromeMirroringAppId:
        this.applications.push(this.newChromeMirroring());
        break;
      default:
        console.log('unsupported app', {
          appId
        });
    }

    const sessionId = this.applications[this.applications.length - 1].sessionId;

    this.emit('start', sessionId);
  }

  stopApplication(sessionId) {
    const application = this.applications.find((app) => app.sessionId === sessionId);
    if (!application) {
      console.log('session not found', {
        sessionId
      });
      return;
    }

    this.applications = this.applications.filter((app) => app.sessionId !== sessionId);

    this.emit('stop', application.sessionId);
  }
}

module.exports = Device;
