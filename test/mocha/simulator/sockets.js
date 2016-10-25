'use strict'

console.log('test/mocha/simulator/sockets.js')

const app = require('../../../server/server.js')

const util = require('util')
const should = require('should')
const supertest = require('supertest')
const io = require('socket.io-client')

let adminUser = 'admin'
if (process.env.CLOUDSIM_ADMIN)
  adminUser = process.env.CLOUDSIM_ADMIN

/// Module dependencies.
const mongoose = require('mongoose')
const Simulator = mongoose.model('Simulator')

// we need fresh keys for this test
const csgrant = require('cloudsim-grant')

// the tokens to identify our users
let adminToken
let user2Token
let user3Token
let user4Token

// the simulators created in this test
let simId1
let simId2


const adminTokenData = {identities:[adminUser]}
const user2TokenData = {identities:['user2']}
const user3TokenData = {identities:['user3']}
const user4TokenData = {identities:['user4']}

const log = false?console.log: function(){} // log or not

const agent = supertest.agent(app)
const port = process.env.PORT || 4000
const socketAddress = 'http://localhost:' + port


let user4socket
let user4events = []

const launchData = {
                     region: 'us-west-1',
                     hardware:'t2.small',
                     machineImage: 'bozo'
                   }

// this function creates a socket.io socket connection for the token's user.
// events will be added to the events array
function createSocket(token, events) {
  const query = 'token=' + token
  const client = io.connect(socketAddress, {
    query: query,
    transports: ['websocket'],
    rejectUnauthorized: false
  })
  client.on('connect', function(socket) {
    log('IO connect')
  })
  client.on('error', (e)=>{
    log('IO ERROR',e)
    should.fail('should have no error')
  })
  client.on('disconnect', ()=>{
    log('IO disconnect')
    if (events)
      events.push("disconnect")
  })
  client.on('reconnect', (n)=>{
    log('IO reconnect, nb:', n)
    should.fail('should have no reconnect')
  })
  client.on('reconnect_attempt', ()=>{
    log('IO reconnect_attempt')
    should.fail('should have no reconnect attempt')
  })
  client.on('reconnecting', (n)=>{
    log('IO reconnecting, nb:', n)
    should.fail('should have no reconnecting')
  })
  client.on('reconnect_error',  function(err){
    log('IO reconnect error ' + util.inspect(err))
    should.fail('should have no reconnect error')
  })
  client.on('resource', function(res) {
    log('IO resource:', res)
    if (events)
      events.push(res)
  })
  return client
}

// json parse an http response. Pass true
// for log and it will be printed.
function parseResponse(text, log) {
  if(log) {
    csgrant.dump()
  }
  let res
  try {
   res = JSON.parse(text)
  }
  catch (e) {
    console.log(text)
    throw e
  }
  if(log){
    const s = JSON.stringify(res, null, 2)
    console.log(s)
  }
  return res
}


