'use strict';

// Load the SDK and UUID
const AWS = require ('aws-sdk');
const util = require ('util');

// read environment
require('dotenv').config()

const log = console.log

// configure what to do for cloud API calls:
var dryRun = process.env.CLOUDSIM_DRY_RUN === 'true';
log('process.env.CLOUDSIM_DRY_RUN (true means enabled): ' +  process.env.CLOUDSIM_DRY_RUN);

// useful defaults for AWS server information
exports.awsDefaults = {
  region : 'us-west-1',
  keyName : 'cloudsim',
  security : 'cloudsim-sim',
}

// Generates a new ssh key, registers the public key on the cloud
// provider and saves the private key
// @param[in] keyName the key name
// @param[in] region the region where the server is
//            located
exports.generateKey = function (keyName, region, cb) {
  AWS.config.region = region;
  var ec2 = new AWS.EC2();
  var params = {
    DryRun: false,
    KeyName: keyName
  };
  ec2.createKeyPair(params, function(err, data) {
    if(err) {
      cb(err);
    } else {
      cb(null, data.KeyMaterial);
    }
  });
};


// Deletes a public ssh key from AWS
// @param[in] keyName the key name
// @param[in] region the region where the key is located
exports.deleteKey = function (keyName, region, cb) {
  AWS.config.region = region;
  var ec2 = new AWS.EC2();
  var params = {
    DryRun: false,
    KeyName: keyName
  };
  ec2.deleteKeyPair(params, function(err, data) {
    if(err) {
      cb(err);
    } else {
      cb(null, data.return);
    }
  });
};


// Launch a simulator machine, given:
// @param[in] region The region in which to launch the machine.
// @param[in] keyName Public ssh key name (an existing key on that AWS region).
// @param[in] hardware AWS AMI disk image.
// @param[in] security AWS security group (or a list of groups).
// @param[in] image An AMI (image id registered in that region).
// @param[in] tags AWS tags for that instance (object with key value pairs)
// @param[in] script Cloud-init user data (bash script to be run on launch)
// @param[in] cb Callback (err, data) where data is instance information.
exports.launchSimulator = function (region,
  keyName, hardware, security, image, tags, script, cb) {
  // set AWS region
  AWS.config.region = region

  log('Launching simulator')
  log('- region:' + region)
  log('- SSH key: ' +  keyName)
  log('- hardware: ' +  hardware)
  log('- security: ' +  security)
  log('- image: ' + image)
  log('- tags: ' + util.inspect(tags))
  log('- script size:' + script.length)
  log('')
  const securityGroups = Array.isArray(security)?security:[security]
  // AWS requires the script to be Base64-encoded MIME
  var userData = new Buffer(script).toString('base64')
  var awsParams = {
    KeyName: keyName,
    ImageId: image,
    InstanceType: hardware,
    MinCount:1,
    MaxCount: 1,
    UserData: userData,
    SecurityGroups: securityGroups,
    InstanceInitiatedShutdownBehavior : 'terminate',
    DryRun: dryRun
  }
  var ec2 = new AWS.EC2();
  ec2.runInstances(awsParams, function (err, data) {
    if(err) {
      console.log('AWS launch error: ' + util.inspect(err))
      cb(err)
    }
    else {
      if(data.Instances.length > 0 && data.Instances[0]) {
        // console.log("data.instances[0]:  " +
        // util.inspect(data.Instances[0]));
        var machineInfo = { id: data.Instances[0].InstanceId,
          region: region
        }

        // create tags with aws format:
        var Tags = [];
        for (var k in tags) {
          // make sure value is a string
          var v = '' + tags[k];
          var t = {Key: k, Value: v}
          Tags.push(t);
        }
        // add tags (they will be visible on the AWS console)
        var params = {Resources: [machineInfo.id], Tags: Tags}
        ec2.createTags(params, function(err) {
          if (err) {
            console.log('Error creating tags for server: ' + util.inspect(err))
            cb(err)
          }
          else {
            cb(null, machineInfo)
          }
        })
      }
      else
      {
        cb('No instance returned!')
      }
    }
  })
}

