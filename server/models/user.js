'use strict';

/// Module dependencies.
var mongoose = require('mongoose'),
  Schema = mongoose.Schema;

/// Identities Schema
var IdentitiesSchema = new Schema({
  /// Identities
  identities: {
    type: Array,
    unique: true
  }
});

IdentitiesSchema.path('identities').validate(function(identities) {
  return (typeof identities === 'array' && identities.length > 0);
}, 'Identitiesname cannot be blank');

/////////////////////////////////////////////////
// Statics
IdentitiesSchema.statics.loadByIdentitiesname = function(identities, cb) {
  this.findOne({
    identities: identities
  }).exec(cb);
};

mongoose.model('Identities', IdentitiesSchema);
