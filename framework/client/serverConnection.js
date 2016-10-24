//TODO: make this self-contained.
//TODO: re-define security checks
function ServerConnection(server, legion) {

    this.legion = legion;
    this.server = server;
    this.remoteID = this.server.ip + ":" + this.server.port;

    this.socket = new WebSocket("ws://" + this.server.ip + ":" + this.server.port + "");

    var sc = this;
    this.socket.onopen = function open() {
        //console.log("Sending auth request.");
        sc.socket.send(legion.secure.getServerAuthenticationChallenge());
    };

    this.socket.onmessage = function (event) {
        console.log("MS:" + event.data.length);
        var m = JSON.parse(event.data);
        console.info("MS:" + event.data);

        if (m.auth) {
            //console.log("Got " + m.auth.currentKey + ".");
            legion.secure.gotServerAuthenticationResult(m.auth);
            if (m.auth.result == "Success") {
                sc.legion.connectionManager.onOpenServer(sc);
            }
        } else {
            //console.log("Got " + m.type + " from " + sc.remoteID + " s: " + m.sender);
            var original = JSON.parse(event.data);
            if (m.compressed && (!m.destination || (m.destination && m.destination == sc.legion.id))) {
                decompress(m.compressed, function (result) {
                    m.data = JSON.parse(result);
                    sc.legion.messagingAPI.onMessage(sc, m, original);
                });
            } else {
                decompress("5d00000100040000000000000000331849b7e4c02e1ffffac8a000", function (result) {
                    sc.legion.messagingAPI.onMessage(sc, m, original);
                });
            }
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
        //console.log("Sent " + JSON.parse(message).type + " to " + this.remoteID + " s: " + JSON.parse(message).sender);
        this.socket.send(message);
    }
};