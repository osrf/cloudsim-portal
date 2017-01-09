'use strict';

console.log('test/zip.js')

const should = require('should')
const child_process = require('child_process')
const fs = require('fs')
const zip = require('../server/zip')

const resourceName = 'sshkey-007'
const filePath = '/tmp/' + resourceName + '.zip'

describe('<Unit test Zip>', function() {

  before(function(done) {
    child_process.execSync( 'rm -f ' + filePath)
    done()
  })

  describe('Create zip', function() {
    it('should be possible to create zip file', function(done) {
      // zip.compressTextFilesToZip(filePath, zipData, (err)=>{
      zip.zipSshKey(filePath, 'toto.txt', 'this is toto content', (err)=>{
        if(err) {
          should.fail(err)
        }
        done()
      })
    })
  })

  // get all resources
  describe('Verify zip', function() {
    it('should be possible to unzip', function(done) {
      // unzip to current directory (overwrite)
      child_process.execSync( 'unzip -o ' + filePath)
      // look for content
      const txt = fs.readFileSync("toto.txt").toString('utf8')
      txt.indexOf('this is toto content').should.equal(0)
      done()
    })
  })

  after(function(done) {
    child_process.execSync( 'rm -f ' + filePath)
    done()
  })
})
