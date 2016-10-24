#!/usr/bin/env bash

killall chromium-browser
killall Xvfb

#kill iptraf
ps -A | awk '/iptraf/ {print "sudo kill -9 "$1}' | bash
sudo rm -r /var/run/iptraf/

sleep 1

#rm logs
rm *.log
rm log.tar.gz

ps -A | awk '/iptraf/ {print "sudo kill -9 "$1}' | bash
sudo rm -r /var/run/iptraf/

cd run-headless-chromium/
rm Singleton*