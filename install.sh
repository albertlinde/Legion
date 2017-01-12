#!/usr/bin/env bash
./compile.sh

cd node_modules/node-forge
npm install
npm run minify


cd ./../../.
cd framework/server/keys/


if [ -f key.pem ];
then
    echo "WARNING: Keys exist!"
    echo "If you wish to reset keys, remove '.pem' files in '.framework/server/keys/'."
    echo "Or run"
    echo "    openssl req -newkey rsa:2048 -nodes -keyout key.pem -x509 -days 365 -out cert.pem"
    echo "    openssl rsa -pubout -in key.pem -out public_key.pem"
    echo "In '.framework/server/keys/'".
    echo "END WARNING: Keys exist!"
fi

if [ ! -f key.pem ];
then
    ./create_new.sh
fi

echo "All done!"