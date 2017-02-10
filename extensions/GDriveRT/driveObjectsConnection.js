//TODO: we could shrink this thing nicely.
// -- from N ops & deltas to a single delta. add current full delta to the end then remove stuff up to there.
function GDriveRTObjectsServerConnection(argument, objectStore, legion) {
    this.argument = argument;
    this.objectStore = objectStore;
    this.legion = legion;
    this.lru = legion.lru;
    this.remoteID = this.lru.FileID_Objects;

    if (!this.lru.ready)
        return;

    this.onclose = function () {
        sc.legion.connectionManager.onCloseServer(sc);
    };

    this.document = null;
    this.model = null;
    var sc = this;
    this.startup();
}

GDriveRTObjectsServerConnection.prototype.startup = function () {
    var sc = this;
    this.lru.realtimeUtils.load(this.lru.FileID_Objects.replace('/', ''), function (doc) {
        sc.document = doc;
        sc.model = doc.getModel();
        sc.legion.connectionManager.onOpenServer(sc);
    }, function () {
        console.error("File init should have been done!");
    });

};

GDriveRTObjectsServerConnection.prototype.close = function () {
    this.document.close();
    this.document = null;
    this.model = null;
    this.onclose();
};

/**
 * Receives compressed message!
 * @param message
 */
GDriveRTObjectsServerConnection.prototype.send = function (message) {
    message = JSON.parse(message);
    switch (message.type) {
        case (this.objectStore.handlers.peerSync.type):
            this.onSendPeerSync();
            return;
        case (this.objectStore.handlers.peerSyncAnswer.type):
            this.onSendPeerSyncAnswer();
            return;
        case (this.objectStore.handlers.gotContentFromNetwork.type):
            this.onServerContentFromNetwork(message);
    }
};

function extractMetaFrom(rootMapOps, type, returnAsMaps) {
    //{added: this.state.added.toArray(), removed: this.state.removed.toArray()}
    if (type != "Map") {
        console.error("Not implemented.")
    } else {
        var added = new ALMap();
        var removed = new ALMap();
        for (var i = 0; i < rootMapOps.length; i++) {
            if (rootMapOps[i].d) {
                var ads = rootMapOps[i].m.a;
                var rms = rootMapOps[i].m.r;
                var m, j;
                for (j = 0; j < ads.length; j++) {
                    m = ads[j];
                    added.set(m[0], Math.max(m[1], added.get(m[0])));
                }
                for (j = 0; j < rms.length; j++) {
                    m = rms[j];
                    removed.set(m[0], Math.max(m[1], removed.get(m[0])));
                }
            } else {
                var replica = rootMapOps[i].opID.rID;
                var opNum = rootMapOps[i].opID.oC;
                var key = rootMapOps[i].key;
                if (key == "set") {
                    if (added.get(replica))
                        added.set(replica, Math.max(opNum, added.get(replica)));
                    else {
                        added.set(replica, opNum)
                    }
                } else if (key == "delete") {
                    if (removed.get(replica)) {
                        removed.set(replica, Math.max(opNum, removed.get(replica)));
                    } else {
                        removed.set(replica, opNum);
                    }
                } else {
                    console.error("No operation for " + type, rootMapOps[i], rootMapOps);
                }
            }
        }
        if (!returnAsMaps) {
            return {
                a: added.toArray(),
                r: removed.toArray()
            };
        }
        else {
            return [added, removed];
        }
    }
}

/**
 * Skip the sync part. Apply remote ops to crdts directly and add crdt changes to remote.
 */
GDriveRTObjectsServerConnection.prototype.onSendPeerSync = function () {
    var start = Date.now();
    console.log("Starting GDriveRTObjectsServerConnection SYNC");
    var dc = this;
    var rootMap = this.model.getRoot().get('RootMap');
    var rootMapOps = rootMap.asArray();
    if (rootMapOps.length == 0) {
        console.info("Waiting on server sync.");
        setTimeout(function () {
            dc.onSendPeerSync();
        }, 100);
    }
    var localRootMap = this.objectStore.getOrCreate("RootMap", this.legion.Map);

    for (var o = 0; o < rootMapOps.length; o++) {
        var op = rootMapOps[o];
        console.info(op);
        if (op.opID) {
            localRootMap.deltaOperationFromNetwork(op, this);
        } else if (op.d) {
            localRootMap.deltaFromNetwork(op, this);
        } else {
            console.error(op);
            console.error(o);
            console.error(rootMapOps);
        }
    }
    var rootMeta = extractMetaFrom(rootMapOps, "Map");

    var deltaToSend = localRootMap.getDelta([], rootMeta);
    if (deltaToSend) {
        var metaToSend = localRootMap.getMeta();
        var vvToSend = localRootMap.versionVector.toJSONString();
        var flattened = {d: deltaToSend, vv: vvToSend, m: metaToSend};
        rootMap.insert(rootMap.length, flattened);
    }
    var objectKeys = localRootMap.keys();
    for (var i = 0; i < objectKeys.length; i++) {
        var objectKey = objectKeys[i];
        if (this.document.getModel().getRoot().get(objectKey)) {
            var t = this;
            (function (objectKey) {
                var objectList = t.document.getModel().getRoot().get(objectKey);
                if (objectList) {
                    console.log("Object: ", objectKey);
                    //console.log("ObjectList: ", objectList.asArray());
                    console.log("Object Type: ", localRootMap.get(objectKey)[0]);

                    objectList.addEventListener(gapi.drive.realtime.EventType.VALUES_ADDED, function (evt) {
                        var m_list = [];
                        for (var j = 0; j < evt.values.length; j++) {
                            m_list.push(evt.values[j]);
                        }
                        dc.operationsFromDocument(objectKey, m_list)
                    });

                    var objectListAsArray = objectList.asArray();
                    var localObject;
                    switch (localRootMap.get(objectKey)[0]) {
                        case "Map":
                            console.log("Create map.");
                            localObject = t.objectStore.getOrCreate(objectKey, dc.legion.Map);
                            break;
                        default :
                            console.error("Not implemented.");
                            return;
                    }

                    for (var o = 0; o < objectListAsArray.length; o++) {
                        var op = objectListAsArray[o];
                        if (op.opID) {
                            localObject.deltaOperationFromNetwork(op, this);
                        } else if (op.d) {
                            localObject.deltaFromNetwork(op, this);
                        } else {
                            console.error(op);
                            console.error(o);
                            console.error(objectListAsArray);
                        }
                    }
                    var rootMeta = extractMetaFrom(objectListAsArray, "Map");

                    var deltaToSend = localObject.getDelta([], rootMeta);
                    if (deltaToSend) {
                        var metaToSend = localObject.getMeta();
                        var vvToSend = localObject.versionVector.toJSONString();
                        var flattened = {d: deltaToSend, vv: vvToSend, m: metaToSend};
                        objectList.insert(objectList.length, flattened);
                    }
                }
            })(objectKey);
        }
    }

    //override peerSync checks and finalize sync:
    this.objectStore.objectServer.isSynced = true;
    this.objectStore.objectServer.sentS = true;
    this.objectStore.objectServer.sentSA = true;
    clearTimeout(this.objectStore.objectServer.psTimeout);
    this.objectStore.objectServer.clearQueue();

    console.log("TT: Ending GDriveRTObjectsServerConnection SYNC: " + (start - Date.now()));
};

