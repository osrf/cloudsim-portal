// #/usr/bin/env node

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
  console.log('  should be: aws_ssh_keyname script')
  console.log('  ex: node launch_sim.js cloudsim src_start.bash\n')
  console.log('actual args: ', process.argv.length)
  process.argv.forEach((val, index, array) => {
    console.log(' ', `${index}: ${val}`);
  });
  process.exit(-3)
}

var aws_ssh_key = process.argv[2]
var script = fs.readFileSync(process.argv[3], 'utf8')

// var base_good = { desc: 'Trusty + nvidia (CUDA 6.5)',
//               region : 'us-west-1',
//               keyName : 'hugo_osrf',
//               hardware : 'g2.2xlarge',
//               security : 'gazebo',
//               image : 'ami-ea9af68a'}

var base_good = { desc: 'Trusty + nvidia (CUDA 7.5)',
               region : 'us-west-1',
               keyName : aws_ssh_key,
               hardware : 'g2.2xlarge',
               security : 'cloudsim-sim',
               image : 'ami-610c7801'}

var test_small = { desc: 'xenial t2.small',
               region : 'us-west-1',
               keyName : aws_ssh_key,
               hardware : 't2.small',  //  'g2.2xlarge',
               security : 'cloudsim-sim',
               image : 'ami-84423ae4' }//  'ami-610c7801'}


const test_gpu_0_1 = {
  desc: 'cloudsim-sim-gpu-gazebo 0.1',
  region : 'us-west-1',
  keyName : aws_ssh_key,
  hardware : 'g2.2xlarge',
  security : 'cloudsim-sim',
  image : 'ami-6fb4f10f'
}

const test_gpu_0_2 = {
  desc: 'cloudsim-sim-gpu-gazebo 0.2',
  region : 'us-west-1',
  keyName : aws_ssh_key,
  hardware : 'g2.2xlarge',
  security : 'cloudsim-sim',
  image : 'ami-3d3f7b5d'
}


let machine  = test_gpu_0_2
console.log( machine.desc)
console.log('region: ' + machine.region)

let info = {}
let tags = {Name:'simtest'}
xcloud.launchSimulator (machine.region,
                        machine.keyName,
                        machine.hardware,
                        machine.security,
                        machine.image, tags, script,
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
