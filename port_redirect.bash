#!/usr/bin/env bash

#
# Redirects port 443 to 4000. This allows you:
#   launch node on port 4000 with the ubuntu user
#   accept connections on port 443 (https) without root access

# instructions:
#   this has to be run as root
#   the network interface is ens3 (not eth0)
#   this could go in /etc/rc.local

iptables -t nat -A PREROUTING -i ens3 -p tcp --dport 443 -j REDIRECT --to-port 4000
