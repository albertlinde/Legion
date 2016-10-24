#!/usr/bin/env bash

#ensure death
killall chromium-browser
killall Xvfb

sleep 5

ps -A | awk '/iptraf/ {print "sudo kill -9 "$1}' | bash
sudo rm -r /var/run/iptraf/

sleep 2

tar -zcf log.tar.gz *.log