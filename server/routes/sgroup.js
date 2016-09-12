'use strict';

const csgrant = require('cloudsim-grant')
var SecurityGroup = require('../controllers/sgroup');


module.exports = function(router) {

  /// Create a new security group
  router.post('/sgroups',
              csgrant.authenticate,
              csgrant.ownsResource('sgroup', false),
              SecurityGroup.create);

  /// Get a list of security groups
  router.get('/sgroups',
             csgrant.authenticate,
             csgrant.userResources,
             function (req, res, next) {
               // we're going to filter out the non
               // groups types before the next middleware.
               req.allResources = req.userResources
               req.userResources = req.allResources.filter( (obj)=>{
                 if(obj.name.indexOf('sgroup-') == 0)
                   return true
                 return false
               })
               next()
             },
             csgrant.allResources)


  /// delete a security group
  router.delete('/sgroups',
                csgrant.authenticate,
                function (req, res, next) {
                  // put the group name in req.group
                  req.sgroup = req.body.resource
                  next()
                },
                csgrant.ownsResource(':sgroup', false),
                SecurityGroup.destroy);


  /// delete a security group
  router.delete('/sgroups/:sgroup',
                csgrant.authenticate,
                csgrant.ownsResource(':sgroup', false),
                SecurityGroup.destroy);


  /// Update security group rules
  router.put('/sgroups/:sgroup',
             csgrant.authenticate,
             csgrant.ownsResource(':sgroup', false),
             SecurityGroup.update)

  // sgroup route parameter
  router.param('sgroup', function(req, res, next, id) {
    req.sgroup = id
    next()
  })
}
