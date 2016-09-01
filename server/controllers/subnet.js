'use strict';

/// Module dependencies.
var mongoose = require('mongoose'),
    Subnet = mongoose.model('Subnet');

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
var adminResource = 'simulators_list';

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

  var subnetId = req.body.id;
  if (!subnetId)
  {
    var error = {
      error: {
        msg: 'Missing required fields (id)'
      }
    }
    console.log(error.msg)
    res.jsonp(error);
    return;
  }

  // check permission - only users with write access to adminResource
  // can create resources
  csgrant.isAuthorized(req.user.username, adminResource, false,
      (err, authorized) => {
    if (err) {
      console.log('is authorized error:' + err)
      return res.jsonp({success: false, error: err})
    }
    if (!authorized) {
      const msg = 'insufficient permission for user "'
          + req.user.username + '"';
      console.log(msg)
      return res.jsonp({success: false, error: msg});
    }

    Subnet.findOne({id: subnetId}).exec(
        function(err, sub) {
      // in case of error, hand it over to the next middleware
      if (err) {
        var error = {error: {
          msg: 'Error checking subnet'
        }};
        res.jsonp(error);
        return;
      }
      if (sub) {
        var error = {error: {
          msg: 'Subnet: ' + subnetId + ' already exists'
        }};
        res.jsonp(error);
        return;
      }

      // add resource to csgrant
      csgrant.createResource(req.user.username, subnetId, {},
          (err, data) => {
        if (err) {
          console.log('create resource error:' + err)
          res.jsonp(error(err));
          return;
        }

        // TODO
        var cidr = '';
        var vpc = '';
        cloudServices.createSubnet(cidr, vpc,
            function (err, result) {
          if (err) {
            // Create an error
            var error = {error: {
              message: err.message,
              error: err
            }};
            console.log(error.msg)
            res.jsonp(error);
            return;
          }

          // TODO
          var data = {};
          data.id = req.body.id;
          data.vpc_id = result.VpcId;
          data.subnet_id = result.SubnetId;

          var subnet = new Subnet(data);
          subnet.save(function(err) {
            if (err) {
              var error = {error: {
                msg: 'Error saving subnet'
              }};
              console.log(error.msg)
              res.jsonp(error);
            } else {
              res.jsonp(subnet.toObject());
            }
          }); // subnet.save
        });
      });
    });
  });
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
      msg: 'Cloud services are not available'
    }};
    console.log(error.msg)
    res.jsonp(error);
    return;
  }

  var subnetId = req.body.id;

  if (!subnetId)
  {
    var error = {
      error: {
        msg: 'Missing required fields (id)'
      }
    }
    console.log(error.msg)
    res.jsonp(error);
    return;
  }

  Subnet.findOne({id: subnetId}).exec(
      function(err, sub) {
    // in case of error, hand it over to the next middleware
    if (err) {
      var error = {error: {
        msg: 'Error removing simulator'
      }};
      res.jsonp(error);
      return;
    }

    // If a simulator instance was not found, then return an error
    if (!sub) {
      var error = {error: {
        msg: 'Cannot find subnet'
      }};
      res.jsonp(error);
      return;
    }

    // check permission
    csgrant.isAuthorized(req.user.username, subnetId, false,
        (err, authorized) => {
      if (err) {
        return res.jsonp({success: false, error: err})
      }
      if (!authorized) {
        const msg = 'insufficient permission for user "'
            + req.user.username + '"'
        return res.jsonp({success: false, error: msg})
      }

      // delete resource from csgrant?
      csgrant.deleteResource(req.user.username, subnetId, (err, data) => {
        if (err)
          return res.jsonp({success: false, error: err})

        // finally terminate the subnet
        cloudServices.deleteSubnet(sub.subnet_id, function(err, result) {
            if (err) {
              var error = {error: {
                msg: 'Error deleting subnet'
              }};
              res.jsonp(error);
              return;
            } else {
              var ret = sub.toObject();
              Subnet.remove({id: subnetId});
              res.jsonp(ret);
            }
        });
      });
    })
  });
};

/////////////////////////////////////////////////
/// List all subnets for a user.
/// @param[in] req Nodejs request object.
/// @param[out] res Nodejs response object.
/// @return Function to get all subnets for a user.
exports.all = function(req, res) {
  var result = [];

  // filter subnets based on permission
  var filtered = [];
  var filterSubnets = function(s, subnetList, cb) {
    if (s == subnetList.length) {
      return cb(null, filtered);
    }

    // check permission - get subnets that the user has read permission to
    csgrant.isAuthorized(req.user.username, subnetList[s].id, true,
        (err, authorized) => {
      if (err) {
        return cb(err, filtered);
      }

      if (authorized) {
        filtered.push(subnetList[s]);
      }

      s++;
      filterSubnets(s, subnetList, cb);
    });
  }

  var filter = {};

  // Get all subnets
  Subnet.find(filter).sort()
    .exec(function(err, subnets) {
      if (err) {
        var error = {error: {
          msg: 'Error finding subnets'
        }};
        res.jsonp(error);
        return;
      }

      // filter based on user permission
      filterSubnets(0, subnets, function(err, f) {
        if (err) {
          var error = {error: {
            msg: 'Error filtering subnets'
          }};
          res.jsonp(error);
          return;
        }
        res.jsonp(f);

      });
  });
};
