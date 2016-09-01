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

var fakeSims = [];
var simCounter = 0;

var fakeSubnets = [];
var subnetCounter = 0;

exports.generateKey = function (keyName, region, cb) {
  log('FAKE generate Key ' + keyName + ' in region ' + region);
  cb(null, 'START FAKE KEY\n=====346785893bjhdfgsd847edjhvcs\nEND FAKE KEY');
};

exports.deleteKey = function (keyName, region, cb) {
  log('FAKE delete Key ' + keyName + ' in region ' + region);
  cb(null, 'true');
};

exports.launchSimulator = function (region, keyName, hardware, security,
    image, tags, script, cb) {

  var simId = 'fake-424242-' + simCounter.toString();
  simCounter++;
  var machineInfo = { id: simId,
                      region: 'us-east-1'
                    };
  fakeSims.push({id: simId, state: 'pending'});
  cb(null, machineInfo);
};

exports.simulatorStatus = function (machineInfo, cb) {
  var idx = fakeSims.map(
      function(e){return e.id}).indexOf(machineInfo.id);

  cb(null, {ip:'1.1.1.1', state: fakeSims[idx].state});
};

exports.terminateSimulator = function (machineInfo, cb) {

  var idx = fakeSims.map(
      function(e){return e.id}).indexOf(machineInfo.id);
  if (idx >= 0)
    fakeSims[idx].state = 'terminated';

//  cb(null, 'shutting-down');
  cb(null, 'terminated');
};

exports.simulatorStatuses = function (machineInfo, cb) {
  var out = {};
  var array = [];
  for (var i = 0; i < fakeSims.length; ++i) {
    array.push(
        {InstanceId: fakeSims[i].id,
        InstanceState : {Name: fakeSims[i].state}});
  }
  out.InstanceStatuses = array;
  cb(null, out);
};

exports.createSubnet = function (cidr, vpc, cb) {
  var subnetId = 'fake-subnet-1122-' + subnetCounter.toString();
  subnetCounter++;

  var subnetInfo = {VpcId: 'fake_vpc_id-' + subnetId, SubnetId: subnetId}
  fakeSubnets.push(subnetInfo);
  cb(null, subnetInfo);
}

exports.deleteSubnet = function (subnetName, cb) {
  var idx = fakeSubnets.map(
      function(e){return e.SubnetId}).indexOf(subnetName);

  console.log('removing sub ' + idx + ' ' + subnetName);

  if (idx >= 0) {
    fakeSims.splice(idx, 1);
  }
  else {
    var error = {error: 'Subnet not found'};
    cb(error, null);
    return;
  }

  var sub = {};
  sub.SubnetId = fakeSubnets[idx].SubnetId;
  sub.VpcId = fakeSubnets[idx].VpcId;
  cb(null, sub);
}

exports.getSubnets = function (filters, subnetIds, cb) {
  if (filters && filters.length > 0) {
    console.log('filters not supported for now');
  }
  var result = [];
  for (var i = 0; i < subnetIds.length; ++i) {
    var id = subnetIds[i];
    var idx = fakeSubnets.map(
        function(e){return e.SubnetId}).indexOf(id);
    if (idx >= 0)
      result.push(id);
  }
  cb(null, result);
}
