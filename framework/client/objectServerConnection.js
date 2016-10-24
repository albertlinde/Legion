//TODO: logging control
function ObjectServerConnection(server, objectStore, legion) {
    this.server = server;
    this.objectStore = objectStore;
    this.legion = legion;
    this.remoteID = this.server.ip + ":" + this.server.port;

    //TODO: wss or at the least, support for.
    try {
        this.socket = new WebSocket("ws://" + this.server.ip + ":" + this.server.port + "");
    } catch (e) {

    }
    var sc = this;
    this.socket.onopen = function open() {
        //TODO: where is this explained?
        sc.legion.generateMessage("CLIENT_ID", null, function (result) {
            result.clientID = sc.legion.id;
            sc.send(JSON.stringify(result));
        });
        sc.legion.connectionManager.onOpenServer(sc);
    };

    this.socket.onmessage = function (event) {
        console.log("MO:" + event.data.length);
        var m = JSON.parse(event.data);
        console.info("MO:" + event.data);
        //console.log("Got " + m.type + " from " + sc.remoteID + " s: " + m.sender);
        var original = JSON.parse(event.data);
        if (m.compressed) {
            decompress(m.compressed, function (result) {
                m.data = JSON.parse(result);
                sc.objectStore.onMessageFromServer(m, original, sc);
            });
        } else {
            sc.objectStore.onMessageFromServer(m, original, sc);
        }
    };

    this.socket.onclose = function () {
        sc.legion.connectionManager.onCloseServer(sc);
    };

    this.socket.onerror = function (event) {
        console.log("ServerSocket Error", event);
        sc.legion.connectionManager.onCloseServer(sc);
    };

}

ObjectServerConnection.prototype.close = function () {
    this.socket.close();
};

ObjectServerConnection.prototype.send = function (message) {
    //TODO: define and confirm message type
    if (typeof message == "object") {
        message = JSON.stringify(message);
    }
    if (this.socket.readyState == WebSocket.OPEN) {
        //console.log("Sent " + JSON.parse(message).type + " to " + this.remoteID + " s: " + JSON.parse(message).sender);
        this.socket.send(message);
    }
};