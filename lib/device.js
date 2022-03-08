const EventEmitter = require('events');
const { uuid } = require('uuidv4');

const {
  debugNamespace,
  mediaNamespace,
  receiverNamespace,
  remotingNamespace,
  webrtcNamespace
} = require('./namespaces');

const androidMirroringAppId = '674A0243';
const backdropAppId = 'E8C28D3C';
const chromeMirroringAppId = '0F5096E8';

class Device extends EventEmitter {
  constructor({ deviceModel, friendlyName, id }) {
    super();

    this.deviceModel = deviceModel;
    this.friendlyName = friendlyName;
    this.id = id;
    this.udn = udn;

    this.availableApps = [
      androidMirroringAppId,
      backdropAppId,
      chromeMirroringAppId
    ];

    this.applications = [
      this.newBackdrop()
    ];
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
      sessionId: uuid(),
      statusText: '',
      transportId: 'web-5'
    };
  }

  newBackdrop() {
    return {
      appId: backdropAppId,
      displayName: 'Backdrop',
      namespaces: [
        { name: debugNamespace },
        { name: receiverNamespace },
        { name: remotingNamespace }
      ],
      sessionId: uuid(),
      statusText: '',
      transportId: 'pid-22607'
    };
  }

  newChromeMirroring() {
    return {
      appId: chromeMirroringAppId,
      displayName: 'Chrome Mirroring',
      namespaces: [
        { name: mediaNamespace },
        { name: webrtcNamespace }
      ],
      sessionId: uuid(),
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

    if (application.appId === backdropAppId) {
      console.log('cannot stop backdrop app', {
        sessionId
      });
    }

    this.applications = this.applications.filter((app) => app.sessionId !== sessionId);

    this.emit('stop', application.sessionId);
  }
}

module.exports = Device;
