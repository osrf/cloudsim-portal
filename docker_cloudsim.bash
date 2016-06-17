#!/usr/bin/env bash

#
# This script creates a bash file that launches a docker container
# The container runs a webservice through which gzserver can be
# controlled
#

repo_dir="/home/ubuntu/code/src_cloud_simulator/docker"

date > $repo_dir/cloudsim.log
echo "writing upstart.bash file" >> $repo_dir/cloudsim.log

#
# Write the upstart.bash script. This happens as part of the cloud-init
# when the ec2 instance is launched. However it is too early to launch
# the container because the daemon is not running yet.
#
# A custom upstart service running on the host will execute the script
# when it starts.
#
cat <<DELIM > $repo_dir/upstart.bash
#!/usr/bin/env bash

DIR="\$( cd "\$( dirname "\${BASH_SOURCE[0]}" )" && pwd )"

cd \$DIR

date >> cloudsim.log

export CLOUDSIM_AUTH_PUB_KEY="-----BEGIN PUBLIC KEY-----\nMFowDQYJKoZIhvcNAQEBBQADSQAwRgJBAIAfUSMQ7L/ueHjn10XgBQX9AnyeQcDQ\npfv5DNQyLtpfaSnQPKElKL0OFzG+98ILOGPbB7Ft0NzqW4KHNuNxOUcCAQU=\n-----END PUBLIC KEY-----"

export ADMIN_USER="hugo@osrfoundation.org"

export repo_dir=$repo_dir
export admin=$admin_user


echo "running /home/ubuntu/code/src_cloud_simulator/docker/run_cloudsim.bash" >> cloudsim.log

./run_cloudsim.bash

date >> cloudsim.log
echo "docker done" >> cloudsim.log

DELIM

chmod +x $repo_dir/upstart.bash

echo "cloud-init is done" >> $repo_dir/cloudsim.log
echo "----" >> $repo_dir/cloudsim.log

