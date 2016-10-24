#!/usr/bin/env bash

#sudo apt-get update
#sudo apt-get install -y git xvfb nodejs npm nodejs-legacy chromium-browser libexif12 iptraf ntp

#cd

#git clone https://github.com/CodeYellowBV/run-headless-chromium.git
#cd run-headless-chromium
#npm install

#cd

#mkdir legion

#cd

sudo find /etc/ntp.conf -type f -print0 | xargs -0 sudo sed -i 's/.ubuntu.pool/.amazon.pool/g'
sleep 2
sudo service ntp stop
sleep 2
sudo service ntp start
sleep 2
