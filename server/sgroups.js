'use strict';

/// Module dependencies.
var csgrant = require('cloudsim-grant');
const common = require('./common')

// initialise cloudServices, depending on the environment
var cloudServices = null;
if (process.env.AWS_ACCESS_KEY_ID && process.env.NODE_ENV !== 'test') {
  cloudServices = require('./cloud_services.js');
} else {
  cloudServices = require('./fake_cloud_services.js');
}

const awsData = {region: 'us-west-1'};

/////////////////////////////////////////////////
/// Create a security group
/// @param req Nodejs request object.
/// @param res Nodejs response object.
/// @return Security group create function.
const create = function(req, res) {
  var error;
  if (!cloudServices) {
    // Create an error
    error = {
      success: false,
      error: 'Cloud services are not available'
    };
    console.log(error.error)
    res.jsonp(error);
    return;
  }

  const sgroupName = req.body.resource;

  if (!sgroupName)
  {
    error = {
      success: false,
      error: 'Missing required fields (resource)'
    }
    console.log(error.error)
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
          function (ruleErr) {

            if (ruleErr) {
              res.status(500).jsonp(ruleErr);
              return;
            }

            // add the resource to csgrant
            csgrant.createResource(req.user, resourceName,
              {name: sgroupName,
                groupId: result.GroupId,
                rules: [{type:'inbound', sourceGroupName: sgroupName}]},
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
const destroy = function(req, res) {

  if (!cloudServices) {
    // Create an error
    const error = {
      success: false,
      error: 'Cloud services are not available'
    };
    console.log(error.error)
    res.status(500).jsonp(error);
    return;
  }

  const sgroupName = req.sgroup;

  if (!sgroupName)
  {
    var error = {
      success: false,
      error: 'Missing required fields (resource)'
    }
    console.log(error.error)
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
      res.status(500).jsonp(err);
    }

    // finally remove the security group
    const info = {groupId:data.data.groupId, region:awsData.region};
    cloudServices.deleteSecurityGroup(info, function(err) {
      if (err) {
        res.status(500).jsonp(err);
        return;
      }

      csgrant.deleteResource(req.user, sgroupName, (err) => {
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

/////////////////////////////////////////////////
/// Update a security group's rules.
/// @param req Nodejs request object.
/// @param res Nodejs response object.
/// @return Update sgroup function
const update = function(req, res) {

  if (!cloudServices) {
    // Create an error
    const error = {
      success: false,
      error: 'Cloud services are not available'
    };
    console.log(error.error)
    res.status(500).jsonp(error);
    return;
  }

  const sgroupName = req.sgroup;
  const newData = req.body;

  if (!sgroupName || !newData) {
    var error = {
      success: false,
      error: 'Missing required fields'
    }
    console.log(error.error)
    res.status(500).jsonp(error);
    return;
  }

  // read the resource to get the aws security group id
  csgrant.readResource(req.user, sgroupName, function(err, oldData) {
    if (err) {
      res.status(500).jsonp(err);
      return;
    }

    if (!oldData.data.groupId) {
      var error = {
        success: false,
        error: 'Invalid security group id'
      }
      res.status(500).jsonp(error);
    }


    // update traffic rules
    if (!newData.rules || newData.rules.length <= 0) {
      return res.jsonp({success: false,
        error: 'Only rules can be updated for now'})
    }

    const oldRules = JSON.parse(JSON.stringify(oldData.data.rules))

    // function for adding new rules
    // the function assumes all rules are inbound for now (rule.type == inbound)
    // TODO support outbound rules
    const addNewRules = function(index, rules, cb) {
      if (index == rules.length) {
        return cb(null, rules);
      }

      // check if rule exists or not, if not then add a new rule
      const rule = newData.rules[index];
      const idx = oldRules.map(
        function(e){return e.sourceGroupName}).indexOf(rule.sourceGroupName);
      if (idx < 0) {
        // rule does not exist - add new one.
        const ruleInfo = {groupId: oldData.data.groupId,
          sourceGroupName: rule.sourceGroupName,
          region: awsData.region};
        cloudServices.addSecurityGroupInboundRule(ruleInfo,
          function (ruleErr) {

            if (ruleErr) {
              return cb(ruleErr, null);
            }
            addNewRules(++index, rules, cb);
          })
      }
      else {
        // rule exists, remove it from the array
        oldRules.splice(idx, 1);
        addNewRules(++index, rules, cb);
      }
    }

    // function for removing any remaining rules in old data
    const removeOldRules = function(index, rules, cb) {
      if (index == rules.length) {
        return cb(null, rules);
      }

      const rule = rules[index];
      const ruleInfo = {groupId: oldData.data.groupId,
        sourceGroupName: rule.sourceGroupName,
        region: awsData.region};
      cloudServices.deleteSecurityGroupInboundRule(ruleInfo,
        function (ruleErr) {
          if (ruleErr) {
            return cb(ruleErr, null);
          }
          removeOldRules(++index, rules, cb);
        })
    }

    // update rules by chaining the add / remove rule functions
    addNewRules(0, newData.rules, function(addRuleErr) {
      if (addRuleErr) {
        res.status(500).jsonp(addRuleErr);
        return;
      }
      removeOldRules(0, oldRules, function(removeRuleErr) {
        if (removeRuleErr) {
          res.status(500).jsonp(removeRuleErr);
          return;
        }

        // update csgrant
        let futureData = oldData.data;
        futureData.rules = newData.rules
        csgrant.updateResource(req.user, sgroupName, futureData,
          (err, data) => {
            if(err) {
              return res.jsonp({success: false, error: err})
            }
            const r = {success: true, result: data};
            res.jsonp(r)
          })
      })
    })

  });
}

exports.setRoutes = function(app) {

  /// Create a new security group
  app.post('/sgroups',
              csgrant.authenticate,
              csgrant.ownsResource('sgroups', false),
              create);

  /// Get a list of security groups
  app.get('/sgroups',
             csgrant.authenticate,
             csgrant.userResources,
             common.filterResources('sgroup-'),
             csgrant.allResources)

  /// Delete a security group
  app.delete('/sgroups/:sgroup',
                csgrant.authenticate,
                csgrant.ownsResource(':sgroup', false),
                destroy);


  /// Update security group rules
  app.put('/sgroups/:sgroup',
             csgrant.authenticate,
             csgrant.ownsResource(':sgroup', false),
             update)

  // sgroup route parameter
  app.param('sgroup', function(req, res, next, id) {
    req.sgroup = id
    next()
  })
}
