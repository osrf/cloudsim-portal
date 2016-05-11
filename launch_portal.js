"use strict"

let fs = require('fs')
let xcloud = require('./cloud_services.js')
let process = require('process')
//
//  Don't forget to load the AWS credentials in the environment
//
if( !process.env.AWS_ACCESS_KEY_ID) {
  console.log('AWS credentials not found!')
  process.exit(-1)
}

if (process.argv.length != 4) {
  console.log('Wrong # of arguments!')
  console.log('  should be: aws_ssh_keyname')
  console.log('  ex: node launch_sim.js cloudsim portal.bash\n')
  console.log('actual args: ', process.argv.length)
  process.argv.forEach((val, index, array) => {
    console.log(' ', `${index}: ${val}`);
  });
  process.exit(-3)
}

var aws_ssh_key = process.argv[2]
var script = fs.readFileSync(process.argv[3], 'utf8')

var base_good = { desc: 'Cloudsim portal on m4 xenial',
               region : 'us-west-1',
               keyName : aws_ssh_key,
               hardware : 'm4.large',  // hvm:ebs-ssd
               security : 'cloudsim_portal',
               image : 'ami-d8e996b8'}


let m  = base_good
console.log( m.desc)
console.log('region: ' + m.region)

let info = {}

let tags = {Name:'gazebo-portal'}

xcloud.launchSimulator (m.region, m.keyName, m.hardware, m.security, m.image, tags, script,
  function (err, machine) {
    if (err) throw err
    info = machine
    console.log('machine: ' + info.id)
    setTimeout(
      function ()
      {
        xcloud.simulatorStatus(info, console.log)
      }
    , 10000)
  }
)
