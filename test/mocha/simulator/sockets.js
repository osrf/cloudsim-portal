'use strict';

console.log('test/mocha/simulator/sockets.js');

require('../../../server/server.js')

var adminUser = 'admin';
if (process.env.CLOUDSIM_ADMIN)
  adminUser = process.env.CLOUDSIM_ADMIN;

/// Module dependencies.
var mongoose = require('mongoose'),
    User = mongoose.model('User'),
    Simulator = mongoose.model('Simulator'),
    app = require('../../../server/server')

var util = require('util');
var should = require('should');
var supertest = require('supertest');

// we need fresh keys for this test
const csgrant = require('cloudsim-grant')

var user;
var user2;
var agent;

// socket io client
var io = require('socket.io-client');
const port = process.env.PORT || 4000
const socketAddress = 'http://localhost:' + port;

const launchData = {
                     region: 'us-west-1',
                     hardware:'t2.small',
                     machineImage: 'bozo'
                   }

describe('<Unit Test>', function() {
  describe('Simulator Sockets:', function() {
    before(function(done) {
      User.remove({}, function(err){
        if (err){
          should.fail(err);
        }
        user = new User({
          username: adminUser
        });

        user.save(function() {
          agent = supertest.agent(app);

          // clear the simulator collection before the tests
          Simulator.remove({}, function(err){
            if (err){
            should.fail(err);
            }
            done();
          });
        });
      });
    });

    // check initial condition - no simulators running
    describe('Check Empty Running Simulator', function() {
      it('should be no running simulators at the beginning',
          function(done) {
        agent
        .get('/simulators')
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          JSON.parse(res.text).length.should.be.exactly(0);
          done();
        });
      });
    });

    describe('Check Socket Connection', function() {
      it('should be able to connect via websockets', function(done) {
        var client = io.connect(socketAddress, {query: 'token=' + adminUser,
            transports: ['websocket'], rejectUnauthorized: false});
        client.on('connect', function(socket) {
          done();
        });

        client.on('connect_error',  function(err){
          console.log('connect error ' + util.inspect(err));
          should.fail('should have no connection errors');
        });
      });
    });

    // launch simulator and wait for launch event
    var simId1 ='';
    describe('Check Simulator Launch event', function() {
      it('should be able to receive simulator launch event',
          function(done) {

        // create socket io client
        var client = io.connect(socketAddress, {query: 'token=' + adminUser,
            transports: ['websocket'], rejectUnauthorized: false});

        // check launch event
        client.on('simulator_launch', function(simulator) {
          simulator.id.should.not.be.empty();
          simId1 = simulator.id;
          simulator.status.should.equal('LAUNCHING');
          simulator.region.should.equal('us-west-1');
          client.disconnect();
          done();
        });

        client.on('connect_error',  function(){
          should.fail('should have no connection errors');
        });

        client.on('connect', function(socket) {
          // post to simulators to launch
          agent
          .post('/simulators')
          .set('Accept', 'application/json')
          .send(launchData)
          .end(function(err,res){
            should.not.exist(err);
            should.exist(res);
            res.status.should.be.equal(200);
            res.redirect.should.equal(false);
          });
        });
      });
    });

    // verify simulator status events for one client and one simulator
    describe('Check Simulator Status event', function() {
      it('should be able to receive simulator status events',
          function(done) {

        // create socket io client
        var client = io.connect(socketAddress, {query: 'token=' + adminUser,
            transports: ['websocket'], rejectUnauthorized: false});

        // check status event
        client.on('simulator_status', function(simulator) {
          simulator.id.should.equal(simId1);
          simulator.status.should.equal('LAUNCHING');
          simulator.region.should.equal('us-west-1');
          client.disconnect();
          done();
        });

        client.on('connect_error',  function(){
          should.fail('should have no connection errors');
        });

      });
    });

    // verify simulator status events for multiple clients
    var simId1 ='';
    describe('Check Simulator Status event for Two Clients', function() {
      it('should be able to receive simulator status events in two sockets',
          function(done) {

        // create socket io clients with same username
        var client = io.connect(socketAddress, {query: 'token=' + adminUser,
            transports: ['websocket'], rejectUnauthorized: false});
        var client2 = io.connect(socketAddress, {query: 'token=' + adminUser,
            transports: ['websocket'], rejectUnauthorized: false});

        var counter = 0;
        var counter2 = 0;

        var checkDone = function() {
          if (counter > 5 && counter2 > 5) {
            client.disconnect();
            client2.disconnect();
            done();
          }
        }

        // check status event
        client.on('simulator_status', function(simulator) {
          simulator.id.should.equal(simId1);
          simulator.status.should.equal('LAUNCHING');
          simulator.region.should.equal('us-west-1');
          counter++;
          checkDone();
        });
        client2.on('simulator_status', function(simulator) {
          simulator.id.should.equal(simId1);
          simulator.status.should.equal('LAUNCHING');
          simulator.region.should.equal('us-west-1');
          counter2++;
          checkDone();
        });

        client.on('connect_error',  function(){
          should.fail('should have no connection errors');
        });
        client2.on('connect_error',  function(){
          should.fail('should have no connection errors');
        });

      });
    });

    // verify simulator status events for client without any permissions
    describe('Check Client Simulator Status event with No Permission',
        function() {
      it('should not receive simulator status events without permission',
          function(done) {

        // create socket io client
        var adminClient = io.connect(socketAddress, {query: 'token=' + adminUser,
            transports: ['websocket'], rejectUnauthorized: false});
        var user2Client = io.connect(socketAddress, {query: 'token=user2',
            transports: ['websocket'], rejectUnauthorized: false});

        // check status event
        var counter = 0;
        adminClient.on('simulator_status', function(simulator) {
          simulator.id.should.equal(simId1);
          simulator.status.should.equal('LAUNCHING');
          simulator.region.should.equal('us-west-1');
          // wait for five updates
          if (++counter === 5) {
            adminClient.disconnect();
            user2Client.disconnect();
            done();
          }
        });

        // user2 does not have read permission to simId1 so should not get
        // status updates
        user2Client.on('simulator_status', function(simulator) {
          should.fail('user1 should not get status updates');
        });

        adminClient.on('connect_error',  function(){
          should.fail('should have no connection errors');
        });
        user2Client.on('connect_error',  function(){
          should.fail('should have no connection errors');
        });

      });
    });

    // verify simulator status events for client with read permission
    describe('Check Client Simulator Status event with Read Permission',
        function() {
      it('should receive simulator status events with read permission',
          function(done) {

        // create socket io client
        var adminClient = io.connect(socketAddress, {query: 'token=' + adminUser,
            transports: ['websocket'], rejectUnauthorized: false});
        // user will be granted read access
        var user2Client = io.connect(socketAddress, {query: 'token=user2',
            transports: ['websocket'], rejectUnauthorized: false});

        var counter = 0;
        var counter2 = 0;

        var checkDone = function() {
          if (counter > 5 && counter2 > 5) {
            adminClient.disconnect();
            user2Client.disconnect();
            done();
          }
        }

        // check status event
        adminClient.on('simulator_status', function(simulator) {
          simulator.id.should.equal(simId1);
          simulator.status.should.equal('LAUNCHING');
          simulator.region.should.equal('us-west-1');
          counter++;
          checkDone();
        });

        // user2 has read permission to simId1 so should get status updates
        user2Client.on('simulator_status', function(simulator) {
          simulator.id.should.equal(simId1);
          simulator.status.should.equal('LAUNCHING');
          simulator.region.should.equal('us-west-1');
          counter2++;
          checkDone();
        });

        adminClient.on('connect_error',  function(){
          should.fail('should have no connection errors');
        });
        user2Client.on('connect_error',  function(){
          should.fail('should have no connection errors');
        });

        // make sure both clients are ready before posting to grant permission
        adminClient.on('connect', function(socket) {
          user2Client.on('connect', function(socket) {
            agent
            .post('/permissions')
            .set('Accept', 'application/json')
            .send({resource: simId1, grantee: 'user2', readOnly: true})
            .end(function(err,res){
              res.status.should.be.equal(200);
              res.redirect.should.equal(false);
              var text = JSON.parse(res.text);
              text.success.should.equal(true);
              text.resource.should.equal(simId1);
              text.grantee.should.equal('user2');
              text.readOnly.should.equal(true);
            });
          });
        });

      });
    });

    // verify simulator status events for client with write permission
    describe('Check Client Simulator Status event with Write Permission',
        function() {
      it('should receive simulator status events with Write permission',
          function(done) {

        // create socket io clients
        var adminClient = io.connect(socketAddress, {query: 'token=' + adminUser,
            transports: ['websocket'], rejectUnauthorized: false});
        var user2Client = io.connect(socketAddress, {query: 'token=user2',
            transports: ['websocket'], rejectUnauthorized: false});
        var user3Client = io.connect(socketAddress, {query: 'token=user3',
            transports: ['websocket'], rejectUnauthorized: false});

        var counter = 0;
        var counter2 = 0;
        var counter3 = 0;

        var checkDone = function() {
          if (counter > 5 && counter2 > 5 && counter3 > 5) {
            adminClient.disconnect();
            user2Client.disconnect();
            user3Client.disconnect();
            done();
          }
        }

        // check status event
        adminClient.on('simulator_status', function(simulator) {
          simulator.id.should.equal(simId1);
          simulator.status.should.equal('LAUNCHING');
          simulator.region.should.equal('us-west-1');
          counter++;
          checkDone();
        });

        // user2 has read permission to simId1 so should get status updates
        user2Client.on('simulator_status', function(simulator) {
          simulator.id.should.equal(simId1);
          simulator.status.should.equal('LAUNCHING');
          simulator.region.should.equal('us-west-1');
          counter2++;
          checkDone();
        });

        // user3 has write permission to simId1 so should get status updates
        user3Client.on('simulator_status', function(simulator) {
          simulator.id.should.equal(simId1);
          simulator.status.should.equal('LAUNCHING');
          simulator.region.should.equal('us-west-1');
          counter3++;
          checkDone();
        });

        adminClient.on('connect_error',  function(){
          should.fail('should have no connection errors');
        });
        user2Client.on('connect_error',  function(){
          should.fail('should have no connection errors');
        });
        user3Client.on('connect_error',  function(){
          should.fail('should have no connection errors');
        });

        // make sure all clients are ready before posting to grant permission
        adminClient.on('connect', function(socket) {
          user2Client.on('connect', function(socket) {
            user3Client.on('connect', function(socket) {
              agent
              .post('/permissions')
              .set('Accept', 'application/json')
              .send({resource: simId1, grantee: 'user3', readOnly: false})
              .end(function(err,res){
                res.status.should.be.equal(200);
                res.redirect.should.equal(false);
                var text = JSON.parse(res.text);
                text.success.should.equal(true);
                text.resource.should.equal(simId1);
                text.grantee.should.equal('user3');
                text.readOnly.should.equal(false);
              });
            });
          });
        });

      });
    });

    // verify simulator status events for client with revoked permission
    describe('Check Client Simulator Status event when Permission is Revoked',
        function() {
      it('should not receive simulator status events with permission revoked',
          function(done) {

        // create socket io clients
        var adminClient = io.connect(socketAddress, {query: 'token=' + adminUser,
            transports: ['websocket'], rejectUnauthorized: false});
        var user2Client = io.connect(socketAddress, {query: 'token=user2',
            transports: ['websocket'], rejectUnauthorized: false});
        var user3Client = io.connect(socketAddress, {query: 'token=user3',
            transports: ['websocket'], rejectUnauthorized: false});

        var counter = 0;
        var counter2 = 0;

        var checkDone = function() {
          if (counter > 5 && counter2 > 5) {
            adminClient.disconnect();
            user2Client.disconnect();
            user3Client.disconnect();
            done();
          }
        }

        // check status event
        adminClient.on('simulator_status', function(simulator) {
          simulator.id.should.equal(simId1);
          simulator.status.should.equal('LAUNCHING');
          simulator.region.should.equal('us-west-1');
          counter++;
          checkDone();
        });

        // user2 has read permission to simId1 so should get status updates
        user2Client.on('simulator_status', function(simulator) {
          simulator.id.should.equal(simId1);
          simulator.status.should.equal('LAUNCHING');
          simulator.region.should.equal('us-west-1');
          counter2++;
          checkDone();
        });

        var revoked = false;
        // user3 has write permission to simId1 so should get status updates
        // until the permission is revoked.
        user3Client.on('simulator_status', function(simulator) {
          if (revoked)
            should.fail('should not receive status updates');
        });

        adminClient.on('connect_error',  function(){
          should.fail('should have no connection errors');
        });
        user2Client.on('connect_error',  function(){
          should.fail('should have no connection errors');
        });
        user3Client.on('connect_error',  function(){
          should.fail('should have no connection errors');
        });

        // make sure all clients are ready before posting to revoke permission
        adminClient.on('connect', function(socket) {
          user2Client.on('connect', function(socket) {
            user3Client.on('connect', function(socket) {
              agent
              .delete('/permissions')
              .set('Accept', 'application/json')
              .send({resource: simId1, grantee: 'user3', readOnly: false})
              .end(function(err,res){
                res.status.should.be.equal(200);
                res.redirect.should.equal(false);
                var text = JSON.parse(res.text);
                text.success.should.equal(true);
                text.resource.should.equal(simId1);
                text.grantee.should.equal('user3');
                text.readOnly.should.equal(false);
                revoked = true;
              });
            });
          });
        });
      });
    });

    // check clients receive the correct events when there is more than one
    // simulator
    var simId2 ='';
    describe('Check Multiple Simulators and Multiple Clients', function() {
      it('should be able to receive simulator launch and status events',
          function(done) {

        // create socket io client
        var adminClient = io.connect(socketAddress, {query: 'token=' + adminUser,
            transports: ['websocket'], rejectUnauthorized: false});
        var user2Client = io.connect(socketAddress, {query: 'token=user2',
            transports: ['websocket'], rejectUnauthorized: false});

        var adminSim2Launch = false;
        var adminSim1Counter = 0;
        var adminSim2Counter = 0;
        var user2Sim1Counter = 0;

        // admin should receive launch event for simId2 and status events for
        // simId1 and simId2
        // user2 should not receive launch event for simId2 and only receive
        // status events for simId1
        var checkDone = function() {
          if (adminSim2Launch && adminSim1Counter > 5 && adminSim2Counter > 5
              && user2Sim1Counter > 5) {
            adminClient.disconnect();
            user2Client.disconnect();
            done();
          }
        }

        // check launch event for admin user
        adminClient.on('simulator_launch', function(simulator) {
          simulator.id.should.not.be.empty();
          simId2 = simulator.id;
          simulator.status.should.equal('LAUNCHING');
          simulator.region.should.equal('us-west-1');
          adminSim2Launch = true;
        });

        // user2 should not get any events about the new simulator
        user2Client.on('simulator_launch', function(simulator) {
          should.fail('should not receive a launch event without permission');
        });

        // check status event
        adminClient.on('simulator_status', function(simulator) {
          if (simulator.id === simId1)
            adminSim1Counter++;
          else if (simulator.id === simId2)
            adminSim2Counter++;
          checkDone();
        });

        // user2 has read permission to simId1 so should get status updates
        user2Client.on('simulator_status', function(simulator) {
          simulator.id.should.equal(simId1);
          simulator.status.should.equal('LAUNCHING');
          simulator.region.should.equal('us-west-1');
          user2Sim1Counter++;
          checkDone();
        });

        adminClient.on('connect_error',  function(){
          should.fail('should have no connection errors');
        });
        user2Client.on('connect_error',  function(){
          should.fail('should have no connection errors');
        });

        // post to simulators to launch
        adminClient.on('connect', function(socket) {
          user2Client.on('connect', function(socket) {
            agent
            .post('/simulators')
            .set('Accept', 'application/json')
            .send(launchData)
            .end(function(err,res){
              should.not.exist(err);
              should.exist(res);
              res.status.should.be.equal(200);
              res.redirect.should.equal(false);
            });
          });
        });
      });
    });

    // terminate simulator and wait for terminate event
    describe('Check Simulator Terminate event', function() {
      it('should be able to receive simulator terminate event',
          function(done) {

        // create socket io client
        var adminClient = io.connect(socketAddress, {query: 'token=' + adminUser,
            transports: ['websocket'], rejectUnauthorized: false});
        var user2Client = io.connect(socketAddress, {query: 'token=user2',
            transports: ['websocket'], rejectUnauthorized: false});

        var adminEvent =false;
        var user2Event =false;
        var adminTerminated = false;
        var user2Terminated = false;

        var checkDone = function() {
          if (adminEvent && user2Event && adminTerminated && user2Terminated) {
            adminClient.disconnect();
            user2Client.disconnect();
            done();
          }
        }
        // check terminate event
        adminClient.on('simulator_terminate', function(simulator) {
          simulator.id.should.equal(simId1);
          simulator.status.should.equal('TERMINATING');
          simulator.region.should.equal('us-west-1');
          adminEvent = true;
          checkDone()
        });
        user2Client.on('simulator_terminate', function(simulator) {
          simulator.id.should.equal(simId1);
          simulator.status.should.equal('TERMINATING');
          simulator.region.should.equal('us-west-1');
          user2Event = true;
          checkDone()
        });

        // check status event and wait for status to change from TERMINATING
        // to TERMINATED
        adminClient.on('simulator_status', function(simulator) {
          if (simulator.id == simId1 && simulator.status === 'TERMINATED') {
            adminTerminated = true;
            checkDone();
          }
        });
        user2Client.on('simulator_status', function(simulator) {
          if (simulator.id == simId1 && simulator.status === 'TERMINATED') {
            user2Terminated = true;
            checkDone();
          }
        });

        adminClient.on('connect_error',  function(){
          should.fail('should have no connection errors');
        });
        user2Client.on('connect_error',  function(){
          should.fail('should have no connection errors');
        });

        // make sure both clients are ready before posting to terminate
        // simulator
        adminClient.on('connect', function(socket) {
          user2Client.on('connect', function(socket) {
            // post to terminate simulator
            agent
            .delete('/simulators/' + simId1)
            .set('Accept', 'application/json')
            .end(function(err,res){
              res.status.should.be.equal(200);
              res.redirect.should.equal(false);
            });
          });
        });

      });
    });

    after(function(done) {
      User.remove().exec();
      Simulator.remove().exec();
      csgrant.model.clearDb();
      done();
    });
  });
});
