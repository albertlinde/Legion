var DEFAULT_PEER_INIT_TIMEOUT = 15 * 1000;

var KEEP_ALIVE_INTERVAL = 10000;
//TODO: constants should not be here.
//TODO:  optimize sdp.
//TODO: also send the current key id-> if receive a higher number then re-join the network.
var KEEP_ALIVE_MESSAGE = {type: "ka"};
var KEEP_ALIVE_MUST_HAVE = 30000;
var detailedDebug = false;
function PeerConnection(remoteID, legion) {
    if (detailedDebug) {
        console.log("PC from " + legion.id + " to " + remoteID);
    }
    this.remoteID = remoteID;
    this.legion = legion;
    this.peer = new RTCPeerConnection(servers, pcConstraint);
    this.channel = null;

    var pc = this;
    this.init_timeout = setTimeout(function () {
        pc.onInitTimeout()
    }, DEFAULT_PEER_INIT_TIMEOUT);

    this.unique = null;

    this.lastKeepAlive = Date.now();
    this.keepAliveInterval = setInterval(function () {
        pc.keepAlive()
    }, KEEP_ALIVE_INTERVAL);
}

PeerConnection.prototype.keepAlive = function () {
    if (this.lastKeepAlive + KEEP_ALIVE_MUST_HAVE < Date.now()) {
        console.warn("Peer " + this.legion.id + " keepAlive timeout from " + this.remoteID + ".");
        if (this.isAlive())
            this.channel.close();
        clearInterval(this.keepAliveInterval);
    } else {
        this.send(KEEP_ALIVE_MESSAGE);
    }
};

PeerConnection.prototype.onInitTimeout = function () {
    //TODO: confirm startup failure control. (and cancellALll)
    console.warn("Peer " + this.legion.id + " connection timeout before getting offer from " + this.remoteID + ".");
    this.cancelAll(true);
};

PeerConnection.prototype.setChannelHandlers = function () {
    var pc = this;
    this.channel.onmessage = function (event) {
        console.log("M1:" + event.data.length);
        var deciphered = pc.legion.secure.decipher(event.data, pc, event);
        if (!deciphered) {
            console.error("Decipher returned no value.");
        }
        if (deciphered === true)return;
        var m = JSON.parse(deciphered);
        console.info("M2:" + deciphered.length);
        console.info("M3:" + deciphered);
        if (!m) {
            console.error(deciphered);
            console.error(event.data);
            console.error(event.data);
        }
        if (m.type == KEEP_ALIVE_MESSAGE.type) {
            pc.lastKeepAlive = Date.now();
            return;
        }
        //console.log("Got " + m.type + " from " + pc.remoteID + " s: " + m.s);
        var original = JSON.parse(deciphered);
        pc.legion.messagingAPI.onMessage(pc, m, original);
    };
    this.channel.onopen = function (event) {
        clearTimeout(pc.init_timeout);
        pc.legion.connectionManager.onOpenClient(pc);
    };
    this.channel.onclose = function (event) {
        pc.legion.connectionManager.onCloseClient(pc);
        clearInterval(this.keepAliveInterval);
    };
};

/**
 * This method is called to remove a concurrently created and started PeerConnection.
 * Used by timeout on getting offers with argument true.
 */
PeerConnection.prototype.cancelAll = function (notDuplicate) {
    var pc = this;
    if (!notDuplicate)
        if (this.channel)
            this.channel.onclose = function () {
                console.log("Forced a channel close for duplicate PeerConnection.", pc.legion.id, pc.remoteID);
            };
    this.channel = null;
    this.peer.close();
    clearTimeout(this.init_timeout);
    clearInterval(this.keepAliveInterval);
    this.peer = null;
    this.legion.connectionManager.onCloseClient(this);
};

PeerConnection.prototype.returnOffer = function (offer) {
    if (detailedDebug) console.log(offer);
    this.peer.setRemoteDescription(new RTCSessionDescription(offer));
};

PeerConnection.prototype.return_ice = function (candidate) {
    if (detailedDebug) console.log(candidate);
    var pc = this;
    this.peer.addIceCandidate(new RTCIceCandidate(candidate),
        function () {
            /*success*/
        },
        function (error) {
            //This occurs when an ICE candidate is received for a previous offer.
            //This means that concurrently two peers tried to start, and one won.
            //Messages that were in route can't magically be removed.
            //i.e., dont worry if connection are still made.
            console.warn("onAddIceCandidateError", pc.legion.id, pc.remoteID, error, candidate);
        }
    );
};

PeerConnection.prototype.onicecandidate = function (event) {
    if (event.candidate) {

        this.legion.connectionManager.sendICE(event.candidate, this.unique, this);
    }
};

/**
 *
 */
PeerConnection.prototype.close = function () {
    this.cancelAll(true);
};

PeerConnection.prototype.startLocal = function () {
    if (debug) console.log("start local: " + this.remoteID);
    var pc = this;
    this.channel = this.peer.createDataChannel('sendDataChannel', dataConstraint);


    this.unique = this.legion.randInt(2) + 1;
    this.setChannelHandlers();

    this.peer.onicecandidate = function (event) {
        pc.onicecandidate(event);
    };

    this.peer.createOffer(function (offer) {

            pc.peer.setLocalDescription(offer);
            pc.legion.connectionManager.sendStartOffer(offer, pc.unique, pc);
        }, function (error) {
            console.error("onCreateSessionDescriptionError", error);
            pc.onclose()
        }
    );
};

PeerConnection.prototype.startRemote = function (offer, unique) {
    this.unique = unique;
    if (detailedDebug) console.log(offer);
    if (debug) console.log("start remote: " + this.remoteID);
    this.peer.setRemoteDescription(new RTCSessionDescription(offer));
    var pc = this;
    this.peer.ondatachannel =
        function (event) {
            pc.channel = event.channel;
            pc.setChannelHandlers();
        };

    this.peer.onicecandidate = function (event) {
        pc.onicecandidate(event);
    };

    this.peer.createAnswer(function (offer) {
        pc.peer.setLocalDescription(offer);
        pc.legion.connectionManager.sendReturnOffer(offer, pc.unique, pc);
    }, function (error) {
        console.error("onCreateSessionDescriptionError", error);
        pc.onclose()
    });
};

PeerConnection.prototype.isAlive = function () {
    return this.channel && this.channel.readyState == "open";
};

PeerConnection.prototype.setMeta = function (m) {
    this.meta = m;
};

PeerConnection.prototype.getMeta = function () {
    return this.meta;
};

PeerConnection.prototype.send = function (message) {
    //TODO: as in serverconnection, check message type
    if (typeof message == "object") {
        message = JSON.stringify(message);
    }
    if (this.channel && this.channel.readyState == "open") {
        var ciphered = this.legion.secure.cipher(message);
        if (this.channel && this.channel.readyState == "open") {
            this.channel.send(ciphered);
            //console.log("Sent " + JSON.parse(message).type + " to " + this.remoteID + " s: " + JSON.parse(message).s);
        } else {
            this.close();
            console.warn("Peer has no open channel.")
        }
    } else {
        this.close();
        console.warn("Peer has no open channel.")
    }
};

//TODO: the following should not be here:
/**
 * WebRTC parameters.
 */
{
    var servers = {
        iceServers: [{"url": "stun:stun.l.google.com:19302"}]
    };
    var pcConstraint = {
        optional: [{
            RtpDataChannels: false
        }]
    };
    var dataConstraint = null;

}

