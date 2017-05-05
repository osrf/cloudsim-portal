#!/bin/bash
echo "option_settings:" > .ebextensions/https-lbterminate.config
echo "  # Add secure listener to load balancer" >> .ebextensions/https-lbterminate.config
echo "  # ARN of HTTPS certificate stored in ACM or IAM" >> .ebextensions/https-lbterminate.config
echo "  aws:elb:listener:443:" >> .ebextensions/https-lbterminate.config
echo "    SSLCertificateId: $1" >> .ebextensions/https-lbterminate.config
echo "    ListenerProtocol: HTTPS" >> .ebextensions/https-lbterminate.config
echo "  # Use the custom security group for the load balancer" >> .ebextensions/https-lbterminate.config
echo "  aws:elb:loadbalancer:" >> .ebextensions/https-lbterminate.config
echo "    SecurityGroups: '\`{ \"Ref\" : \"loadbalancersg\" }\`'" >> .ebextensions/https-lbterminate.config
echo "    ManagedSecurityGroup: '\`{ \"Ref\" : \"loadbalancersg\" }\`'" >> .ebextensions/https-lbterminate.config
echo "Resources:" >> .ebextensions/https-lbterminate.config
echo "  # Create a custom load balancer security group for ease of modification" >> .ebextensions/https-lbterminate.config
echo "  loadbalancersg:" >> .ebextensions/https-lbterminate.config
echo "    Type: AWS::EC2::SecurityGroup" >> .ebextensions/https-lbterminate.config
echo "    Properties:" >> .ebextensions/https-lbterminate.config
echo "      GroupDescription: load balancer security group" >> .ebextensions/https-lbterminate.config
echo "      VpcId: $2" >> .ebextensions/https-lbterminate.config
echo "      SecurityGroupIngress:" >> .ebextensions/https-lbterminate.config
echo "        - IpProtocol: tcp" >> .ebextensions/https-lbterminate.config
echo "          FromPort: 443" >> .ebextensions/https-lbterminate.config
echo "          ToPort: 443" >> .ebextensions/https-lbterminate.config
echo "          CidrIp: 0.0.0.0/0" >> .ebextensions/https-lbterminate.config
echo "        - IpProtocol: tcp" >> .ebextensions/https-lbterminate.config
echo "          FromPort: 80" >> .ebextensions/https-lbterminate.config
echo "          ToPort: 80" >> .ebextensions/https-lbterminate.config
echo "          CidrIp: 0.0.0.0/0" >> .ebextensions/https-lbterminate.config
echo "        - IpProtocol: icmp" >> .ebextensions/https-lbterminate.config
echo "          FromPort: 8" >> .ebextensions/https-lbterminate.config
echo "          ToPort: -1" >> .ebextensions/https-lbterminate.config
echo "          CidrIp: 0.0.0.0/0" >> .ebextensions/https-lbterminate.config
echo "        - IpProtocol: tcp" >> .ebextensions/https-lbterminate.config
echo "          FromPort: 22" >> .ebextensions/https-lbterminate.config
echo "          ToPort: 22" >> .ebextensions/https-lbterminate.config
echo "          CidrIp: 0.0.0.0/0" >> .ebextensions/https-lbterminate.config
echo "      SecurityGroupEgress:" >> .ebextensions/https-lbterminate.config
echo "        - IpProtocol: tcp" >> .ebextensions/https-lbterminate.config
echo "          FromPort: 80" >> .ebextensions/https-lbterminate.config
echo "          ToPort: 80" >> .ebextensions/https-lbterminate.config
echo "          CidrIp: 0.0.0.0/0" >> .ebextensions/https-lbterminate.config
cat .ebextensions/https-lbterminate.config
