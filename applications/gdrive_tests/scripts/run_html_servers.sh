#!/usr/bin/env bash

allIps=( 34 )

for ip in "${allIps[@]}"
do
    echo Running HTTPSERVER  at ip: "${ip}".
    ssh -o "StrictHostKeyChecking no" -x -i ./llcproto.pem ubuntu@${ip} 'bash -s' < ./run_html_server.sh &
    sleep 0.5
done
echo Done running HTTPSERVERS.
