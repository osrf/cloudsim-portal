'use strict';

/// Module dependencies.
var mongoose = require('mongoose'),
  Schema = mongoose.Schema;

/// User Schema
var UserSchema = new Schema({
  /// User's username.
  username: {
    type: String,
    unique: true
  }
});

UserSchema.path('username').validate(function(username) {
  return (typeof username === 'string' && username.length > 0);
}, 'Username cannot be blank');

/////////////////////////////////////////////////
// Statics
UserSchema.statics.loadByUsername = function(username, cb) {
  this.findOne({
    username: username
  }).exec(cb);
};

mongoose.model('User', UserSchema);
