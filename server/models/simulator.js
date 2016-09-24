'use strict';

// @module simulator_model
// The schema, validation, and static functions for a simulator model.

// Module dependencies.
var mongoose = require('mongoose'),
    Schema = mongoose.Schema;


// Simulator Schema

var SimulatorSchema = new Schema({

    // unique id
    id: {
        type: String, // string
        default: ''
    },

    // The region in which the simulator instance was run
    region: {
        type: String,
        default: ''
    },

    // security group
    sgroup: {
        type: String
    },

    // a cloud provider machine id (necessary for termination)
    // for AWS, this is the "instance id"
    machine_id: {
        type: String
    },

    // ip address of the machine
    machine_ip: {
        type: String
    },

    // Current state of the simulator instance
    status: {
        type: String,
        default: 'LAUNCHING'
    },

    // The date and time on which the simulator instance was started
    launch_date: {
        type: Date,
        default: null
    },

    // The date and time on which the simulator instance was terminated
    termination_date: {
        type: Date,
        default: null
    },

    // The user who launched the simulator instance.
    owner: {
        type: Schema.ObjectId,
        ref: 'Identities'
    },

    users : [{
      username: String,
      readOnly: Boolean
    }]
});

//
//  Validations
//
SimulatorSchema.path('launch_date').validate(function(s) {
    return s !== null;
}, 'Launch date must be set');

SimulatorSchema.path('id').validate(function(s) {
    return s != null;
}, 'Simulator id must be set.');

SimulatorSchema.path('region').validate(function(s) {
    return s.length;
}, 'Region cannot be blank');

SimulatorSchema.path('status').validate(function(s) {
    return ['LAUNCHING', 'IDLE', 'RUNNING', 'TERMINATING', 'TERMINATED', 'Error'].indexOf(s) > -1 ;
}, 'State of the simulator instance must be valid');

SimulatorSchema.path('owner').validate(function(s) {
    return s !== null;
}, 'Owner must be set.');

/////////////////////////////////////////////////
// Statics
SimulatorSchema.statics.load = function(id, cb) {
    this.findOne({
        id: id
    }).populate('owner', 'username').exec(cb);
};

SimulatorSchema.statics.getRunningSimulators = function(cb) {
    this.find({
        $where: 'this.status != "TERMINATED"'
    }).populate('owner', 'username').exec(function (err, sims) {
        cb(err, sims);
    });
};


mongoose.model('Simulator', SimulatorSchema);
