'use strict';

// @module simulation_model
// The schema, validation, and static functions for a simulation model.

// Module dependencies.
const mongoose = require('mongoose')
const Schema = mongoose.Schema

// Simulation Schema

var SimulationSchema = new Schema({
  // unique id
  id: {
    type: String, // string
    default: ''
  },

  // The date and time on which the simulation was started
  start_date: {
    type: Date,
    default: null
  },

  // The date and time on which the simulation instance was terminated
  end_date: {
    type: Date,
    default: null
  },

  // scenario of the simulation run, e.g. walking, running, grasping
  scenario: {
    type: String,
    default: ''
  },

  // task name - an instance of scenario, e.g. walking01, running04, etc
  task: {
    type: String,
    default: ''
  },

  // Current state of the simulation instance
  status: {
    type: String,
    default: 'RUNNING'
  },

  // Simulator id that the simulation belongs to
  simulator: {
    type: Schema.ObjectId,
    ref: 'Simulator'
  },

  // The owner who launched the simulation.
  // The user who launched the simulator instance.
  owner: {
    type: String
  },

  // The owner who launched the simulation.
  users : [{
    username: String,
  }]
});

//
//  Validations
//
SimulationSchema.path('start_date').validate(function(s) {
  return s !== null;
}, 'Launch date must be set');

SimulationSchema.path('id').validate(function(s) {
  return s != null;
}, 'id must be set.');

SimulationSchema.path('scenario').validate(function(s) {
  return s.length;
}, 'Scenario cannot be blank');

SimulationSchema.path('task').validate(function(s) {
  return s.length;
}, 'Task cannot be blank');

SimulationSchema.path('status').validate(function(s) {
  return ['RUNNING', 'STOPPED', 'PENDING', 'ERROR'].indexOf(s) > -1 ;
}, 'Status of the simulation must be valid');

SimulationSchema.path('owner').validate(function(s) {
  return s !== null;
}, 'User must be set.');

SimulationSchema.path('simulator').validate(function(s) {
  return s !== null;
}, 'Simulator must be set.');

/////////////////////////////////////////////////
// Statics
SimulationSchema.statics.load = function(id, cb) {
  this.findOne({
    id: id
  }).populate('owner').populate('simulator').exec(cb);
};

mongoose.model('Simulation', SimulationSchema);
