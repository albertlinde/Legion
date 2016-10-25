# Legion

The Legion code base.

### Installation
You need node (npm) [https://nodejs.org/en/].
```sh
$ git clone https://github.com/albertlinde/Legion
$ cd Legion
$ npm install #obtains required dependencies
$ ./compile.sh #creates minified .js files
```

### Running
```sh
$ npm start
```
**Start** starts HTTP, Signalling and Objects servers. \
Open localhost:8000 in your browser.

```sh
$ npm stop
```
**Stop** shuts down all servers.
Logs can be found in the folder **run**.

### Development

 - /applications contains example applications.
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

**WIP:**
* Currently re-building the examples to make them easier to understand. 

### Sub projects
[**LegionOverlayVis**](https://github.com/albertlinde/LegionOverlayVis) - A peer-to-peer overlay network visualisation tool.

#### Contact
Albert van der Linde http://novasys.di.fct.unl.pt/~alinde/

#### License
Apache-2.0
