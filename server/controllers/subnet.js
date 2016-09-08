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

/////////////////////////////////////////////////
/// Create a subnet
/// @param[in] req Nodejs request object.
/// @param[out] res Nodejs response object.
/// @return Subnet create function.
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

  var subnetName = req.body.resource;
  if (!subnetName)
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

  csgrant.getNextResourceId('subnet', (err, resourceName) => {
    if (err) {
      res.status(500).jsonp(err);
      return;
    }

    // TODO
    var cidr = '';
    var vpc = '';
    cloudServices.createSubnet(cidr, vpc, function (err, result) {
      if (err) {
        res.status(500).jsonp(err);
        return;
      }

      csgrant.createResource(req.user, resourceName,
          {name: subnetName, vpc_id: result.VpcId, subnet_id: result.SubnetId},
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
};

/////////////////////////////////////////////////
/// Delete a subnet.
/// @param[in] req Nodejs request object.
/// @param[out] res Nodejs response object.
/// @return Destroy function
exports.destroy = function(req, res) {

  if (!cloudServices) {
    // Create an error
    var error = {error: {
      success: false,
      msg: 'Cloud services are not available'
    }};
    console.log(error.msg)
    res.status(500).jsonp(error);
    return;
  }

  var subnetName = req.subnet;

  if (!subnetName)
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

  csgrant.readResource(req.user, subnetName, function(err, data) {
    if (err) {
      res.status(500).jsonp(err);
      return;
    }

    if (!data.data.subnet_id) {
      var error = {
        error: {
          success: false,
          msg: 'Invalid subnet id'
        }
      }
      res.status(500).jsonp(err);
    }

    // finally terminate the subnet
    cloudServices.deleteSubnet(data.data.subnet_id, function(err, result) {
      if (err) {
        res.status(500).jsonp(err);
        return;
      }

      csgrant.deleteResource(req.user, subnetName, (err, data) => {
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
