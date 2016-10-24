#!/usr/bin/env bash

ipNC="54.67.55.30"
ipOR="35.160.99.161"
ipNV="54.164.205.107"

rsync -avz -e "ssh -o StrictHostKeyChecking=no -i llcproto.pem" "./../../../../Legion v2/." ubuntu@${ipOR}:~/legion
sleep .45
rsync -avz -e "ssh -o StrictHostKeyChecking=no -i llcproto.pem" "./../../../../Legion v2/." ubuntu@${ipNV}:~/legion
sleep .45
rsync -avz -e "ssh -o StrictHostKeyChecking=no -i llcproto.pem" "./../../../../Legion v2/." ubuntu@${ipNC}:~/legion
sleep .45

ssh -o "StrictHostKeyChecking no" -x -i ./llcproto.pem ubuntu@${ipOR} 'bash -s' < ./rsyncOR.sh
sleep .45
ssh -o "StrictHostKeyChecking no" -x -i ./llcproto.pem ubuntu@${ipNV} 'bash -s' < ./rsyncNV.sh
sleep .45

echo All done.
exit 0