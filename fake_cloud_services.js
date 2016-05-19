'use strict';

console.log('*');
console.log('*');
console.log('* THIS IS THE FAKE CLOUD SERVICE....');
console.log('*');

// make traces silent by default. This is better for tests
function log(s) {
    var doit = false;
    if(doit) console.log(s);
}

exports.generateKey = function (keyName, region, cb) {
    log('FAKE generate Key ' + keyName + ' in region ' + region);
    cb(null, 'START FAKE KEY\n=====346785893bjhdfgsd847edjhvcs\nEND FAKE KEY');
};

exports.deleteKey = function (keyName, region, cb) {
    log('FAKE delete Key ' + keyName + ' in region ' + region);
    cb(null, 'true');
};

exports.launchSimulator = function (region, keyName, hardware, security, image, tags, script, cb) {

    var machineInfo = { id: 'x-424242',
                        region: 'us-east-1'
                      };
    cb(null, machineInfo);
};

exports.simulatorStatus = function (machineInfo, cb) {
    cb(null, {ip:'1.1.1.1', state:'running'});
};

exports.terminateSimulator = function (machineInfo, cb) {
    cb(null, 'shutting-down');
};