// Get the ip address and status of a simulator machine
// @params[in] machineInfo machineInfo must contain:
//      id: the AWS instance id
//      region: the AWS region where the machine exists
// @param[in] cb Callback function to use when this function is complete.
exports.simulatorStatus = function (machineInfo, cb) {
  // the parameters for describeInstances call
  // we only want information about a single
  // machine (machineInfo.id
  var params = {
    DryRun: dryRun,
    InstanceIds: [machineInfo.id]
  };

  AWS.config.region = machineInfo.region;
  var ec2 = new AWS.EC2();

  ec2.describeInstances(params, function(err, data) {
    if (err) {
      cb(err)
    }
    else {
      let instance
      try {
        instance = data.Reservations[0].Instances[0]
      } catch (ex) {
        cb(ex)
        return
      }
      const info = {
        ip: instance.PublicIpAddress,
        state: instance.State.Name,
        launchTime: instance.LaunchTime
      }
      // This field may not be available if the instance was already terminated
      // We use it as a hack to know the "creation" time of the instance.
      if (instance.BlockDeviceMappings && instance.BlockDeviceMappings[0]) {
        info.creationTime = instance.BlockDeviceMappings[0].Ebs.AttachTime
      }
      // Field only available when the instance is terminating or terminated
      if (instance.StateTransitionReason) {
        // Example of aws returned value:
        // "StateTransitionReason":"User initiated (2017-03-24 18:42:25 GMT)"
        // The following is an ugly block of code, but it is the only format that
        // aws returns for the termination time
        try {
          let timeStr = instance.StateTransitionReason
                            .slice(16, -1)
                            .replace(' GMT', '.000Z')
                            .replace(' ', 'T')
          let dateRegEx = /(\d{4})-(\d{2})-(\d{2})T(\d{2})\:(\d{2})\:(\d{2})\.000Z/
          if (dateRegEx.test(timeStr)) {
            info.terminationTime = new Date(timeStr)
          }
        } catch (e) {
          // nothing to do: terminationTime will be kept undefined
        }
      }
      cb(null, info);
    }
  });
};

// Terminates a simulator machine.
// machineInfo must contain:
//       id: the AWS instance id
//       region: the region where the machine exists
// cb argument is a callback function with 2 args: error and info.
exports.terminateSimulator = function (machineInfo, cb) {
  // parameters for terminateInstances
  // we specifiy which machine to
  // terminate in the InstanceIds array
  var params = {
    InstanceIds: [ machineInfo.id],
    DryRun: dryRun
  };
  AWS.config.region = machineInfo.region;
  var ec2 = new AWS.EC2();
  ec2.terminateInstances(params, function(err, data) {
    if (err) {
      // an error occurred
      cb(err);
    } else  {
      var info = data.TerminatingInstances[0].CurrentState;
      cb(null, info);
    }
  });
};


// Uploads a public ssh key to a specific AWS region
// The key name on AWS is 'cs-' + the specified username
exports.setupPublicKey = function (keyname, keydata, region, cb) {
  var params = {
    // required
    KeyName: keyname,
    // required
    PublicKeyMaterial: keydata,
    DryRun: dryRun
  };

  AWS.config.region = region;
  var ec2 = new AWS.EC2();

  ec2.importKeyPair(params, function(err, data) {
    if (err) {
      // an error occurred
      console.log(err, err.stack);
      cb(err);
    }
    else {
      // successful response
      console.log(util.inspect(data));
      var info = data;
      cb(null, info);
    }
  });
};


// Get the status of all running instances
// @params[in] region the AWS region
// @params[in] machineIds an array of machine ids
// @param[in] cb Callback function to use when this function is complete.
exports.simulatorStatuses = function (region, machineIds, cb) {

  var params = {
    DryRun: dryRun,
    IncludeAllInstances: true
  }

  if (machineIds && machineIds.length > 0)
    params.InstanceIds = machineIds

  AWS.config.region = region;
  var ec2 = new AWS.EC2();

  var awsData ={};
  awsData.InstanceStatuses = [];

  // internal function to get info from AWS for our machines
  var getAWSStatusData = function() {
    ec2.describeInstanceStatus(params, function(err, data) {
      if (err) {
        cb(err);
      }
      else {
        if (data.InstanceStatuses && data.InstanceStatuses.length > 0) {
          // new data from this call to getAWSStatusData.
          awsData.InstanceStatuses =
              awsData.InstanceStatuses.concat(data.InstanceStatuses);
        }
        if (data.NextToken) {
          params.NextToken = data.NextToken;
          // call ourselves again
          getAWSStatusData()
        }
        else {
          // this is the last time, invoke  callback
          // console.log('\n\n====\nsimulatorStatuses:', util.inspect(awsData))
          cb(null, awsData)
          return;
        }
      }
    })
  }
  // call describeInstances, possibly multiple times
  getAWSStatusData()
}

// Create a security group
// @params info - groupName: Name of security group, and region: ec2 region
// @param cb - Callback function to use when this function is complete.
exports.createSecurityGroup = function (info, cb) {
  const params = {
    GroupName: info.groupName,
    DryRun: dryRun,
    Description: info.groupName + '-portal'
  };

  AWS.config.region = info.region;
  const ec2 = new AWS.EC2();
  ec2.createSecurityGroup(params, function(err, data) {
    if (err)
      cb(err, null);
    else {
      cb(null, data);
    }
  });
}

