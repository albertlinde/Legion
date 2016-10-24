if [ ! -d "./run" ]; then
    mkdir ./run
fi

node ./framework/server/Signallingserver.js > ./run/SignallingServer.log 2> ./run/SignallingServer.error.log &
node ./framework/server/ObjectsServer.js > ./run/ObjectsServer.log 2> ./run/ObjectsServer.error.log &

cd applications/examples/
node HTTPserver.js > ./../../run/HTTPserver.log 2> ./../../run/HTTPserver.error.log &
