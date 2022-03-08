const androidMirroringAppId = '674A0243';
const backdropAppId = 'E8C28D3C';
const chromeMirroringAppId = '0F5096E8';

class Device {
  constructor({ deviceModel, friendlyName, id }) {
    this.deviceModel = deviceModel;
    this.friendlyName = friendlyName;
    this.id = id;
  }
}

module.exports = Device;
