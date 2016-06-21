#!/usr/bin/env bash

# This script creates a bash file that launches a docker container
# The container runs a webservice through which gzserver can be
# controlled

directory="/home/ubuntu/code/src_cloud_simulator/docker"
fullpath="$directory/setup_cloudsim_sim.bash"
logpath="$directory/cloudsim.log"

date > $logpath
echo "writing $fullpath file" >> $logpath

# This script is generated as part of the cloud-init when the ec2 instance is
# launched. However it is too early at that tim to launch the container because
# the docker daemon is not running yet.
# see cloudsim-portal/docker_cloudsim_env.bash for the source code
# A custom upstart service running on the host will source this script
# when it starts.

cat <<DELIM > $fullpath
#!/usr/bin/env bash

# authentication server public key, to verify users
export CLOUDSIM_AUTH_PUB_KEY="-----BEGIN PUBLIC KEY-----\nMFowDQYJKoZIhvcNAQEBBQADSQAwRgJBAIAfUSMQ7L/ueHjn10XgBQX9AnyeQcDQ\npfv5DNQyLtpfaSnQPKElKL0OFzG+98ILOGPbB7Ft0NzqW4KHNuNxOUcCAQU=\n-----END PUBLIC KEY-----"

# admin user that can launch simulations
export ADMIN_USER="admin"

# the docker container to run
export container_name="cloudsim"

date >> $logpath
echo "$fullpath data loaded" >> $logpath

DELIM

date >> $logpath
echo "cloud-init is done" >> $logpath

