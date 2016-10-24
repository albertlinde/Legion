#!/usr/bin/env bash

Ips=( 35.160.99.161 54.164.205.107 35.160.197.14 184.72.67.35 35.160.39.119 54.86.131.84 35.160.248.79 184.72.121.195 35.160.249.16 184.72.121.112 35.160.141.139 184.72.121.178 35.160.233.152 54.163.36.174 35.160.208.227 54.234.229.72 )

for ip in "${Ips[@]}"
do
    echo Setting up "${ip}".
#    ssh -o "StrictHostKeyChecking no" -x -i ./llcproto.pem ubuntu@${ip} 'bash -s' < ./stop_all.sh
 #   ssh -o "StrictHostKeyChecking no" -x -i ./llcproto.pem ubuntu@${ip} 'bash -s' < ./stop_and_remove_all.sh
    sleep .45
done
echo All done.
exit 0