const EventEmitter = require('events');
const mdns = require('mdns');

class Advertisement extends EventEmitter {
  constructor(device, port) {
    super();

    this.device = device;
    this.port = port;

    this.ad = null;
  }

  start() {
    const { device, port } = this;
    const { deviceModel, friendlyName, id } = device;

    const serviceType = mdns.tcp('googlecast');
    const options = {
      txtRecord: {
        cd: '',                    // ?
        rm: '',                    // receiver metrisc ID
        ve: '02',                  // version
        st: 0,                     // ?
        rs: '',                    // ?
        nf: 1,                     // control notifications
        md: deviceModel,           // model
        id,                        // id
        ic: '/setup/icon.png',     // icon - TODO: should this be blank?
        fn: friendlyName,          // friendly name
        ca: 4101                   // capabilities
      }
    };

    this.ad = mdns.createAdvertisement(serviceType, port, options);
    this.ad.start();

    this.emit('start');
  }

  stop() {
    this.ad.stop();
  }
}

module.exports = Advertisement;
