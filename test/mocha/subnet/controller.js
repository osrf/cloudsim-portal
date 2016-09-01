'use strict';

console.log('test/mocha/subnet/controller.js');

require('../../../server/server.js')

const csgrant = require('cloudsim-grant')


/// Module dependencies.
var mongoose = require('mongoose'),
    User = mongoose.model('User'),
    Subnet = mongoose.model('Subnet'),
    app = require('../../../server/server')

var util = require('util');
var should = require('should');
var supertest = require('supertest');

var user;
var user2;
var agent;

describe('<Unit Test>', function() {

  describe('Subnet Controller:', function() {
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

            // clear the subnet collection before the tests
            Subnet.remove({}, function(err){
              if (err){
              should.fail(err);
              }
              done();
            });
          });
        });
      });
    });

    describe('Check Empty Subnets', function() {
      it('should be no subnets at the beginning',
          function(done) {
        agent
        .get('/subnets')
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          JSON.parse(res.text).length.should.be.exactly(0);
          done();
        });
      });
    });

    var subnetId1 ='sn1';
    describe('Check Create Subnet', function() {
      it('should be possible to create a subnet', function(done) {
        var data = {id: subnetId1};
        agent
        .post('/subnets')
        .set('Acccept', 'application/json')
        .send(data)
        .end(function(err,res){
          should.not.exist(err);
          should.exist(res);
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var data = JSON.parse(res.text);
          data.id.should.not.be.empty();
          data.id.should.equal(subnetId1);
          data.vpc_id.should.not.be.empty();
          data.subnet_id.should.not.be.empty();
          done();
        });
      });
    });

    describe('Check One Subnet Launched', function() {
      it('should be one running subnet', function(done) {
        agent
        .get('/subnets')
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var text = JSON.parse(res.text);
          text.length.should.be.exactly(1);
          text[0].id.should.not.be.empty();
          text[0].id.should.equal(subnetId1);
          text[0].vpc_id.should.not.be.empty();
          text[0].subnet_id.should.not.be.empty();
          done();
        });
      });
    });

    var subnetId2 ='sn2';
    describe('Check Launch Second Subnet', function() {
      it('should be possible to create another subnet', function(done) {
        var data = {id: subnetId2};
        agent
        .post('/subnets')
        .set('Acccept', 'application/json')
        .send(data)
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var text = JSON.parse(res.text);
          text.id.should.not.be.empty();
          text.id.should.equal(subnetId2);
          text.vpc_id.should.not.be.empty();
          text.subnet_id.should.not.be.empty();
          done();
        });
      });
    });

    describe('Check Two Subnets Launched', function() {
      it('should be two subnets', function(done) {
        agent
        .get('/subnets')
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var subnets = JSON.parse(res.text);
          subnets.length.should.be.exactly(2);

          var subnetId1Idx = subnets.map(
             function(e){return e.id}).indexOf(subnetId1);
          var subnetId2Idx = subnets.map(
             function(e){return e.id}).indexOf(subnetId2);
          subnetId1Idx.should.be.greaterThanOrEqual(0);
          subnetId2Idx.should.be.greaterThanOrEqual(0);
          subnetId1Idx.should.not.equal(subnetId2Idx);

          subnets[subnetId1Idx].id.should.not.be.empty();
          subnets[subnetId1Idx].id.should.equal(subnetId1);
          subnets[subnetId1Idx].vpc_id.should.not.be.empty();
          subnets[subnetId1Idx].subnet_id.should.not.be.empty();

          subnets[subnetId2Idx].id.should.not.be.empty();
          subnets[subnetId2Idx].id.should.equal(subnetId2);
          subnets[subnetId2Idx].vpc_id.should.not.be.empty();
          subnets[subnetId2Idx].subnet_id.should.not.be.empty();
          done();
        });
      });
    });

    describe('Check Remove Subnet', function() {
      it('should be possible to remove a subnet', function(done) {
        agent
        .delete('/subnets')
        .send({id: subnetId1})
        .set('Acccept', 'application/json')
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          done();
        });
      });
    });


    describe('Check One Subnet Remaining', function() {
      it('should be one subnet', function(done) {
        agent
        .get('/subnets')
        .end(function(err,res){
          res.status.should.be.equal(200);
          res.redirect.should.equal(false);
          var text = JSON.parse(res.text);
          text.length.should.be.exactly(1);
          text[0].id.should.not.be.empty();
          text[0].id.should.equal(subnetId2);
          text[0].vpc_id.should.not.be.empty();
          text[0].subnet_id.should.not.be.empty();
          done();
        });
      });
    });

    after(function(done) {
      user.remove();
      user2.remove();

      Subnet.remove().exec();
      done();
    });
  });
});