// Delete a security group
// @param info - groupId: security group id, region: ec2 region
// @param cb - Callback function to use when this function is complete.
exports.deleteSecurityGroup = function (info, cb) {
  const params = {
    DryRun: dryRun,
    GroupId: info.groupId
  };

  AWS.config.region = info.region;
  const ec2 = new AWS.EC2();
  ec2.deleteSecurityGroup(params, function(err, data) {
    if (err)
      cb(err, null);
    else {
      cb(null, data);
    }
  });
}

// Get a list of security groups
// @param info - filters: array of filters [{Name: 'string', Value: ['string']}]
//               groupIds: array of security group ids ['string']
//               region: ec2 region
exports.getSecurityGroups = function (info, cb) {
  const params = {
    DryRun: dryRun,
    Filters: info.filters,
    GroupIds: info.groupIds
  };

  AWS.config.region = info.region;
  const ec2 = new AWS.EC2();
  ec2.describeSecurityGroups(params, function(err, data) {
    if (err)
      cb(err, null);
    else {
      cb(null, data);
    }
  });
}

// add an inbound rule to a security group
// @param info - groupId: security group id
//               sourceGroupName: source security group to give permission to
//               region: ec2 region
// @param cb - Callback function to use when this function is complete.
exports.addSecurityGroupInboundRule = function (info, cb) {
  const params = {
    DryRun: dryRun,
    GroupId: info.groupId,
    SourceSecurityGroupName: info.sourceGroupName
  };

  AWS.config.region = info.region;
  const ec2 = new AWS.EC2();
  ec2.authorizeSecurityGroupIngress(params, function(err, data) {
    if (err)
      cb(err, null);
    else {
      cb(null, data);
    }
  });
}

// delete an inbound rule from a security group
// @param info - groupId: security group id,
//               sourceGroupName: source security group to remove permission
//                                from
//               region: ec2 region
// @param cb - Callback function to use when this function is complete.
exports.deleteSecurityGroupInboundRule = function (info, cb) {
  const params = {
    DryRun: dryRun,
    GroupId: info.groupId,
    SourceSecurityGroupName: info.sourceGroupName
  };

  AWS.config.region = info.region;
  const ec2 = new AWS.EC2();
  ec2.revokeSecurityGroupIngress(params, function(err, data) {
    if (err)
      cb(err, null);
    else {
      cb(null, data);
    }
  });
}

// generate a cloud-init script that will run once the aws instance
// starts
// @param user - the launching user name
// @param opions - the extra options (a json dict) passed to the instance
exports.generateScript = function (user, options) {
  const rawKey = process.env.CLOUDSIM_AUTH_PUB_KEY
  const key = rawKey.replace( new RegExp( "\n", "g" ),"\\n")
  // use empty dict if options is null or undefined
  const opts = options?options:{}
  const optionsStr = JSON.stringify(opts, null, 2)

  /*eslint no-control-regex: "off"*/
  const script = `#!/usr/bin/env bash
# This script creates a bash file that launches a docker container
# The container runs a webservice through which gzserver can be
# controlled

directory="/home/ubuntu/code"
fullpath="$directory/cloudsim-env.bash"
logpath="$directory/cloudsim.log"
deploypath="$directory/cloudsim_deploy.bash"
optionspath="$directory/cloudsim-options.json"

mkdir -p $directory

date > $logpath
echo "writing $fullpath file" >> $logpath

# This script is generated as part of the cloud-init when the ec2 instance is
# launched. However it is too early at that time to launch the container because
# the docker daemon is not running yet.
# see cloudsim-portal/docker_cloudsim_env.bash for the source code
# A custom upstart service running on the host will source this script
# when it starts.

cat <<DELIM > $optionspath
${optionsStr}
DELIM

cat <<DELIM > $fullpath
#!/usr/bin/env bash

PORT=4000
CLOUDSIM_AUTH_PUB_KEY="${key}"
CLOUDSIM_ADMIN="${user}"

date >> $logpath
echo "$fullpath data loaded" >> $logpath

DELIM

if [ -f "$deploypath" ]; then
  date >> $logpath
  echo "invoking script \"$deploypath\"" >> $logpath

  $deploypath

  date >> $logpath
  echo "executed: \"$deploypath\"" >> $logpath
else
  date >> $logpath
  echo "can't find script \"$deploypath\"" >> $logpath
fi

date >> $logpath
echo "cloud-init is done" >> $logpath
`
  return script
}