describe('<Unit Test sockets>', function() {
  before(function(done) {
    // we need fresh keys for this test
    const keys = csgrant.token.generateKeys()
    csgrant.token.initKeys(keys.public, keys.private)
    log('keys done')
    done()
  })

  before(function(done) {
    csgrant.token.signToken(adminTokenData, (e, tok)=>{
      if(e) {
        should.fail('sign error: ' + e)
      }
      adminToken = tok
      log('token signed for user "' + adminTokenData.identities[0]  + '"')
      done()
    })
  })

  before(function(done) {
    csgrant.token.signToken(user2TokenData, (e, tok)=>{
      if(e) {
        should.fail('sign error: ' + e)
      }
      user2Token = tok
      log('token signed for user "' + user2TokenData.identities  + '"')
      done()
    })
  })

  before(function(done) {
    csgrant.token.signToken(user3TokenData, (e, tok)=>{
      if(e) {
        should.fail('sign error: ' + e)
      }
      user3Token = tok
      console.log('token signed for user "' + user3TokenData.identities[0]  + '"')
      done()
    })
  })

  before(function(done) {
    csgrant.token.signToken(user4TokenData, (e, tok)=>{
      if(e) {
        should.fail('sign error: ' + e)
      }
      user4Token = tok
      console.log('token signed for user "' + user4TokenData.identities[0]  + '"')
      done()
    })
  })


  describe('Simulator Sockets:', function() {
    before(function(done) {
      // clear the simulator collection before the tests
      Simulator.remove({}, function(err){
        if (err){
          should.fail(err)
          return
        }
        log('mongo delete done\n\n')
        done()
      })
    })

    // check initial condition - no simulators running
    describe('Check Empty Running Simulator', function() {
      it('should be no running simulators at the beginning',
          function(done) {
        agent
        .get('/simulators')
        .set('authorization', adminToken)
        .end(function(err,res){
          res.status.should.be.equal(200)
          res.redirect.should.equal(false)
          JSON.parse(res.text).length.should.be.exactly(0)
          done()
        })
      })
    })


    describe('Check Socket Connection', function() {
      it('should be able to connect via websockets', function(done) {
        const soc = createSocket(adminToken)
        soc.once('connect', res => {
          soc.disconnect()
          done()
        })
      })
    })

    describe('Check inactive Socket', function() {
      it('should be able to connect via websockets', function(done) {
        user4socket = createSocket(user4Token, user4events)
        user4socket.on('connect', res => {
          done()
        })
      })
    })


    // launch simulator and wait for launch event
    describe('Check Simulator Launch event', function() {
      it('should be able to receive simulator launch event', function(done) {
        const soc = createSocket(adminToken)
        soc.on('connect', _ => {
          // post to simulators to launch
          agent
            .post('/simulators')
            .set('Accept', 'application/json')
            .set('authorization', adminToken)
            .send(launchData)
            .end(function(err,res){
              should.not.exist(err)
              should.exist(res)
              res.status.should.be.equal(200)
              res.redirect.should.equal(false)
              const r = parseResponse(res.text)
              r.status.should.equal('LAUNCHING')
              should.exist(r.id)
          })
        })

        soc.once('resource', res => {
          res.operation.should.equal('create')
          simId1 = res.resource
          soc.disconnect()
          done()
        })
      })
    })

    // verify simulator status events for client with read permission
    describe('Check Client Simulator Status event with Read Permission',
        function() {
      it('should receive simulator grant events for user2 (read only)',
        function(done) {
        const soc = createSocket(user2Token)
        soc.on('connect', _ => {
          agent
            .post('/permissions')
            .set('Accept', 'application/json')
            .set('authorization', adminToken)
            .send({resource: simId1, grantee: 'user2', readOnly: true})
            .end(function(err,res){
              res.status.should.be.equal(200)
              res.redirect.should.equal(false)
              const r = parseResponse(res.text)
              r.success.should.equal(true)
              r.resource.should.equal(simId1)
              r.grantee.should.equal('user2')
              r.readOnly.should.equal(true)
          })
        })
        soc.once('resource', res => {
          res.operation.should.equal('grant')
          soc.disconnect()
          done()
        })
      })
    })

    // verify simulator events for client with write permission
    describe('Check Client Simulator Status event with Write Permission',
        function() {
      it('should receive simulator events for user3 (read/write)',
        function(done) {
        const soc = createSocket(user3Token)
        soc.on('connect', _ => {
          agent
            .post('/permissions')
            .set('Accept', 'application/json')
            .set('authorization', adminToken)
            .send({resource: simId1, grantee: 'user3', readOnly: false})
            .end(function(err,res){
              res.status.should.be.equal(200)
              res.redirect.should.equal(false)
              var text = JSON.parse(res.text)
              text.success.should.equal(true)
              text.resource.should.equal(simId1)
              text.grantee.should.equal('user3')
              text.readOnly.should.equal(false)
          })
        })
        soc.once('resource', res => {
          res.operation.should.equal('grant')
          soc.disconnect()
          done()
        })
      })
    })

    // verify simulator events for client with revoked permission
    describe('Check event when Permission is Revoked',
        function() {
      it('should receive revoke event',
          function(done) {
        const soc = createSocket(user3Token)
        soc.on('connect', _ => {
          agent
            .delete('/permissions')
            .set('Accept', 'application/json')
            .set('authorization', adminToken)
            .send({resource: simId1, grantee: 'user3', readOnly: false})
            .end(function(err,res){
              res.status.should.be.equal(200)
              res.redirect.should.equal(false)
              var text = JSON.parse(res.text)
              text.success.should.equal(true)
              text.resource.should.equal(simId1)
              text.grantee.should.equal('user3')
              text.readOnly.should.equal(false)
          })
        })
        soc.once('resource', res => {
          res.resource.should.equal(simId1)
          res.operation.should.equal('revoke')
          soc.disconnect()
          done()
        })
      })
    })

    // check clients receive the correct events when there is more than one
    // simulator
    describe('Check Multiple Simulators and Multiple Clients', function() {
      it('should be able to receive simulator 2 create event',
          function(done) {
        let soc = createSocket(adminToken)
        soc.on('connect', _ => {
          // post to simulators to launch
          agent
          .post('/simulators')
          .set('Accept', 'application/json')
          .set('authorization', adminToken)
          .send(launchData)
          .end(function(err,res){
            should.not.exist(err)
            should.exist(res)
            res.status.should.be.equal(200)
            res.redirect.should.equal(false)
            const r = parseResponse(res.text)
            r.status.should.equal('LAUNCHING')
            should.exist(r.id)
            // simId2 can be set already, but not always
            if (simId2) {
              r.id.should.equal(simId2)
            }
            simId2  = r.id
          })
        })
        soc.on('resource', res => {
          res.resource.should.not.equal(simId1)
          should.exist(res.resource)
          if (res.operation == 'create') {
            simId2 = res.resource
          }
          if (res.operation == 'update') {
            res.resource.should.equal(simId2)
            soc.disconnect()
            done()
          }
        })
      })
    })

    // terminate simulator and wait for terminate event
    describe('Check Simulator Terminate event', function() {
      it('should be able to receive simulator terminate event',
          function(done) {

        // make sure both clients are ready before posting to terminate
        // simulator
        const socAdmin = createSocket(adminToken)
        const socU2 = createSocket(user2Token)

        let count = 0
        socAdmin.once('resource', res => {
          res.resource.should.equal(simId1)
          // the resource is not deleted, the state is
          // set to TERMINATING
          res.operation.should.equal('update')
          count += 1
          if (count == 2) {
            socAdmin.disconnect()
            done()
          }
        })
        socU2.once('resource', res =>{
          count += 1
          if (count == 2) {
            socU2.disconnect()
            done()
          }
        })

        // post to terminate simulator
        agent
        .delete('/simulators/' + simId1)
        .set('Accept', 'application/json')
        .set('authorization', adminToken)
        .end(function(err,res){
          res.status.should.be.equal(200)
          res.redirect.should.equal(false)
          const r = parseResponse(res.text)
        })
      })
    })

    describe('Check user4 was left alone', function() {
      it ('Should not be possible for user4 to get notifications', done => {
        console.log(user4events)
        user4events.length.should.equal(0)

        done()
      })
    })

    after(function(done) {
     Simulator.remove().exec()
      csgrant.model.clearDb()
      done()
    })
  })
})
