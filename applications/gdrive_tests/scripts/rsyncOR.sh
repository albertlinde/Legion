#!/usr/bin/env bash

Ips=( 35.160.197.14 35.160.39.119 35.160.248.79 35.160.249.16 35.160.141.139 35.160.233.152 35.160.208.227 )

sudo chmod 400 legion/applications/llcproto.pem
sudo chmod 400 legion/applications/gdrive_tests/llcproto.pem

for ip in "${Ips[@]}"
do
    echo Setting up "${ip}".
    rsync -avz -e "ssh -o StrictHostKeyChecking=no -i llcproto.pem" ~/legion ubuntu@${ip}:~/.
    sleep .45
    rsync -avz -e "ssh -o StrictHostKeyChecking=no -i llcproto.pem" ~/run-headless-chromium ubuntu@${ip}:~/.
    sleep .45
done
echo All done.
exit 0