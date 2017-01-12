//TODO: make this self-contained.
//TODO: re-define security checks
function ServerConnection(server, legion) {

    this.legion = legion;
    this.server = server;
    this.remoteID = this.server.ip + ":" + this.server.port;

    this.socket = new WebSocket("wss://" + this.server.ip + ":" + this.server.port + "");

    var sc = this;
    this.socket.onopen = function open() {
        //console.log("Sending auth request.");
        sc.socket.send(legion.secure.getServerAuthenticationChallenge());
    };

    this.socket.onmessage = function (event) {
        console.log("MS1:" + event.data.length);
        console.info("MS2:" + event.data);
        //console.log("MS:" + event.data.length);
        var m = JSON.parse(event.data);
        //console.info("MS:" + event.data);

        if (m.auth) {
            //console.log("Got " + m.auth.currentKey + ".");
            legion.secure.gotServerAuthenticationResult(m.auth);
            if (m.auth.result == "Success") {
                sc.legion.connectionManager.onOpenServer(sc);
            }
        } else {
            //console.log("Got " + m.type + " from " + sc.remoteID + " s: " + m.s);
            var original = JSON.parse(event.data);
            sc.legion.messagingAPI.onMessage(sc, m, original);
        }
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

ServerConnection.prototype.close = function () {
    this.socket.close();
};
ServerConnection.prototype.isAlive = function () {
    return this.socket && this.socket.readyState == WebSocket.OPEN;
};

ServerConnection.prototype.send = function (message) {
    //TODO: define and confirm message type
    if (message.N) {
        //No op. Server will handle it.
    }
    if (typeof message == "object") {
        message = JSON.stringify(message);
    }
    if (this.socket.readyState == WebSocket.OPEN) {
        //console.log("Sent " + JSON.parse(message).type + " to " + this.remoteID + " s: " + JSON.parse(message).s);
        this.socket.send(message);
    }
};