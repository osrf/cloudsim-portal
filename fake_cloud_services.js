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

var fakeSecurityGroups = [];
var sgCounter = 0;

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

exports.createSecurityGroup = function (groupName, cb) {
  let sgId = 'fake-sg-' + groupName + '-' + sgCounter.toString();
  sgCounter++;

  let sgData = {GroupId: sgId, GroupName: groupName}
  fakeSecurityGroups.push(sgData);
  cb(null, sgData);
}

exports.deleteSecurityGroup = function (groupId, cb) {
  var idx = fakeSecurityGroups.map(
      function(e){return e.GroupId}).indexOf(groupId);

  console.log('removing sub ' + idx + ' ' + groupId);

  let response = {};
  if (idx >= 0) {
    response.GroupId = fakeSecurityGroups[idx].GroupId;
    response.GroupName = fakeSecurityGroups[idx].GroupName;
    fakeSecurityGroups.splice(idx, 1);
  }
  else {
    let error = {error: 'Security group not found'};
    cb(error, null);
    return;
  }

  cb(null, response);
}

exports.getSecurityGroups = function (filters, groupIds, cb) {
  if (filters && filters.length > 0) {
    console.log('filters not supported for now');
  }
  var result = [];
  result.SecurityGroups = [];

  if (groupIds && groupId.length > 0)
  {
    for (let i = 0; i < groupIds.length; ++i) {
      const id = groupIds[i];
      const idx = fakeSecurityGroups.map(
          function(e){return e.GroupId}).indexOf(id);
      if (idx >= 0)
        result.SecurityGroups.push(fakeSecurityGroups[idx]);
    }
  }
  else
  {
    for (let i = 0; i < fakeSecurityGroups.length; ++i) {
      result.SecurityGroups.push(fakeSecurityGroups[i]);
    }
  }
  cb(null, result);
}
