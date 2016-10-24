#!/usr/bin/env bash
cd
cd legion/applications/gdrive_tests/


if [ ! -d "./run" ]; then
    mkdir ./run
fi

node HTTPserver.js > ./run/HTTPserver.log 2> ./run/HTTPserver.error.log &
