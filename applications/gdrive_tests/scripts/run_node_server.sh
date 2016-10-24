#!/usr/bin/env bash
cd
cd legion

if [ ! -d "./run" ]; then
    mkdir ./run
fi

node ./framework/server/Signallingserver.js > ./run/SignallingServer.log 2> ./run/SignallingServer.error.log &
node ./framework/server/ObjectsServer.js > ./run/ObjectsServer.log 2> ./run/ObjectsServer.error.log &
