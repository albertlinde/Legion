var debug = false;
var objectsDebug = false;
var detailedDebug = false;
var bullyLog = false;

function LegionRealtimeUtils(realtimeUtils) {
    //TODO: check timers, currently setup time is to long!
    //TODO: Lists have been removed (diff was to slow).
    //TODO: Strings have been removed (diff was to slow).
    this.realtimeUtils = realtimeUtils;

    this.legion = null;
    this.objectStore = null;
    this.ready = false;

    this.merge_to_legacy = true;
    this.signalling_on_legacy = true;
    this.persitence_on_legacy = true;

    /**
     * Used by all to obtains other files.
     * @type {String, null}
     */
    this.FileID_Original = null;
    /**
     * Used by all to join overlays.
     * @type {String, null}
     */
    this.FileID_Overlay = null;
    /**
     * Used by some (bullies) to ensure persistence.
     * @type {String, null}
     */
    this.FileID_Objects = null;

    this.FileID_Merge = null;

    this.FileID_KeyList = null;

    /**
     * Keeps key-value in the form crdtID-crdtType.
     * @type {CRDT}
     */
    this.map = null;

    this.constants = {
        FileID_Overlay: "FileID_Overlay",
        FileID_Objects: "FileID_Objects",
        FileID_Merge: "FileID_Merge",
        FileID_MainBully: "FileID_MainBully",
        FileID_KeyList: "FileID_KeyList",
        objectsMap: "RootMap",
        WAIT_ON_MAP_INIT: 20 * 1000,
        WAIT_ON_MAP_INIT_LEGION_ONLY: 15 * 1000
    };


    this.mergeUtils = new MergeUtils(this);
    //TODO: not all revisions should be kept in ram.
    this.revisions = new ALMap();
}
/**
 *
 * @param fileID {String}
 * @param onLoad {Function}
 * @param onInit {Function}
 */
LegionRealtimeUtils.prototype.load = function (fileID, onLoad, onInit) {
    this.FileID_Original = fileID;
    this.onInit = onInit;

    if (!this.signalling_on_legacy) {
        this.gotOverlayFile(onLoad);
    } else {
        var lru = this;
        if (!gapi.client.drive)
            gapi.client.load('drive', 'v2', function () {
                lru.load(fileID, onLoad, onInit);
            });
        else {
            getPropertyFromFile(fileID, lru.constants.FileID_Overlay, function (property) {
                if (!property) {
                    lru.realtimeUtils.load(fileID, function (document) {
                        document.close();
                        lru.realtimeUtils.createRealtimeFile(lru.constants.FileID_Overlay, function (createResponse) {
                            addPropertyToFile(fileID, lru.constants.FileID_Overlay, createResponse.id, function () {
                                lru.load(fileID, onLoad, onInit);
                            });
                        });
                    }, function (arg) {
                        console.log("File init: " + fileID);
                        onInit(arg);
                    });
                } else {
                    lru.FileID_Overlay = property;
                    lru.gotOverlayFile(onLoad);
                }
            });
        }
    }
};

/**
 *
 * @param onLoad {Function}
 */
