'use strict';

// Load the SDK and UUID
var AWS = require ('aws-sdk');
var util = require ('util');

// configure what to do for cloud API calls:
var dryRun = process.env.CLOUDSIM_DRY_RUN === 'true';
console.log('process.env.CLOUDSIM_DRY_RUN (true means enabled): ' +  process.env.CLOUDSIM_DRY_RUN);

// Async functions to launch machines on a cloud provider
// AWS is the only supported one for now


//////////////////////////////////////////////////////////////////
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


///////////////////////////////////////////////////////////
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


/////////////////////////////////////////////////////////////
// Launch a simulator machine, given:
// @param[in] username Username (for info on the AWS console)
// @param[in] keyName Public ssh key name (must exist on AWS for that region)
// @param[in] simId Simulation id (for info on the AWS console)
// @param[in] region The region in which to launch the machine.
// @param[in] hardware A hardware type
// @param[in] image An AMI (image id registered in that region)
// @param[in] a call back function
exports.launchSimulator = function (region, keyName, hardware, security, image, tags, script, cb) {
    // set AWS region
    AWS.config.region = region;
    console.log('Launching simulator');
    console.log('- SSH key: ' +  keyName);
    console.log('- region:' + region);
    console.log('- hardware: ' +  hardware);
    console.log('- image: ' + image);
    console.log('- tags: ' + util.inspect(tags));
    console.log('');
    // AWS requires the script to be Base64-encoded MIME
    var userData = new Buffer(script).toString('base64');
    var awsParams = {
        KeyName: keyName,
        ImageId: image,
        InstanceType: hardware,
        MinCount:1,
        MaxCount: 1,
        UserData: userData,
        SecurityGroups: [security],
        DryRun: dryRun
    };
    var ec2 = new AWS.EC2();
    ec2.runInstances(awsParams, function (err, data) {
        if(err) {
            console.log('AWS launch error: ' + util.inspect(err));
            cb(err);
        }
        else {
            if(data.Instances.length > 0 && data.Instances[0]) {
                // console.log("data.instances[0]:  " +
                // util.inspect(data.Instances[0]));

                var machineInfo = { id: data.Instances[0].InstanceId,
                                    region: region
                              };

                // create tags with aws format:
                var Tags = [];
                for (var k in tags) {
                    // make sure value is a string
                    var v = '' + tags[k];
                    var t = {Key: k, Value: v};
                    Tags.push(t);
                }

                var params = {Resources: [machineInfo.id], Tags: Tags};
                ec2.createTags(params, function(err) {
                    if (err) {
                        console.log('Error creating tags for server: ' + util.inspect(err));
                        cb(err);
                    }
                    else {
                        cb(null, machineInfo);
                    }
                });
            }
            else
            {
                cb('No instance returned!');
            }
        }
    });
};


/////////////////////////////////////////////////////////
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
//        Filters: [],
        InstanceIds: [machineInfo.id]
    };

    AWS.config.region = machineInfo.region;
    var ec2 = new AWS.EC2();

    ec2.describeInstances(params, function(err, data) {
        if (err) {
            cb(err);
        }
        else {
            var instance = data.Reservations[0].Instances[0];
            var info = {
                ip: instance.PublicIpAddress,
                state: instance.State.Name
            };
            cb(null, info);
        }
    });
};


////////////////////////////////////////////////////
// Terminates a simulator machine.
// machineInfo must contain:
//       id: the AWS instance id
//       region: the region where the machine exists
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
            // console.log('terminate err: ' + err, err.stack);
            // an error occurred
            cb(err);
        } else  {
            // console.log('terminate data: ' + util.inspect(data));
            var info = data.TerminatingInstances[0].CurrentState;
            cb(null, info);
        }
    });
};


//////////////////////////////////////////////////////
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
