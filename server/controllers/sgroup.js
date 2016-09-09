'use strict';

/// Module dependencies.
var util = require('util');
var csgrant = require('cloudsim-grant');

// initialise cloudServices, depending on the environment
var cloudServices = null;
var useFakeCloudServices = true;
if (process.env.AWS_ACCESS_KEY_ID && process.env.NODE_ENV !== 'test') {
  cloudServices = require('../../cloud_services.js');
  useFakeCloudServices = false;
} else {
  cloudServices = require('../../fake_cloud_services.js');
}

const awsData = {region: 'us-west-1'};

/////////////////////////////////////////////////
/// Create a security group
/// @param req Nodejs request object.
/// @param res Nodejs response object.
/// @return Security group create function.
exports.create = function(req, res) {
  if (!cloudServices) {
    // Create an error
    var error = {error: {
      msg: 'Cloud services are not available'
    }};
    console.log(error.msg)
    res.jsonp(error);
    return;
  }

  var sgroupName = req.body.resource;
  if (!sgroupName)
  {
    var error = {
      error: {
        msg: 'Missing required fields (resource)'
      }
    }
    console.log(error.msg)
    res.jsonp(error);
    return;
  }

  // get unique resource id
  csgrant.getNextResourceId('sgroup', (err, resourceName) => {
    if (err) {
      res.status(500).jsonp(err);
      return;
    }

    const info = {groupName: sgroupName, region: awsData.region};
    cloudServices.createSecurityGroup(info, function (err, result) {
      if (err) {
        res.status(500).jsonp(err);
        return;
      }

      // add traffic rule.
      // default - allow traffic from within the same group
      const ruleInfo = {groupId: result.GroupId,
                        sourceGroupName: sgroupName,
                        region: awsData.region};
      cloudServices.addSecurityGroupInboundRule(ruleInfo,
          function (ruleErr, ruleResult) {

        if (ruleErr) {
          res.status(500).jsonp(ruleErr);
          return;
        }

        // add the resource to csgrant
        csgrant.createResource(req.user, resourceName,
            {name: sgroupName, groupId: result.GroupId},
            (err, data) => {
          let r = {};
          if (err) {
            res.status(500).jsonp(err);
            return;
          }
          r.success = true;
          r.result = data;
          r.id = resourceName;
          res.jsonp(r);
        })
      })
    })
  })
};

/////////////////////////////////////////////////
/// Delete a security group.
/// @param req Nodejs request object.
/// @param res Nodejs response object.
/// @return Destroy function
exports.destroy = function(req, res) {

  if (!cloudServices) {
    // Create an error
    const error = {error: {
      success: false,
      msg: 'Cloud services are not available'
    }};
    console.log(error.msg)
    res.status(500).jsonp(error);
    return;
  }

  let sgroupName = req.sgroup;

  if (!sgroupName)
  {
    var error = {
      error: {
        success: false,
        msg: 'Missing required fields (resource)'
      }
    }
    console.log(error.msg)
    res.status(500).jsonp(error);
    return;
  }

  // read the resource to get the aws security group id
  csgrant.readResource(req.user, sgroupName, function(err, data) {
    if (err) {
      res.status(500).jsonp(err);
      return;
    }

    if (!data.data.groupId) {
      var error = {
        error: {
          success: false,
          msg: 'Invalid security group id'
        }
      }
      res.status(500).jsonp(err);
    }

    // finally remove the security group
    const info = {groupId:data.data.groupId, region:awsData.region};
    cloudServices.deleteSecurityGroup(info, function(err, result) {
      if (err) {
        res.status(500).jsonp(err);
        return;
      }

      csgrant.deleteResource(req.user, sgroupName, (err, data) => {
        let r = {};
        if (err) {
          res.status(500).jsonp(err);
          return;
        }
        r.success = true;
        r.resource = req.resourceData;
        res.jsonp(r);
      })
    });
  });
};
