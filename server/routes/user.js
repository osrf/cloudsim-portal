'use strict';

// User routes use users controller
var users = require('../controllers/user');

module.exports = function(router) {

//    router.get('/users/me', users.me);

    /// POST /users
    /// Create a new user
    router.post('/users', users.create);

    /// DEL /users
    /// Delete a user
    router.delete('/users/:userId', users.remove);

    /// PUT /users
    /// Update a user
    router.put('/users/:userId', users.update);

    /// Get all the users
    /// This route should only return data if the user is logged in, and
    /// is and administrator.
    router.get('/users', users.all);

    // Setting up the userId param
    router.param('userId', users.user);
};
