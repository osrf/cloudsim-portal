'use strict';

// @module Subnet_model
// The schema, validation, and static functions for a Subnet model.

// Module dependencies.
var mongoose = require('mongoose'),
    Schema = mongoose.Schema;


// Subnet Schema

var SubnetSchema = new Schema({

    // unique id
    id: {
        type: String, // string
        default: ''
    },

    subnet_id: {
        type: String,
        default: ''
    },

    vpc_id: {
        type: String
    }
});

//
//  Validations
//

SubnetSchema.path('id').validate(function(s) {
    return s != null;
}, 'Subnet id must be set.');

/////////////////////////////////////////////////
// Statics
SubnetSchema.statics.load = function(id, cb) {
    this.findOne({
        id: id
    }).populate('subnet_id', 'vpc_id').exec(cb);
};

mongoose.model('Subnet', SubnetSchema);
