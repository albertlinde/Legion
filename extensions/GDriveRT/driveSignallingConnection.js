var B2B_MAP = "b2bmap";
function GDriveRTSignallingServerConnection(argument, legion) {
    console.error("a")
    this.argument = argument;
    this.legion = legion;
    this.lru = legion.lru;
    this.remoteID = "GDriveRTSigServ";

    var sc = this;

    this.onclose = function () {
        this.legion.connectionManager.onCloseServer(this);
    };

    this.lru.realtimeUtils.load(this.lru.FileID_Overlay.replace('/', ''), function (doc) {
        sc.document = doc;
        sc.model = doc.getModel();
        if (sc.lru.legion.id == "TEMP_ID")
            sc.setID();
        sc.map = sc.document.getModel().getRoot().get(B2B_MAP);
        sc.Dmap = sc.document.getModel().getRoot().get("DM");
        sc.legion.secure.setKey(sc.map.get("1"));
        //TODO: listener on map: if K:Key -> update key

        sc.initOverlay();

    }, function (model) {
        //console.info("load: B");
        var key = {};
        key.id = "1";
        key.key = forge.random.getBytesSync(16);
        key.iv = forge.random.getBytesSync(16);
        var map = model.createMap({
            B2B_MAP: B2B_MAP,
            "1": key
        });
        model.getRoot().set(B2B_MAP, map);

        //used to store distance vectors.
        var map2 = model.createMap();
        model.getRoot().set("DM", map2);

        sc.lru.createKeyFile(key);
        sc.lru.legion.secure.setKey(key);

    });
    //console.info("load: C");

}

GDriveRTSignallingServerConnection.prototype.close = function () {
    this.map.delete(this.lru.legion.id);
    this.Dmap.delete(this.legion.id);
    this.send = function () {
        console.warn("Tried to send while shutting down.");
    };
    this.messageList.clear();
    this.map = null;
    this.Dmap = null;
    this.onclose();

    var a = this;
    setTimeout(function () {
        a.messageList.clear();
        a.document.close();
        a.messageList = null;
        a.document = null;
    }, 1000);
};

GDriveRTSignallingServerConnection.prototype.initOverlay = function () {
    var sc = this;
    console.info("initOverlay");
    this.map = this.document.getModel().getRoot().get(B2B_MAP);
    this.Dmap = this.document.getModel().getRoot().get("DM");

    this.messageList = this.model.getRoot().get(this.lru.legion.id);
    if (!this.messageList) {
        console.log("Init a new message list.");
        this.messageList = this.model.createList();
        this.model.getRoot().set(this.lru.legion.id, this.messageList);
    }
    this.map.set(this.lru.legion.id, this.messageList);

    this.messageList.addEventListener(gapi.drive.realtime.EventType.VALUES_ADDED, function (evt) {

        var m_list = [];
        for (var i = 0; i < evt.values.length; i++) {
            m_list.push(JSON.parse(sc.messageList.get(0)));
            sc.messageList.remove(0);
        }
        for (var i = 0; i < m_list.length; i++) {
            (function (i) {
                console.info(m_list[i]);
                decompress(m_list[i].compressed, function (result) {
                    var message = m_list[i];
                    message.data = JSON.parse(result);

                    sc.legion.messagingAPI.onMessage(sc, message, m_list[i]);
                });
            })(i);
        }
    });
    this.messageList.addEventListener(gapi.drive.realtime.EventType.VALUES_REMOVED, function (evt) {
        ////console.error("List VALUES_REMOVED");
    });
    this.messageList.addEventListener(gapi.drive.realtime.EventType.VALUES_SET, function (evt) {
        console.error("List VALUES_SET");
    });

    this.legion.connectionManager.onOpenServer(this);
    console.info("initOverlay done");
};

GDriveRTSignallingServerConnection.prototype.setID = function () {
    function getMyIDFrom(collaborators) {
        for (var i = 0; i < collaborators.length; i++) {
            if (collaborators[i].isMe) {
                return {session: collaborators[i].sessionId, user: collaborators[i].userId};
            }
        }
    }

    var temp_id = getMyIDFrom(this.document.getCollaborators());
    var id = temp_id.session;
    console.log("Old ID: " + this.legion.id);
    this.legion.id = id;
    console.log("New ID: " + this.legion.id);
};

GDriveRTSignallingServerConnection.prototype.isAlive = function () {
    //TODO: where is this used?
    return (typeof this.document != "undefined") && (this.document != null && !this.document.isClosed);
};

GDriveRTSignallingServerConnection.prototype.send = function (message) {
    console.info("GDriveRTSignallingServerConnection:send", message.type);
    var sc = this;
    if (this.isAlive()) {
        decompress(message.compressed, function (result) {
            message.data = JSON.parse(result);
            sc.gotSomethingtoSend(message);
        });
    } else {
        console.error("Not alive and still sending.");
    }
};

GDriveRTSignallingServerConnection.prototype.gotSomethingtoSend = function (message) {
    switch (message.type) {
        case "ConnectRequest":
            this.distances = message.data.distances;
            this.Dmap.set(this.legion.id, message.data.distances);
            var data = message.data;
            var doneClose = data.close < 1;
            var doneFar = data.far < 1;

            var sent = false;
            var possiblePeerKeys = this.Dmap.keys();

            for (var i = 0; i < (possiblePeerKeys.length + 5) && possiblePeerKeys.length > 0 && !sent && (!doneClose || !doneFar); i++) {
                possiblePeerKeys = this.Dmap.keys();
                var randomPos = Math.floor(possiblePeerKeys.length * Math.random());
                if (possiblePeerKeys[randomPos] == this.legion.id) {
                    continue;
                }
                if (this.legion.overlay.getPeer(possiblePeerKeys[randomPos])) {
                    continue;
                }
                var actualDistance = distanceFunction(this.distances, this.Dmap.get(possiblePeerKeys[randomPos]));

                if (actualDistance <= 1 && !doneClose) {
                    console.log("      -> Connecting to close node " + possiblePeerKeys[randomPos]);
                    this.connectToClose(possiblePeerKeys[randomPos]);
                    sent = true;
                    doneClose = true;
                }

                if (actualDistance > 1 && !doneFar) {
                    console.log("      -> Connecting to far node " + possiblePeerKeys[randomPos]);
                    this.connectToFar(possiblePeerKeys[randomPos]);
                    sent = true;
                    doneFar = true;
                }
            }
            break;
        case "DistancesUpdate":
            this.distances = message.data.distances;
            this.Dmap.set(this.legion.id, message.data.distances);
            break;
        default:

            if (message.destination) {
                if (message.s != this.legion.id) {
                    return;
                }
                var peerMessageList = this.map.get(message.destination);
                if (peerMessageList) {
                    console.log("Drive S Sending toR: " + message.destination);
                    peerMessageList.push(JSON.stringify(message));
                } else {
                    console.warn("Can't send to: " + message.destination);
                }
            } else {
                console.error("Nothing implemented for: " + message.type);
            }
    }
};

GDriveRTSignallingServerConnection.prototype.connectToClose = function (nodeID) {
    this.legion.overlay.overlayProtocol.futureCloseNodes.push(nodeID);
    this.legion.connectionManager.connectPeer(nodeID);
};

GDriveRTSignallingServerConnection.prototype.connectToFar = function (nodeID) {
    this.legion.overlay.overlayProtocol.futureFarNodes.push(nodeID);
    this.legion.connectionManager.connectPeer(nodeID);
};
