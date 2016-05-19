'use strict';

console.log('test/mocha/simulator/controller.js');

require('../../../server/server.js')


/// Module dependencies.
var mongoose = require('mongoose'),
    User = mongoose.model('User'),
    Simulator = mongoose.model('Simulator'),
    User = mongoose.model('User'),
    app = require('../../../server/server')


var util = require('util');

var should = require('should');
var supertest = require('supertest');

var user;
var user2;
var agent;

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
          it('should be no running simulators at the beginning', function(done) {
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
                .send({region: 'us-west-1'})
                .end(function(err,res){
                    // util.log_res(res);
                    should.not.exist(err);
                    should.exist(res);
                    res.status.should.be.equal(200);
                    res.redirect.should.equal(false);
                    var text = JSON.parse(res.text);
                    text.id.should.not.be.empty();
                    simId1 = text.id;
                    text.status.should.equal('LAUNCHING');
                    text.region.should.equal('us-west-1');
                    done();
                });
            });
        });

        describe('Check One Simulator Created', function() {
            it('should be one running Simulator', function(done) {
                agent
                .get('/simulators')
                .end(function(err,res){
                    // util.log_res(res);
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
            it('should be possible to get the first running simulator', function(done) {
                agent
                .get('/simulators/' + simId1)
                .end(function(err,res){
                    // util.log_res(res);
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
        describe('Check Create Second Simulator', function() {
            it('should be possible to create another simulator', function(done) {
                agent
                .post('/simulators')
                .set('Acccept', 'application/json')
                .send({region: 'us-east-1' })
                .end(function(err,res){
                    // util.log_res(res);
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

        describe('Check Two Simulators Created', function() {
            it('should be two running simulators', function(done) {
                agent
                .get('/simulators')
                .end(function(err,res){
                    // util.log_res(res);
                    res.status.should.be.equal(200);
                    res.redirect.should.equal(false);
                    var sims = JSON.parse(res.text);
                    console.log (sims[0]);
                    sims.length.should.be.exactly(2);
                    sims[0].owner.username.should.equal('admin');
                    sims[0].id.should.not.be.empty();
                    sims[0].id.should.equal(simId1);
                    sims[0].status.should.equal('LAUNCHING');
                    sims[0].region.should.equal('us-west-1');
                    sims[1].owner.username.should.equal('admin');
                    sims[1].id.should.not.be.empty();
                    sims[1].id.should.equal(simId2);
                    sims[1].status.should.equal('LAUNCHING');
                    sims[1].region.should.equal('us-east-1');
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
                    // util.log_res(res);
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
                    // util.log_res(res);
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
            it('should be possible to get the first simulator by id and verify its new state', function(done) {
                agent
                .get('/simulators/' + simId1)
                .end(function(err,res){
                    // util.log_res(res);
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

        after(function(done) {
            user.remove();
            user2.remove();
            done();
        });
    });
});
