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

let fakeSecurityGroups = [];
let fakeSecurityGroupInboundRules = [];
let sgCounter = 0;

// useful defaults for AWS server information
exports.awsDefaults = {
  region : 'us-west-1',
  keyName : 'cloudsim',
  security : 'cloudsim-sim',
}

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

exports.simulatorStatuses = function (region, machineIds, cb) {
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

exports.createSecurityGroup = function (info, cb) {
  let sgId = 'fake-sg-' + info.groupName + '-' + sgCounter.toString();
  sgCounter++;

  let sgData = {GroupId: sgId, GroupName: info.groupName}
  fakeSecurityGroups.push(sgData);
  cb(null, sgData);
}

exports.deleteSecurityGroup = function (info, cb) {
  let idx = fakeSecurityGroups.map(
      function(e){return e.GroupId}).indexOf(info.groupId);

  let response = {};
  if (idx >= 0) {
    response = JSON.parse(JSON.stringify(fakeSecurityGroups[idx]))
    fakeSecurityGroups.splice(idx, 1);
  }
  else {
    let error = {error: 'Security group not found'};
    cb(error, null);
    return;
  }

  cb(null, response);
}

exports.getSecurityGroups = function (info, cb) {
  if (info.filters && info.filters.length > 0) {
    console.log('filters not supported for now');
  }
  let result = [];
  result.SecurityGroups = [];

  if (groupIds && groupId.length > 0)
  {
    for (let i = 0; i < info.groupIds.length; ++i) {
      const id = info.groupIds[i];
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

// add an inbound rule to a security group
// @param info - groupId: security group id
//               sourceGroupName: source security group to give permission to
//               region: ec2 region
// @param cb - Callback function to use when this function is complete.
exports.addSecurityGroupInboundRule = function (info, cb) {

  let idx = -1;
  for (let i = 0; i < fakeSecurityGroupInboundRules.length; ++i)
  {
    let rule = fakeSecurityGroupInboundRules[i];
    if (rule.groupId === info.groupId &&
        rule.sourceGroupName === info.sourceGroupName) {
      idx = i;
      break;
    }
  }
  if (idx >= 0) {
    cb(null, rule);
    return;
  }

  let rule = {};
  rule.groupId = info.groupId;
  rule.sourceGroupName = info.sourceGroupName;
  fakeSecurityGroupInboundRules.push(rule);
  cb(null, rule);
}

// delete an inbound rule from a security group
// @param info - groupId: security group id,
//               sourceGroupName: source security group to remove permission
//                                from
//               region: ec2 region
// @param cb - Callback function to use when this function is complete.
exports.deleteSecurityGroupInboundRule = function (info, cb) {

  let response = {};
  let idx = -1;
  for (let i = 0; i < fakeSecurityGroupInboundRules.length; ++i)
  {
    let rule = fakeSecurityGroupInboundRules[i];
    if (rule.groupId === info.groupId &&
        rule.sourceGroupName === info.sourceGroupName) {
      idx = i;
      break;
    }
  }
  if (idx >= 0) {
    response = JSON.parse(JSON.stringify(fakeSecurityGroupInboundRules[idx]));
    fakeSecurityGroupInboundRules.splice(idx, 1);
  }
  cb(null, response);
}

exports.generateScript = function (user) {
  return "generateScript for user: " + user
}
