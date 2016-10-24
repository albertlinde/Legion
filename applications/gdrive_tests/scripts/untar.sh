#!/usr/bin/env bash
for f in *.gz; do
 tar -xf $f
 mv network_client.log network_${f}.log
 mv run.log run_${f}.log
done