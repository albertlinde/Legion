#!/usr/bin/env bash
#!/usr/bin/env bash
sudo iptraf -i eth0 -B -L ./network_client.log
sleep 1
cd run-headless-chromium/
./run-headless-chromium.js "http://localhost:8000/load_map_legion.html?id=0Bx-QiF4z2CEtNDNPbnpadGtZcWs" --user-data-dir=. >> ./../run.log