GDriveRTObjectsServerConnection.prototype.operationsFromDocument = function (objectKey, operations) {
    var start = Date.now();
    console.log(objectKey);
    var crdt = this.objectStore.crdts.get(objectKey);
    for (var i = 0; i < operations.length; i++) {
        var op = operations[i];
        console.log(op);
        if (op.opID) {
            crdt.deltaOperationFromNetwork(op, this);
        } else if (op.d) {
            crdt.deltaFromNetwork(op, this);
        } else {
            console.error(objectKey);
            console.error(op);
            console.error(i);
            console.error(operations);
        }
    }
    console.log("TT: opsFrom: " + (start - Date.now()))
};


GDriveRTObjectsServerConnection.prototype.onSendPeerSyncAnswer = function (message) {
    console.error("Won't be called.");
};

GDriveRTObjectsServerConnection.prototype.driveListHasOP = function (oid, list, opOrDelta) {
    var start = Date.now();
    var rootMetas = extractMetaFrom(list, "Map", true);
    var added = rootMetas[0];
    var removed = rootMetas[1];
    if (opOrDelta.opID) {
        if (opOrDelta.key == "set") {
            return added.get(opOrDelta.opID.rID) && (added.get(opOrDelta.opID.rID) >= opOrDelta.opID.oC)
        } else if (opOrDelta.key == "delete") {
            return removed.get(opOrDelta.opID.rID) && (removed.get(opOrDelta.opID.rID) >= opOrDelta.opID.oC)
        } else {
            console.error("No key for this.", oid, list, opOrDelta, rootMetas);
        }
    } else if (opOrDelta.d) {
        var meta = opOrDelta.m;
        var myAdds = meta.a;
        var myRemoves = meta.r;

        var i;
        for (i = 0; i < myAdds.length; i++) {
            if (added.get(myAdds[i][0]) && added.get(myAdds[i][0]) >= myAdds[i][1]) {

            } else {
                return false;
            }
        }
        for (i = 0; i < myRemoves.length; i++) {
            if (removed.get(myRemoves[i][0]) && removed.get(myRemoves[i][0]) >= myRemoves[i][1]) {

            } else {
                return false;
            }
        }
        return true;
    } else {
        console.error("ERROR: driveListHasOP");
        console.error(oid);
        console.error(list);
        console.error(rootMetas);
        console.error(opOrDelta);
        console.error("ERROR: driveListHasOP");
    }
    console.log("TT: hasops: " + (start - Date.now()))
};

GDriveRTObjectsServerConnection.prototype.onServerContentFromNetwork = function (message) {
    var start = Date.now();
    var objects = message.data;
    for (var i = 0; i < objects.length; i++) {
        var objectID = objects[i].objectID;
        if (!objectID) {
            console.error("Found no", message, i)
        } else {
            var objectList = this.document.getModel().getRoot().get(objectID);
            if (objects[i].fd) {
                if (!this.driveListHasOP(objectID, objectList.asArray(), objects[i].fd)) {
                    console.log("Adding FD to drive list.");
                    objectList.insert(objectList.length, objects[i].fd);
                }
            } else if (objects[i].opID) {
                var arr = objectList.asArray();
                if (!this.driveListHasOP(objectID, arr, objects[i])) {
                    console.log("Adding OP to drive list: " + arr.length);
                    var queuedOP = {
                        objectID: objectID,
                        opID: objects[i].opID,
                        arg: objects[i].arg,
                        key: objects[i].key
                    };
                    objectList.insert(objectList.length, queuedOP);
                }
            } else {
                console.error("onServerContentFromNetwork", message)
            }
        }
    }
    console.log("TT: onServerContentFromNetwork: " + (start - Date.now()))
};
