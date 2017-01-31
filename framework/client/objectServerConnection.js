//TODO: logging control
function ObjectServerConnection(server, objectStore, legion) {
    this.server = server;
    this.objectStore = objectStore;
    this.legion = legion;
    this.remoteID = this.server.ip + ":" + this.server.port;

    try {
        this.socket = new WebSocket("wss://" + this.server.ip + ":" + this.server.port + "");
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
        //console.log("MO1:" + event.data.length);
        //console.info("MO2:" + event.data);
        var m = JSON.parse(event.data);
        sc.objectStore.onMessageFromServer(m, sc);
    };

    this.socket.onclose = function () {
        if (!sc.sentClose) {
            sc.sentClose = true;
            sc.legion.connectionManager.onCloseServer(sc);
        }
    };

    this.socket.onerror = function (event) {
        console.error("WebSocket could not contact: " + sc.remoteID + ". Maybe the server is offline?");
        if (!sc.sentClose) {
            sc.sentClose = true;
            sc.legion.connectionManager.onCloseServer(sc);
        }
    };
    this.sentClose = false;

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
        //console.log("Sent " + JSON.parse(message).type + " to " + this.remoteID + " s: " + JSON.parse(message).s);
        this.socket.send(message);
    }
};

/**
 * Sends the passed string, as is, to the socket.
 * @param string {String}
 */
ObjectServerConnection.prototype.sendToSocket = function (string) {
    if (this.socket.readyState == WebSocket.OPEN) {
        //console.log("Sent " + JSON.parse(message).type + " to " + this.remoteID + " s: " + JSON.parse(message).s);
        this.socket.send(message);
    }
};