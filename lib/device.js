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

class Device {
  constructor({ deviceModel, friendlyName, id }) {
    this.deviceModel = deviceModel;
    this.friendlyName = friendlyName;
    this.id = id;

    // default backdrop application
    this.applications = [
      {
        appId: backdropAppId,
        displayName: 'Backdrop',
        namespaces: [
          { name: receiverNamespace },
          { name: debugNamespace },
          { name: remotingNamespace }
        ],
        sessionId: 'AD3DFC60-A6AE-4532-87AF-18504DA22607',
        statusText: '',
        transportId: 'pid-22607'
      }
    ];

    this.availableApps = [
      androidMirroringAppId,
      chromeMirroringAppId
    ];
  }

  startApplication(appId) {
    if (this.applications.some((application) => application.appId === appId)) {
      console.log('application already started', {
        appId
      });
      return;
    }

    switch (appId) {
      case androidMirroringAppId:
        this.applications.push({
          appId,
          displayName: 'Android Mirroring',
          isIdleScreen: false,
          namespaces: [
            { name: mediaNamespace },
            { name: webrtcNamespace }
          ],
          sessionId: '835ff891-f76f-4a04-8618-a5dc95477075',
          statusText: '',
          transportId: 'web-5'
        });
        break;
      case chromeMirroringAppId:
        this.applications.push({
          appId,
          displayName: 'Chrome Mirroring',
          namespaces: [
            { name: mediaNamespace },
            { name: webrtcNamespace }
          ],
          sessionId: '7E2FF513-CDF6-9A91-2B28-3E3DE7BAC174',
          statusText: '',
          transportId: 'web-5'
        });
        break;
      default:
        console.log('unsupported app', {
          appId
        });
    }
  }
}

module.exports = Device;