LegionRealtimeUtils.prototype.gotOverlayFile = function (onLoad) {

    var signalling;
    var signallingServer;
    var clientID = ("" + Math.random()).substr(2, 4);

    var persistence;
    var persistenceServer;
    var secureServer;
    var bullyProtocol;

    if (!this.persitence_on_legacy) {
        persistence = ObjectServerConnection;
        persistenceServer = {ip: "54.67.55.30", port: 8004};
    } else {
        persistence = GDriveRTObjectsServerConnection;
        persistenceServer = {};
    }

    if (!this.signalling_on_legacy) {
        signalling = ServerConnection;
        signallingServer = {ip: "54.67.55.30", port: 8002};
        secureServer = SecurityProtocol;
        bullyProtocol = ServerBully;
    } else {
        signalling = GDriveRTSignallingServerConnection;
        signallingServer = {};
        clientID = "TEMP_ID";
        secureServer = GDriveRTSecurityProtocolServerConnection;
        bullyProtocol = SimpleBully;
    }

    var options = {
        clientID: clientID,
        overlayProtocol: {
            type: GeoOptimizedOverlay,
            parameters: {
                locator: HTTPPinger,
                locations: ["http://ec2.us-east-1.amazonaws.com", "http://ec2.us-east-2.amazonaws.com", "http://ec2.us-west-1.amazonaws.com", "http://ec2.us-west-2.amazonaws.com"],
                MIN_CLOSE_NODES: 4,
                MAX_CLOSE_NODES: 7,
                MIN_FAR_NODES: 1,
                MAX_FAR_NODES: 2,
                CLOSE_NODES_TIMER: 6 * 1000,
                FAR_NODES_TIMER: 15 * 1000,
                LOCAL_FAILS_TILL_RESET: 20
            }
        },
        messagingProtocol: FloodMessaging,
        objectOptions: {
            serverInterval: 15000 + Math.ceil(Math.random() * 15000),
            peerInterval: 10
        },
        bullyProtocol: {
            type: bullyProtocol,
            options: {
                bullyMustHaveInterval: 21 * 1000,
                bullySendInterval: 7 * 1000,
                bullyStartTime: 2 * 1000
            }
        },
        signallingConnection: {
            type: signalling,
            server: signallingServer
        },
        objectServerConnection: {
            type: persistence,
            server: persistenceServer
        },
        securityProtocol: secureServer
    };

    this.legion = new Legion(options);
    this.legion.lru = this;
    this.legion.join();

    var c = this;
    this.legion.onJoin(function () {
        c.objectStore = c.legion.getObjectStore();
        c.map = c.objectStore.getOrCreate(c.constants.objectsMap, c.legion.Map);
        c.startObjectsProtocol(onLoad);
    });
};

/**
 *
 * @param onLoad {Function}
 */
LegionRealtimeUtils.prototype.gotMap = function (onLoad) {
    var lru = this;

    var keys = this.map.keys();
    if (keys.length == 0) {
        //console.log("Waiting on map init.");
        setTimeout(function () {
            lru.gotMap(onLoad);
        }, this.constants.WAIT_ON_MAP_INIT);
    } else {
        var objects = [];
        for (var i = 0; i < keys.length; i++) {
            var type = this.map.get(keys[i])[0];
            switch (type) {
                case "Map":
                    console.info("Object init: " + type + " ID: " + keys[i]);
                    objects[keys[i]] = this.objectStore.getOrCreate(keys[i], lru.legion.Map);
                    break;
                case "List":
                    console.info("Object init: " + type + " ID: " + keys[i]);
                    objects[keys[i]] = this.objectStore.getOrCreate(keys[i], lru.legion.Map);
                    break;
                case "String":
                    console.error("Not implemented: strings");
                    break;
            }
        }
        this.interfaceHandler = new GapiInterfaceHandler(objects, this.map);
        var ih = this.interfaceHandler;
        setTimeout(function () {
            onLoad(ih);
        }, 100);
    }
};

/**
 *
 */
LegionRealtimeUtils.prototype.startObjectsProtocol = function (onLoad, doAgain) {
    var rootMap = this.map;
    var lru = this;
    if (!this.persitence_on_legacy) {
        if (!doAgain) {
            var keys = rootMap.keys();
            if (keys.length == 0) {
                setTimeout(function () {
                    if (rootMap.keys().length > 0) {
                        lru.startObjectsProtocol(onLoad, true);
                    } else {
                        //TODO: only one sohuld be able to do this OR make it commutative
                        console.log("Init rootmap.");
                        lru.initRootMap(function () {
                            lru.startObjectsProtocol(onLoad, true);
                        });
                    }
                }, lru.constants.WAIT_ON_MAP_INIT_LEGION_ONLY);
            }
        } else {
            var keys = rootMap.keys();
            if (keys.length == 0) {
                //console.log("Got an empty RootMap.");
                setTimeout(function () {
                    lru.startObjectsProtocol(onLoad, true);
                }, lru.constants.WAIT_ON_MAP_INIT);
            } else {
                lru.ready = true;
                //console.log("Got a filled RootMap.");
                lru.gotMap(onLoad);
                //TODO: merge to legacy timer.
            }
        }
    } else {
        var rootMap = this.map;
        var lru = this;
        var keys = rootMap.keys();
        if (keys.length == 0) {
            //console.log("Got an empty RootMap.");
            if (this.FileID_Objects) {
                this.ready = true;
                setTimeout(function () {
                    lru.startObjectsProtocol(onLoad);
                }, lru.constants.WAIT_ON_MAP_INIT);
            } else {
                getPropertyFromFile(lru.FileID_Original, lru.constants.FileID_Objects, function (property) {
                    if (!property) {
                        lru.checkIfMainBully(function (result) {
                            if (result) {
                                lru.initRootMap(function () {
                                    lru.startObjectsProtocol(onLoad);
                                });
                            } else {
                                //console.log("I am not the main bully, waiting.");
                                setTimeout(function () {
                                    lru.startObjectsProtocol(onLoad);
                                }, lru.constants.WAIT_ON_MAP_INIT);
                            }
                        });
                    } else {
                        lru.FileID_Objects = property;
                        lru.startObjectsProtocol(onLoad);
                    }
                });
            }
        } else {
            this.ready = true;
            //console.log("Got a filled RootMap.");
            this.gotMap(onLoad);
            if (lru.merge_to_legacy) {
                setInterval(function () {
                    lru.checkIfMainBully(function (result) {
                        if (result) {
                            console.log("Try to write to Merge and Original file.");
                            lru.mergeFiles();
                        } else {
                            //console.log("Won't to write to Merge and Original file.");
                        }
                    });
                }, 30 * 1000);
            }
        }
    }
};

