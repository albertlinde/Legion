# Legion

The code base as seen in https://legion.di.fct.unl.pt.

### Installation
You will need node (npm) [https://nodejs.org/en/] and openssl [https://www.openssl.org].
During installation you will be asked for details to create a certificate.
Each of these can be left empty (just press enter).

To install run:

```sh
git clone https://github.com/albertlinde/Legion
cd Legion
npm install #obtains required dependencies and setups development keys.
```

To install existing games built on top of legion:
```sh
cd applications #these folders are expected in the applications folder.
git clone https://bitbucket.org/pfouto/legion-shooter.git
git clone https://bitbucket.org/pfouto/pacman-mp.git
```

### Running

Startup now runs on ports 80 and 443.
This requires running with sudo!

If you whish to use other ports (that don't require sudo) change the ./framework/server/config.js file.

To run the servers:
```sh
cd ./framework/server/
sudo node ProdServer.js #http and signalling
sudo node ObjectsServer.js #object storage
```

Opening https://localhost in your browser will give the same page as https://legion.di.fct.unl.pt.
This will give a warning as you are currently using self signed certificates (https://letsencrypt.org lets you obtain free certificates for deployment).

### Development

 - /applications contains example applications.
    - Please only refer to examples/index.html. Other pages have working source but not updated textual content.
 - /framework contains legion.
 - /framework/client has client only code.
 - /framework/client/protocols has overlay and messaging protocols.
 - /framework/server has server (NodeJS) code.
 - /framework/shared has code used by both client and server.
 - /framework/shared/dataStructures has used data-structure implementations.
 - /framework/shared/crdtLib has CRDT implementations.
 - /extensions/ currently has Google Drive Realtime adapter implementations.

```sh
./compile.sh    #builds minified JS files
```

---

### Keys
The folder ./framework/server/keys contains all key files (after running npm install).
To use your own keys, simply replace the existing keys with your own.
Note that running npm will not replace/remove existing keys.

### Sub projects
[**LegionOverlayVis**](https://github.com/albertlinde/LegionOverlayVis) - A simple peer-to-peer overlay network visualisation tool.

---

#### Contact
Albert van der Linde
http://novasys.di.fct.unl.pt/~alinde/

#### License
Apache-2.0
