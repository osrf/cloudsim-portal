'use strict';
/// @module users_controller
/// Server side users controller


/// Module dependencies.
var mongoose = require('mongoose'),
    Identities = mongoose.model('Identities');


/////////////////////////////////////////////////
/// Find user by id
/// @param[in] req Nodejs request object.
/// @param[out] res Nodejs response object.
/// @param[in] next The next Nodejs function to be executed.
/// @param[in] id The id of the user to retrieve.
exports.user = function(req, res, next, username) {
  // Use mongoose's findOne function to get a user based on the id value
  Identities.findOne({
      username: username
  })
  // The function to execute when the user is found.
  .exec(function(err, user) {
    if (err) return next(err);
    if (!user) return next(new Error('Failed to load Identities ' + id));

    req.profile = user;
    next();
  });
};

/////////////////////////////////////////////////
/// Show all users
/// @param[in] req Nodejs request object.
/// @param[out] res Nodejs response object.
exports.all = function(req, res) {
  if (!req.username) {
    res.status(500).send('Invalid permissions.');
    return;
  }

  // Get all the Identitiess
  Identities.find().exec(function(err, users) {
    if (err) {
      res.render('error', {status: 500});
    } else {
      res.jsonp(users);
    }
  });
};

/////////////////////////////////////////////////
/// Update a user
/// @param[in] req Nodejs request object.
/// @param[out] res Nodejs response object.
/// @return Function to create a user.
exports.update = function(req, res) {

  var user = req.profile;

  // Find the user.
  Identities.findOne({id: user.id}).exec(function(err, usr) {
    if (err) {
      res.jsonp({ error: {message: 'Unable to find user info' }});
    }
    else
    {
      // do some updates


      // Save the user to the database
      Identities.save(function(err) {
        if (err) {
          return res.jsonp({error: {
              message: 'Unable to update user'
             }
          });
        } else {
          return res.jsonp(usr);
        }
      });
    }
  });
};


/////////////////////////////////////////////////
/// Remove user
/// @param[in] req Nodejs request object.
/// @param[out] res Nodejs response object.
/// @return Function to create a user.
exports.remove = function(req, res) {
  var user = req.profile;

  // Find the user.
  var usr = Identities.findOne({id: user.id});

  usr.remove(function(err) {
    if (err) {
      res.jsonp({ error: {
        message: 'Unable to delete user'
      }});
    }
    else {
      res.jsonp(user);
    }
  });
};

/////////////////////////////////////////////////
/// Create user
/// @param[in] req Nodejs request object.
/// @param[out] res Nodejs response object.
/// @return Function to create a user.
exports.create = function(req, res) {
  var message = null;

  // Make sure the requesting user is authenticated.
  // todo: Add in check for admin privelages.
  if (!req.username)
  {
    var err = {error: {
      message: 'Only administrators can add users',
      user: 'n/a'
    }};
    return res.jsonp(err);
  }

  // Make sure the requesting user is in the database.
  // TODO: We need to implement user privileges.
  Identities.findOne({username: req.username}, function(err) {
    if (!err) {
      // Create a new user based on the value in the request object
      var user = new Identities(req.body);

      // Save the user to the database
      user.save(function(err) {
        if (err) {
          switch (err.code) {
            case 11000:
            case 11001:
              message = 'Identitiesname already exists';
              break;
            default:
              message = 'Please fill all the required fields';
          }

          return res.jsonp({error: {
            message: message,
            user: user
          }
          });
        }
        else {
        // Send back the user
        // (expected by angularjs on success).
        return res.jsonp(user);
        }
      });
    }
    else {
      return res.jsonp({error: {
        message: 'Only administrators can add users',
        user: 'n/a'
      }});
    }
  });
};

/*/////////////////////////////////////////////////
/// Send Identities
/// @param[in] req Nodejs request object.
/// @param[out] res Nodejs response object.
exports.me = function(req, res) {
  res.jsonp(req.user || null);
};*/
