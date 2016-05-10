# README #

This is the portal  server for Cloudsim

### What is this repository for? ###

* A web app that manages simulation runs (create, view log)
* Has different types of users (to create, share and start simulation runs)
* Launches new AWS gpu instances with simulators and field computers
* Must be run from an AWS instance when using SSL certificates

### Setup ###

You need AWS keys (AWSAccessKeyId and AWSSecretKey). Get them from the AWS
console.

![IMAGE](aws_keys.png) Then you must prepare your environment variables. A good option is to create an
aws_setup.bash file outside of your repo that you can source. It can look like
 this (but replace the xxx with your aws keys):

`export AWS_ACCESS_KEY_ID=XXXXXXXX
 export AWS_SECRET_ACCESS_KEY=XXXXXXXXXX`

These environment variables must be loaded:

* in the shell that runs the portal web app (the keys are used to launch
 simulation machines)
* in the terminal you use to launch a new portal

Another important configuration is to upload or create a "Key Pair" in each
region where you want to launch machines. That key must be called "cloudsim".

![IMAGE](cloudsim_key.png)

#### Install the software (on your local machine) ####

You need the following: nodejs (version 4 and up) and gulp

* If you are running Trusty, you should use with nodesource:
curl https://deb.nodesource.com/setup_4.x | sudo -E bash -

to install nodejs:

`sudo apt-get install -y nodejs nodejs-legacy npm redis-server mercurial
sudo npm install -g gulp`


#### Launch on an AWS server ####

Use the launch_portal.js scrfipt to create a new aws instance.

sudo su
echo "portal" > /etc/hostname
bonus: echo "127.0.1.1 portal" >>  /etc/hosts

### Setup ###

From the root directory

* npm install
* gulp

* Database configuration: Redis for now
* How to run tests: gulp test

### Deployment instructions ###


### Contribution guidelines ###

### Who do I talk to? ###

* Repo owner or admin: hugo@osrfoundation.org