/**
 *
 */
LegionRealtimeUtils.prototype.mergeFiles = function () {
    if (this.FileID_Merge) {
        this.mergeUtils.mergeFiles();
    } else {
        var lru = this;
        getPropertyFromFile(this.FileID_Original, this.constants.FileID_Merge, function (property) {
            if (!property) {
                console.error("FileID_Merge does not exists!");
            } else {
                lru.FileID_Merge = property;
                lru.mergeFiles();
            }
        });
    }
};

function GapiInterfaceInitialModel(legionRealtimeUtils) {
    this.lru = legionRealtimeUtils;
}

GapiInterfaceInitialModel.prototype.createMap = function (data) {
    var rand = Math.random();
    var crdt = this.lru.objectStore.getOrCreate(rand, this.lru.legion.Map);
    if (data) {
        var keys = Object.keys(data);
        for (var i = 0; i < keys.length; i++) {
            crdt.set(keys[i], data[keys[i]]);
        }
        console.info("New CRDT: " + rand + " : " + JSON.stringify(data));
    } else
        console.info("New CRDT: " + rand + ".");
    return crdt;
};

GapiInterfaceInitialModel.prototype.set = function (key, value) {
    console.info("Set " + key + " to " + value.objectID);
    this.lru.map.set(key, value.objectID);
    this.lru.map.set(value.objectID, "Map");
    //TODO: more types!
};

GapiInterfaceInitialModel.prototype.getRoot = function () {
    return this;
};

/**
 *
 * @param callback
 */
