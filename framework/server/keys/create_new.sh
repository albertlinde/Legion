#!/usr/bin/env bash
echo "Creating keys."
openssl req -newkey rsa:2048 -nodes -keyout key.pem -x509 -days 365 -out cert.pem
openssl rsa -pubout -in key.pem -out public_key.pem
