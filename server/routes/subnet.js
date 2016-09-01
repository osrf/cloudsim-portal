'use strict';

const csgrant = require('cloudsim-grant')
var Subnets = require('../controllers/subnet');

var mongoose = require('mongoose');
var User = mongoose.model('User');
var Subnet = mongoose.model('Subnet');

// Simulation authorization helpers
var authenticateUser = function(req, res, next) {
  var userID = req.username;
  // console.log('sim authenticate user: ' + userID);

  if (!userID)
    return res.status(401).send('User is not found');

  User.loadByUsername(userID, function(err, user) {
    if (err)
      return next(err);
    if (!user) {
      var newUser = new User({username: userID});
      newUser.save(function() {
        req.user = newUser;
        next();
      });
    }
    else {
      req.user = user;
      next();
    }
  });
};

module.exports = function(router) {

  /// GET /simulators/:simulationId
  /// Create a new subnet
  router.post('/subnets',
             authenticateUser,
             Subnets.create);

  /// GET /subnets
  /// Get a list of subnets
  router.get('/subnets',
             authenticateUser,
             Subnets.all);

  /// DEL /subnets
  /// delete a subnet
  router.delete('/subnets',
                authenticateUser,
                Subnets.destroy);
}