LegionRealtimeUtils.prototype.initRootMap = function (callback) {
    console.log("initRootMap start");
    var objects = [];
    var rootMap = this.map;
    var objectStore = this.objectStore;

    function initObject(object, ref) {
        if (object.id) {
            console.log("initObject: " + object.id + " - " + object.type);
            if (object.type == "Map") {
                console.info("Init Map with id: " + object.id);

                rootMap.set(object.id, "Map");
                var map = objectStore.getOrCreate(object.id, objectStore.legion.Map);
                objects[object.id] = map;

                var keys = Object.keys(object.value);
                for (var i = 0; i < keys.length; i++) {
                    var currKey = keys[i];
                    var currObject = object.value[currKey];
                    initObject(currObject, ref + "|" + object.id);
                }
            }
            if (object.type == "List") {
                console.info("Init List with id: " + object.id);

                rootMap.set(object.id, "List");
                objects[object.id] = objectStore.getOrCreate(object.id, objectStore.legion.List);

                for (var j = 0; j < object.value.length; j++) {
                    initObject(object.value[j], ref + "|" + object.id);
                }
            }
            if (object.type == "EditableString") {
                console.error("Not implemented: EditableString");
            }
        }
        if (object.ref) {
            console.info("Ref id: " + object.ref + " in: " + ref);
        }
        if (object.json) {
            console.info("Json in: " + ref);
        }
    }

    function fillObject(object, ref) {
        if (object.id) {
            if (object.type == "Map") {
                rootMap.set(object.id, "Map");
                console.info("Fill Map with id: " + object.id);
                var keys = Object.keys(object.value);
                for (var i = 0; i < keys.length; i++) {
                    var currKey = keys[i];
                    var currObject = object.value[currKey];
                    //console.log(currObject);
                    //console.log(objects[object.id]);

                    if (currObject.id) {
                        //console.info("Set: " + currKey + " to " + objects[currObject.id]);
                        objects[object.id].set(currKey, objects[currObject.id]);
                    } else if (currObject.ref) {
                        //console.info("Set: " + currKey + " to " + objects[currObject.ref]);
                        objects[object.id].set(currKey, objects[currObject.ref]);
                    } else if (currObject.json) {
                        //console.info("Set: " + currKey + " to " + currObject.json);
                        objects[object.id].set(currKey, currObject.json);
                    }
                    //console.log(objects[object.id].items());

                    fillObject(currObject, ref + "|" + object.id);
                }
            }
            if (object.type == "List") {
                rootMap.set(object.id, "List");
                console.info("Fill List with id: " + object.id);
                for (var j = 0; j < object.value.length; j++) {
                    var currObjectL = object.value[j];
                    if (currObjectL.id) {
                        objects[object.id].add(j, objects[currObjectL.id]);
                    } else if (currObjectL.ref) {
                        objects[object.id].add(j, objects[currObjectL.ref]);
                    } else if (currObjectL.json) {
                        objects[object.id].add(j, currObjectL.json);
                    }

                    fillObject(object.value[j], ref + "|" + object.id);
                }
            }
            if (object.type == "EditableString") {
                console.warn("Not implemented: EditableString");
            }
        }
        if (object.ref) {
            //should do nothing.
            console.info("Ref id: " + object.ref + " in: " + ref);
        }
        if (object.json) {
            //should do nothing.
            console.info("Json in: " + ref);
        }
    }

    if (this.persitence_on_legacy) {
        getCurrentRevision(this.FileID_Original, function (revision) {
            console.log("Got revision: " + revision.revision);
            lru.revisions.set(parseInt(revision.revision), revision);

            var currRootKey;
            var currRootObject;

            var rootKeys = Object.keys(revision.result.data.value);
            console.log("rootKeys: " + rootKeys);
            for (var i = 0; i < rootKeys.length; i++) {
                currRootKey = rootKeys[i];
                currRootObject = revision.result.data.value[currRootKey];
                initObject(currRootObject, "root");
            }

            for (var j = 0; j < rootKeys.length; j++) {
                currRootKey = rootKeys[j];
                currRootObject = revision.result.data.value[currRootKey];
                if (currRootObject.id)
                    rootMap.set(currRootKey, currRootObject.id);
                fillObject(currRootObject, "root");
            }

            console.log("createObjectsFile");
            lru.createObjectsFile(function () {
                console.log("createMergeFile");
                lru.createMergeFile(function () {
                    console.log("initRootMap end");
                    callback();
                });
            });
        });
    } else {
        if (this.merge_to_legacy) {
            console.error("Not implemented. 78t1u3g");
        }
        this.onInit(new GapiInterfaceInitialModel(this));
        callback();
    }
};

/**
 *
 * @param callback
 */
LegionRealtimeUtils.prototype.checkIfMainBully = function (callback) {
    if (!this.mbp) {
        this.mbp = new MainBullyProtocol(this);
    }
    this.mbp.checkIfMainBully(callback);
};

/**
 *
 * @param callback
 */
