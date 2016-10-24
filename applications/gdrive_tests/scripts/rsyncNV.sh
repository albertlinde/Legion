#!/usr/bin/env bash

Ips=( 184.72.67.35 54.86.131.84 184.72.121.195 184.72.121.112 184.72.121.178 54.163.36.174 54.234.229.72 )

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