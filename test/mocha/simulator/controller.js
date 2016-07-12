'use strict';

console.log('test/mocha/simulator/controller.js');

require('../../../server/server.js')


/// Module dependencies.
var mongoose = require('mongoose'),
    User = mongoose.model('User'),
    Simulator = mongoose.model('Simulator'),
    app = require('../../../server/server')

var util = require('util');
var should = require('should');
var supertest = require('supertest');

var user;
var user2;
var agent;

const launchData = {
                     region: 'us-west-1',
                     hardware:'t2.small',
                     machineImage: 'bozo'
                   }

describe('<Unit Test>', function() {
  describe('Simulator Controller:', function() {
    before(function(done) {
      User.remove({}, function(err){
        if (err){
          should.fail(err);
        }
        user = new User({
          username: 'admin'
        });
        user2 = new User({
          username: 'user2',
        });
        user2.save(function () {
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
    });

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

    var simId1 ='';
    describe('Check Launch Simulator', function() {
      it('should be possible to launch a simulator', function(done) {
        agent
        .post('/simulators')
        .set('Acccept', 'application/json')
        .send(launchData)
        .end(function(err,res){
          should.not.exist(err);
          should.exist(res);
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var data = JSON.parse(res.text);
          data.id.should.not.be.empty();
          simId1 = data.id;
          data.status.should.equal('LAUNCHING');
          data.region.should.equal('us-west-1');
          done();
        });
      });
    });

    describe('Check One Simulator Launched', function() {
      it('should be one running simulator', function(done) {
        agent
        .get('/simulators')
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var text = JSON.parse(res.text);
          text.length.should.be.exactly(1);
          text[0].owner.username.should.equal('admin');
          text[0].id.should.not.be.empty();
          text[0].id.should.equal(simId1);
          text[0].status.should.equal('LAUNCHING');
          text[0].region.should.equal('us-west-1');
          done();
        });
      });
    });

    describe('Check Get Simulatior by ID', function() {
      it('should be possible to get the first running simulator',
        function(done) {
        agent
        .get('/simulators/' + simId1)
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var text = JSON.parse(res.text);
          text.owner.username.should.equal('admin');
          text.id.should.equal(simId1);
          text.status.should.equal('LAUNCHING');
          text.region.should.equal('us-west-1');
          done();
        });
      });
    });

    var simId2 ='';
    describe('Check Launch Second Simulator', function() {
      it('should be possible to create another simulator', function(done) {
        // let's change the region
        const data = JSON.parse(JSON.stringify(launchData))
        data.region = 'us-east-1'
        agent
        .post('/simulators')
        .set('Acccept', 'application/json')
        .send(data)
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var text = JSON.parse(res.text);
          text.id.should.not.be.empty();
          text.id.should.not.equal(simId1);
          simId2 = text.id;
          text.status.should.equal('LAUNCHING');
          text.region.should.equal('us-east-1');
          done();
        });
      });
    });

    describe('Check Two Simulators Launched', function() {
      it('should be two running simulators', function(done) {
        agent
        .get('/simulators')
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var sims = JSON.parse(res.text);
          sims.length.should.be.exactly(2);

          var simId1Idx = sims.map(
             function(e){return e.id}).indexOf(simId1);
          var simId2Idx = sims.map(
             function(e){return e.id}).indexOf(simId2);
          simId1Idx.should.be.greaterThanOrEqual(0);
          simId2Idx.should.be.greaterThanOrEqual(0);
          simId1Idx.should.not.equal(simId2Idx);

          sims[simId1Idx].owner.username.should.equal('admin');
          sims[simId1Idx].id.should.not.be.empty();
          sims[simId1Idx].id.should.equal(simId1);
          sims[simId1Idx].status.should.equal('LAUNCHING');
          sims[simId1Idx].region.should.equal('us-west-1');

          sims[simId2Idx].owner.username.should.equal('admin');
          sims[simId2Idx].id.should.not.be.empty();
          sims[simId2Idx].id.should.equal(simId2);
          sims[simId2Idx].status.should.equal('LAUNCHING');
          sims[simId2Idx].region.should.equal('us-east-1');
          done();
        });
      });
    });

    describe('Check Terminate Simulator', function() {
      it('should be possible to terminate a running simulator', function(done) {
        agent
        .delete('/simulators')
        .send({id: simId1})
        .set('Acccept', 'application/json')
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          done();
        });
      });
    });


    describe('Check One Simulator Remaining', function() {
      it('should be one running simulator', function(done) {
        agent
        .get('/simulators')
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var text = JSON.parse(res.text);
          text.length.should.be.exactly(1);
          text[0].owner.username.should.equal('admin');
          text[0].id.should.not.be.empty();
          text[0].id.should.equal(simId2);
          text[0].status.should.equal('LAUNCHING');
          text[0].region.should.equal('us-east-1');
          done();
        });
      });
    });

    describe('Check Get Simulator By ID Valid State', function() {
      it('should be possible to get the first simulator by id and verify \
        its new state', function(done) {
        agent
        .get('/simulators/' + simId1)
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var text = JSON.parse(res.text);
          text.owner.username.should.equal('admin');
          text.id.should.equal(simId1);
          // status should now be terminated
          text.status.should.equal('TERMINATED');
          text.region.should.equal('us-west-1');
          done();
        });
      });
    });

    describe('Check Get All Simulators Including Terminated Ones', function() {
      it('should be able to see running and terminated simulators',
          function(done) {
        agent
        .get('/simulators')
        .send({all: true})
        .set('Acccept', 'application/json')
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var sims = JSON.parse(res.text);
          sims.length.should.be.exactly(2);

          var simId1Idx = sims.map(
             function(e){return e.id}).indexOf(simId1);
          var simId2Idx = sims.map(
             function(e){return e.id}).indexOf(simId2);
          simId1Idx.should.be.greaterThanOrEqual(0);
          simId2Idx.should.be.greaterThanOrEqual(0);
          simId1Idx.should.not.equal(simId2Idx);

          sims[simId1Idx].owner.username.should.equal('admin');
          sims[simId1Idx].id.should.not.be.empty();
          sims[simId1Idx].id.should.equal(simId1);
          sims[simId1Idx].status.should.equal('TERMINATED');
          sims[simId1Idx].region.should.equal('us-west-1');

          sims[simId2Idx].owner.username.should.equal('admin');
          sims[simId2Idx].id.should.not.be.empty();
          sims[simId2Idx].id.should.equal(simId2);
          sims[simId2Idx].status.should.equal('LAUNCHING');
          sims[simId2Idx].region.should.equal('us-east-1');
          done();
        });
      });
    });

    // create simId3 for permission test
    var simId3 ='';
    describe('Check Launch Third Simulator', function() {
      it('should be possible to create the third simulator', function(done) {
        // let's change the region
        const data = JSON.parse(JSON.stringify(launchData))
        data.region = 'us-east-1'
        agent
        .post('/simulators')
        .set('Acccept', 'application/json')
        .send(data)
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var text = JSON.parse(res.text);
          text.id.should.not.be.empty();
          text.id.should.not.equal(simId1);
          text.id.should.not.equal(simId2);
          simId3 = text.id;
          text.status.should.equal('LAUNCHING');
          text.region.should.equal('us-east-1');
          done();
        });
      });
    });

    // user2 has no read/write permission to any simulators
    describe('Check Get Simulator without Read Permission', function() {
      it('should not be able to see any running simulators',
          function(done) {
        agent
        .get('/simulators')
        .set('authorization', 'user2')
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          JSON.parse(res.text).length.should.be.exactly(0);
          done();
        });
      });
    });

    // give user2 read permission to simId2
    describe('Grant Read Permission', function() {
      it('should be possible to grant user read permission', function(done) {
        agent
        .post('/simulators/permissions')
        .set('Acccept', 'application/json')
        .send({id: simId2, username: user2.username, read_only: true})
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var text = JSON.parse(res.text);
          text.success.should.equal(true);
          text.id.should.equal(simId2);
          text.username.should.equal(user2.username);
          text.read_only.should.equal(true);
          done();
        });
      });
    });

    // user2 should be able to see simId2
    describe('Check Get Simulator with Read Permission', function() {
      it('should be able to see only one running simulator', function(done) {
        agent
        .get('/simulators')
        .set('authorization', 'user2')
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var text = JSON.parse(res.text);
          text.length.should.be.exactly(1);
          text[0].id.should.equal(simId2);
          text[0].users.length.should.be.exactly(1);
          text[0].users[0].username.should.equal('user2');
          text[0].users[0].read_only.should.equal(true);
          done();
        });
      });
    });

    // user2 should not be able to terminate simId2 with only read permission
    describe('Check Terminate Simulator without Write Permission', function() {
      it('should not be able to terminate simulator without write permission',
          function(done) {
        agent
        .delete('/simulators')
        .set('Acccept', 'application/json')
        .set('authorization', 'user2')
        .send({id: simId2})
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var text = JSON.parse(res.text);
          text.success.should.equal(false);
          done();
        });
      });
    });

    // give user2 write permission to simId3
    describe('Grant Write Permission', function() {
      it('should be possible to grant user write permission', function(done) {
        agent
        .post('/simulators/permissions')
        .set('Acccept', 'application/json')
        .send({id: simId3, username: user2.username, read_only: false})
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var text = JSON.parse(res.text);
          text.success.should.equal(true);
          text.id.should.equal(simId3);
          text.username.should.equal(user2.username);
          text.read_only.should.equal(false);
          done();
        });
      });
    });

    // user2 should be able to see simId2 and simId3
    describe('Check Get Simulator with Read/Write Permission', function() {
      it('should be able to see only one running simulator', function(done) {
        agent
        .get('/simulators')
        .set('authorization', 'user2')
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var sims = JSON.parse(res.text);
          sims.length.should.be.exactly(2);

          var simId2Idx = sims.map(
             function(e){return e.id}).indexOf(simId2);
          var simId3Idx = sims.map(
             function(e){return e.id}).indexOf(simId3);
          simId2Idx.should.be.greaterThanOrEqual(0);
          simId3Idx.should.be.greaterThanOrEqual(0);
          simId2Idx.should.not.equal(simId3Idx);

          sims[simId2Idx].id.should.not.be.empty();
          sims[simId2Idx].id.should.equal(simId2);
          sims[simId2Idx].users.length.should.be.exactly(1);
          sims[simId2Idx].users[0].username.should.equal('user2');
          sims[simId2Idx].users[0].read_only.should.equal(true);
          sims[simId3Idx].id.should.not.be.empty();
          sims[simId3Idx].id.should.equal(simId3);
          sims[simId3Idx].users.length.should.be.exactly(1);
          sims[simId3Idx].users[0].username.should.equal('user2');
          sims[simId3Idx].users[0].read_only.should.equal(false);
          done();
        });
      });
    });

    // user2 should be able to terminate simId3
    describe('Check Terminate Simulator with Write Permission', function() {
      it('should be able to terminate simulator with write permission',
          function(done) {
        agent
        .delete('/simulators')
        .set('Acccept', 'application/json')
        .set('authorization', 'user2')
        .send({id: simId3})
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          done();
        });
      });
    });

    // verify simId3 is terminated
    describe('Check One Simulator Remaining', function() {
      it('should be one running simulator', function(done) {
        agent
        .get('/simulators')
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var text = JSON.parse(res.text);
          text.length.should.be.exactly(1);
          text[0].owner.username.should.equal('admin');
          text[0].id.should.not.be.empty();
          text[0].id.should.equal(simId2);
          text[0].status.should.equal('LAUNCHING');
          text[0].region.should.equal('us-east-1');
          done();
        });
      });
    });


    // create simId4 for revoke permission test
    var simId4 ='';
    describe('Check Launch Fourth Simulator', function() {
      it('should be possible to create the fourth simulator', function(done) {
        agent
        .post('/simulators')
        .set('Acccept', 'application/json')
        .send(launchData)
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var text = JSON.parse(res.text);
          text.id.should.not.be.empty();
          text.id.should.not.equal(simId1);
          text.id.should.not.equal(simId2);
          text.id.should.not.equal(simId3);
          simId4 = text.id;
          text.status.should.equal('LAUNCHING');
          text.region.should.equal('us-west-1');
          done();
        });
      });
    });

    // give user2 read permission to simId4
    describe('Grant Read Permission', function() {
      it('should be possible to grant user read permission to more simulators',
          function(done) {
        agent
        .post('/simulators/permissions')
        .set('Acccept', 'application/json')
        .send({id: simId4, username: user2.username, read_only: true})
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var text = JSON.parse(res.text);
          text.success.should.equal(true);
          text.id.should.equal(simId4);
          text.username.should.equal(user2.username);
          text.read_only.should.equal(true);
          done();
        });
      });
    });

    // user2 should be able to see simId2 and simId4
    describe('Verify User Read/Write Permission', function() {
      it('should be able to see two running simulators', function(done) {
        agent
        .get('/simulators')
        .set('authorization', 'user2')
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var sims = JSON.parse(res.text);
          sims.length.should.be.exactly(2);

          var simId2Idx = sims.map(
             function(e){return e.id}).indexOf(simId2);
          var simId4Idx = sims.map(
             function(e){return e.id}).indexOf(simId4);
          simId2Idx.should.be.greaterThanOrEqual(0);
          simId4Idx.should.be.greaterThanOrEqual(0);
          simId2Idx.should.not.equal(simId4Idx);

          sims[simId2Idx].id.should.equal(simId2);
          sims[simId2Idx].users.length.should.be.exactly(1);
          sims[simId2Idx].users[0].username.should.equal('user2');
          sims[simId2Idx].users[0].read_only.should.equal(true);
          sims[simId4Idx].id.should.equal(simId4);
          sims[simId4Idx].users.length.should.be.exactly(1);
          sims[simId4Idx].users[0].username.should.equal('user2');
          sims[simId4Idx].users[0].read_only.should.equal(true);
          done();
        });
      });
    });

    // revoke user2's read permission to simId4
    describe('Revoke Read Permission', function() {
      it('should be possible to revoke user read permission',
          function(done) {
        agent
        .delete('/simulators/permissions')
        .set('Acccept', 'application/json')
        .send({id: simId4, username: user2.username, read_only: true})
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var text = JSON.parse(res.text);
          text.success.should.equal(true);
          text.id.should.equal(simId4);
          text.username.should.equal(user2.username);
          text.read_only.should.equal(true);
          done();
        });
      });
    });

    // user2 should be able to see simId2 but not simId4
    describe('Verify Revoke User Read Permission', function() {
      it('should be able to see one running simulators', function(done) {
        agent
        .get('/simulators')
        .set('authorization', 'user2')
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var text = JSON.parse(res.text);
          text.length.should.be.exactly(1);
          text[0].id.should.not.be.empty();
          text[0].id.should.be.equal(simId2);
          done();
        });
      });
    });

    // user2 should not be able to get simId4 without read permission
    describe('Check Get Simulator By ID No Read Permission', function() {
      it('should not be possible to get the simulator by id without permission',
          function(done) {
        agent
        .get('/simulators/' + simId4)
        .set('authorization', 'user2')
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var text = JSON.parse(res.text);
          text.success.should.equal(false);
          done();
        });
      });
    });

    // update user2's read permission to write permission to simId2
    describe('Update Read to Write Permission', function() {
      it('should be possible to update user from read to write permission',
          function(done) {
        agent
        .post('/simulators/permissions')
        .set('Acccept', 'application/json')
        .send({id: simId2, username: user2.username, read_only: false})
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var text = JSON.parse(res.text);
          text.success.should.equal(true);
          text.id.should.equal(simId2);
          text.username.should.equal(user2.username);
          text.read_only.should.equal(false);
          done();
        });
      });
    });

    // verify user2 has write permission to simId2
    describe('Verify Update User Write Permission', function() {
      it('should be able to see write permission in user permission list',
          function(done) {
        agent
        .get('/simulators')
        .set('authorization', 'user2')
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var sims = JSON.parse(res.text);
          sims.length.should.be.exactly(1);
          sims[0].users.length.should.be.exactly(1);
          sims[0].users[0].username.should.equal('user2');
          sims[0].users[0].read_only.should.equal(false);
          done();
        });
      });
    });

    // verify user2's write permission to simId2 cannot be revoke
    // using read_only = true
    describe('Revoke Write Permission with ReadOnly flag', function() {
      it('should not be possible to revoke user write permission with read',
          function(done) {
        agent
        .delete('/simulators/permissions')
        .set('Acccept', 'application/json')
        .send({id: simId2, username: user2.username, read_only: true})
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var text = JSON.parse(res.text);
          text.success.should.equal(false);
          done();
        });
      });
    });

    // revoke user2's write permission to simId2
    describe('Revoke User Write Permission', function() {
      it('should be able to revoke write permission', function(done) {
        agent
        .delete('/simulators/permissions')
        .set('authorization', 'user2')
        .set('Acccept', 'application/json')
        .send({id: simId2, username: user2.username, read_only: false})
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var text = JSON.parse(res.text);
          text.success.should.equal(true);
          text.id.should.equal(simId2);
          text.username.should.equal(user2.username);
          text.read_only.should.equal(false);
          done();
        });
      });
    });

    // user2 should not be able to see any running simulators
    describe('Verify Revoke User Write Permission', function() {
      it('should not be able to see any running simulators', function(done) {
        agent
        .get('/simulators')
        .set('authorization', 'user2')
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var text = JSON.parse(res.text);
          text.length.should.be.exactly(0);
          done();
        });
      });
    });

    // verify simulators' user permission list
    describe('Verify Simulators User Permissions', function() {
      it('should be to get all simulators and verify no users have permissions',
          function(done) {
        agent
        .get('/simulators')
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var sims = JSON.parse(res.text);
          sims.length.should.be.exactly(2);
          sims[0].users.length.should.be.exactly(0);
          sims[1].users.length.should.be.exactly(0);
          done();
        });
      });
    });

    after(function(done) {
      user.remove();
      user2.remove();

      Simulator.remove().exec();
      done();
    });
  });
});