LegionRealtimeUtils.prototype.createMergeFile = function (callback) {
    if (lru.merge_to_legacy) {
        console.log("createMergeFile start");
        if (this.FileID_Merge) {
            this.realtimeUtils.load(this.FileID_Merge.replace('/', ''),
                function (doc) {
                    console.log("createMergeFile end");
                    doc.close();
                    callback();
                }, function (model) {

                    var keys = lru.revisions.keys();
                    var maxRevN = keys.sort()[keys.length - 1];
                    var maxRevV = lru.revisions.get(maxRevN);
                    var local = lru.mergeUtils.getLocalValue();

                    var map = model.createMap({
                        FileID_Original: lru.FileID_Original,
                        gapi: {num: maxRevN, val: maxRevV},
                        b2b: {val: local}
                    });
                    model.getRoot().set('b2b_map', map);
                });
        } else {
            getPropertyFromFile(lru.FileID_Original, lru.constants.FileID_Merge, function (property) {
                if (!property) {
                    lru.realtimeUtils.createRealtimeFile(lru.constants.FileID_Merge, function (createResponse) {
                        addPropertyToFile(lru.FileID_Original, lru.constants.FileID_Merge, createResponse.id, function () {
                            lru.createMergeFile(callback);
                            console.log("createMergeFile: " + createResponse.id);
                        });
                    });
                } else {
                    lru.FileID_Merge = property;
                    lru.createMergeFile(callback);
                }
            });
        }
    } else callback();
};

LegionRealtimeUtils.prototype.createKeyFile = function (key) {
    console.log("createKeyFile start");
    if (this.FileID_KeyList) {
        this.realtimeUtils.load(this.FileID_KeyList.replace('/', ''),
            function (doc) {
                console.log("createKeyFile end");
                doc.close();
            }, function (model) {
                var map = model.createMap({
                    "1": key
                });

                model.getRoot().set('b2b_map', map);
            });
    } else {
        getPropertyFromFile(lru.FileID_Original, lru.constants.FileID_KeyList, function (property) {
            if (!property) {
                lru.realtimeUtils.createRealtimeFile(lru.constants.FileID_KeyList, function (createResponse) {
                    addPropertyToFile(lru.FileID_Original, lru.constants.FileID_KeyList, createResponse.id, function () {
                        lru.createKeyFile(key);
                        console.log("createKeyFile: " + createResponse.id);
                    });
                });
            } else {
                lru.FileID_KeyList = property;
                lru.createKeyFile(key);
            }
        });
    }
};

/**
 *
 * @param callback
 */
LegionRealtimeUtils.prototype.createObjectsFile = function (callback) {
    console.log("createObjectsFile start");

    var rootMap = this.map;
    var lru = this;
    if (this.FileID_Objects) {
        this.realtimeUtils.load(this.FileID_Objects.replace('/', ''),
            function (doc) {
                console.log("createObjectsFile end");
                doc.close();
                callback();
            }, function (model) {
                var map = model.createMap({
                    FileID_Original: lru.FileID_Original,
                    RootMap: lru.legion.Map.type
                });
                var list = model.createList();
                model.getRoot().set("RootMap", list);

                var delta = rootMap.getDelta([], {a: [], r: []});
                var meta = rootMap.getMeta();
                var vv = rootMap.versionVector.toJSONString();
                var flattened = {delta: delta, vv: vv, meta: meta};

                list.insert(0, flattened);

                var keys = rootMap.keys();
                console.info("Rootmap Keys to be init:" + JSON.stringify(keys));
                for (var i = 0; i < keys.length; i++) {

                    var key = keys[i];
                    console.info("Init key:" + key);
                    var crdt = lru.objectStore.get(key);
                    if (crdt) {
                        map.set(key, crdt.crdt.type);
                        var list = model.createList();
                        model.getRoot().set(key, list);

                        var delta = crdt.getDelta([], {a: [], r: []});
                        var meta = crdt.getMeta();
                        var vv = crdt.versionVector.toJSONString();
                        var flattened = {delta: delta, vv: vv, meta: meta};

                        list.insert(0, flattened);

                    } else {
                        //no op (in the map is id->id, only one has crdt)
                    }
                }
                model.getRoot().set('b2b_map', map);
            });
    } else {
        getPropertyFromFile(lru.FileID_Original, lru.constants.FileID_Objects, function (property) {
            if (!property) {
                lru.realtimeUtils.createRealtimeFile(lru.constants.FileID_Objects, function (createResponse) {
                    addPropertyToFile(lru.FileID_Original, lru.constants.FileID_Objects, createResponse.id, function () {
                        lru.createObjectsFile(callback);
                    });
                });
            } else {
                console.log("createObjectsFile: " + property);
                lru.FileID_Objects = property;
                lru.createObjectsFile(callback);
            }
        });
    }
};

/**
 *
 * @returns {boolean}
 */
LegionRealtimeUtils.prototype.amBully = function () {
    return !this.legion.bullyProtocol.amBullied();
};
