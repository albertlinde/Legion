if (typeof generateUniqueIdentifier == "undefined") {
    generateUniqueIdentifier = function () {
        return ("" + Math.random()).substr(2, 8);
    }
}

if (typeof exports != "undefined") {
    CRDT = require('./../crdt.js');
    CRDT = CRDT.CRDT;
    ALMap = require('./../ALMap.js');
    ALMap = ALMap.ALMap;
}

//TODO: same as delta set, but also when adding as this can remove elements.

var haveRemovesOf = function (add, state) {
    var removes = add[2][2];
    for (var i = 0; removes && i < removes.length; i++) {
        var removesThemselves = removes[i][1];
        for (var j = 0; j < removesThemselves.length; j++) {
            var node = removesThemselves[j][0];
            var nodeOP = removesThemselves[j][1];
            if (!state.added.get(node)) {
                return false;
            }
            if (state.added.get(node) < nodeOP) {
                return false;
            }
        }
    }
    return true;
};

var delta_orMap = {
    type: "DELTA_Map",
    crdt: {
        base_value: {
            state: {
                elements: ALMap,
                adds: ALMap,
                removes: ALMap,
                newElements: Number,
                oldElements: Number,
                added: ALMap,
                removed: ALMap
            }
        },
        getValue: function () {
            var ret = [];
            var keys = this.state.elements.keys();
            for (var i = 0; i < keys.length; i++) {
                ret.push([keys[i], this.state.elements.get(keys[i]).keys()]);
            }
            return ret;
        },
        operations: {
            contains: {
                local: function (element) {
                    var toInterface = false;
                    if (this.state.elements.contains(element)) {
                        toInterface = true;
                    }
                    return {
                        toInterface: toInterface,
                        toNetwork: null
                    };

                }, remote: function () {
                    //never called.
                }
            },
            get: {
                local: function (element) {
                    var toInterface = [];
                    if (this.state.elements.contains(element)) {
                        toInterface = this.state.elements.get(element).keys();
                    }
                    return {
                        toInterface: toInterface,
                        toNetwork: null
                    };
                }, remote: function () {
                    //never called.
                }
            },
            asArray: {
                local: function () {
                    var toInterface = [];
                    var keys = this.state.elements.keys();
                    for (var i = 0; i < keys.length; i++) {
                        toInterface.push([keys[i], this.state.elements.get(keys[i]).keys()]);
                    }
                    return {
                        toInterface: toInterface,
                        toNetwork: null
                    };
                }, remote: function () {
                    //never called.
                }
            },
            keys: {
                local: function () {
                    return {
                        toInterface: this.state.elements.keys(),
                        toNetwork: null
                    };
                }, remote: function () {
                    //never called.
                }
            },
            values: {
                local: function () {
                    var toInterface = [];
                    var keys = this.state.elements.keys();
                    for (var i = 0; i < keys.length; i++) {
                        toInterface.push(this.state.elements.get(keys[i]).keys());
                    }
                    return {
                        toInterface: toInterface,
                        toNetwork: null
                    };
                }, remote: function () {
                    //never called.
                }
            },
            set: {
                local: function (key, value, metadata) {
                    if (this.state.elements.get(key)) {
                        if ((this.state.elements.get(key).size() == 1)
                            && this.state.elements.get(key).contains(value))
                            return {
                                toInterface: null,
                                toNetwork: null
                            };
                    }
                    var removes = [];
                    var values = this.state.elements.get(key);
                    if (values) {
                        var valKeys = values.keys();
                        for (var i = 0; i < valKeys.length; i++) {
                            removes.push([valKeys[i], values.get(valKeys[i]).toArray()]);
                        }
                    }
                    return {
                        toInterface: null,
                        toNetwork: {
                            key: key,
                            value: value,
                            id: metadata.replicaID,
                            op: ++this.state.newElements,
                            removes: removes
                        }
                    }
                }, remote: function (data) {
                    var added = false;
                    var elementMap = this.state.elements.get(data.key);
                    if (!elementMap) {
                        elementMap = new ALMap();
                        this.state.elements.set(data.key, elementMap);
                        added = true;
                    }
                    var oldValues = elementMap.keys();

                    var valueMap = elementMap.get(data.value);
                    if (!valueMap) {
                        valueMap = new ALMap();
                        elementMap.set(data.value, valueMap);
                        added = true;
                    }

                    valueMap.set(data.id, data.op);

                    if (!this.state.adds.contains(data.id)) {
                        this.state.adds.set(data.id, new ALMap());
                    }
                    this.state.adds.get(data.id).set(data.op, [data.key, data.value, data.removes]);

                    this.state.added.set(data.id, data.op);

                    for (var i = 0; i < data.removes.length; i++) {
                        var value = data.removes[i][0];
                        var removeList = data.removes[i][1];
                        for (var j = 0; j < removeList.length; j++) {
                            if (elementMap.get(value) && elementMap.get(value).get(removeList[j][0]) <= removeList[j][1]) {
                                elementMap.get(value).delete(removeList[j][0]);
                            }
                        }
                        if (elementMap.get(value) && elementMap.get(value).size() == 0) {
                            elementMap.delete(value);
                        }
                    }
                    if (added)
                        return {set: {key: data.key, value: elementMap.keys()}, was: oldValues};
                    else
                        return null;
                }
            },
            delete: {
                local: function (key, metadata) {
                    if (!this.state.elements.get(key)) {
                        return {
                            toInterface: null,
                            toNetwork: null
                        };
                    } else {
                        var removes = [];
                        var values = this.state.elements.get(key);
                        var valKeys = values.keys();
                        for (var i = 0; i < valKeys.length; i++) {
                            removes.push([valKeys[i], values.get(valKeys[i]).toArray()]);
                        }
                        return {
                            toInterface: null,
                            toNetwork: {
                                key: key,
                                id: metadata.replicaID,
                                op: ++this.state.oldElements,
                                removes: removes
                            }
                        };
                    }
                }, remote: function (data) {
                    var removed = false;
                    var values = [];
                    var elementMap = this.state.elements.get(data.key);
                    if (elementMap) {
                        var receivedRemoves = data.removes;
                        for (var i = 0; i < receivedRemoves.length; i++) {
                            var value = receivedRemoves[i][0];
                            var idPairs = receivedRemoves[i][1];
                            var valueMap = elementMap.get(value);
                            if (valueMap) {
                                for (var j = 0; j < idPairs.length; j++) {
                                    if (valueMap.get(idPairs[j][0]) && valueMap.get(idPairs[j][0]) <= idPairs[j][1]) {
                                        valueMap.delete(idPairs[j][0]);
                                    }
                                }
                                if (valueMap.size() == 0) {
                                    elementMap.delete(value);
                                    values.push(value);
                                }
                            }
                        }
                        if (elementMap.size() == 0) {
                            this.state.elements.delete(data.key);
                            removed = true;
                        }
                    }

                    if (!this.state.removes.contains(data.id)) {
                        this.state.removes.set(data.id, new ALMap());
                    }
                    this.state.removes.get(data.id).set(data.op, [data.key, data.removes]);
                    this.state.removed.set(data.id, data.op);

                    if (removed)
                        return {deleted: {key: data.key, values: values}};
                    else
                        return null;
                }
            }
        },
        getDelta: function (vv, meta) {
            var ret = {adds: [], removes: []};

            var hisAdds = meta.added;
            var hisRemoves = meta.removed;

            for (var i = 0; hisAdds && i < hisAdds.length; i++) {
                var k = hisAdds[i][0];
                var v = hisAdds[i][1];
                if (this.state.added.get(k) > v) {
                    for (var ai = v + 1; ai <= this.state.added.get(k); ai++) {
                        ret.adds.push([k, ai, this.state.adds.get(k).get(ai)]);
                    }
                }
            }

            var myAdds = this.state.added.keys();
            for (var j = 0; j < myAdds.length; j++) {
                var found = false;
                for (var i = 0; hisAdds && i < hisAdds.length; i++) {
                    if (myAdds[j] == hisAdds[i][0]) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    for (var ai = 1; ai <= this.state.added.get(myAdds[j]); ai++) {
                        ret.adds.push([myAdds[j], ai, this.state.adds.get(myAdds[j]).get(ai)]);
                    }
                }
            }

            for (var j = 0; hisRemoves && j < hisRemoves.length; j++) {
                var k = hisRemoves[j][0];
                var v = hisRemoves[j][1];
                if (this.state.removed.get(k) > v) {
                    for (var ri = v + 1; ri <= this.state.removed.get(k); ri++) {
                        ret.removes.push([k, ri, this.state.removes.get(k).get(ri)]);
                    }
                }
            }

            var myRemoves = this.state.removed.keys();
            for (var j = 0; j < myRemoves.length; j++) {
                var found = false;
                for (var i = 0; hisRemoves && i < hisRemoves.length; i++) {
                    if (myRemoves[j] == hisRemoves[i][0]) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    for (var ri = 1; ri <= this.state.removed.get(myRemoves[j]); ri++) {
                        ret.removes.push([myRemoves[j], ri, this.state.removes.get(myRemoves[j]).get(ri)]);
                    }
                }
            }

            //console.info(ret);
           //console.info("SYNC: getDelta Map");

            if (ret.removes.length > 0 || ret.adds.length > 0) {
                return ret;
            } else {
                return null;
            }

        },
        applyDelta: function (delta, vv, meta) {
            try {
               //console.info("SYNC START: applyDelta Map");
               //console.info(JSON.stringify(delta));
                var hadEffect = false;
                var change = {added: [], removed: []};

                var doAfter = [];

                for (var a = 0; a < delta.adds.length; a++) {
                    var replicaID = delta.adds[a][0];
                    var operationID = delta.adds[a][1];
                    var key = delta.adds[a][2][0];
                    var value = delta.adds[a][2][1];
                    var removes = delta.adds[a][2][2];

                    if (this.state.adds.get(replicaID) && this.state.adds.get(replicaID).get(operationID)) {
                        //console.info("Already had op.");
                        delta.adds = delta.adds.slice(0, a).concat(delta.adds.slice(a + 1, delta.adds.length));
                    } else {
                        //console.info("New op.");

                        if (!haveRemovesOf(delta.adds[a], this.state)) {
                            doAfter.push(delta.adds[a]);
                            continue;
                        }

                        var added = false;
                        var elementMap = this.state.elements.get(key);
                        if (!elementMap) {
                            elementMap = new ALMap();
                            this.state.elements.set(key, elementMap);
                            added = true;
                        }
                        var oldValues = elementMap.keys();

                        var valueMap = elementMap.get(value);
                        if (!valueMap) {
                            valueMap = new ALMap();
                            elementMap.set(value, valueMap);
                            added = true;
                        }

                        valueMap.set(replicaID, operationID);

                        if (!this.state.adds.contains(replicaID)) {
                            this.state.adds.set(replicaID, new ALMap());
                        }
                        this.state.adds.get(replicaID).set(operationID, [key, value, removes]);
                        this.state.added.set(replicaID, operationID);

                        for (var i = 0; i < removes.length; i++) {
                            var rem_value = removes[i][0];
                            var removeList = removes[i][1];
                            for (var j = 0; j < removeList.length; j++) {
                                if (elementMap.get(rem_value) && elementMap.get(rem_value).get(removeList[j][0]) && elementMap.get(rem_value).get(removeList[j][0]) <= removeList[j][1]) {
                                    elementMap.get(rem_value).delete(removeList[j][0]);
                                }
                            }
                            if (elementMap.get(rem_value) && elementMap.get(rem_value).size() == 0) {
                                elementMap.delete(rem_value);
                                added = true;
                            }
                        }
                        if (added)
                            change.added.push({set: {key: key, value: elementMap.keys()}, was: oldValues});
                    }
                }

                while (doAfter.length > 0) {
                   //console.info("Do after had things: " + doAfter.length);
                    var doNext = [];
                    var did = false;
                    for (var dai = 0; dai < doAfter.length; dai++) {
                        if (!haveRemovesOf(doAfter[dai], this.state)) {
                            doNext.push(doAfter[dai]);
                        } else {
                            did = true;

                            var replicaID = doAfter[dai][0];
                            var operationID = doAfter[dai][1];
                            var key = doAfter[dai][2][0];
                            var value = doAfter[dai][2][1];
                            var removes = doAfter[dai][2][2];

                            var added = false;
                            var elementMap = this.state.elements.get(key);
                            if (!elementMap) {
                                elementMap = new ALMap();
                                this.state.elements.set(key, elementMap);
                                added = true;
                            }
                            var oldValues = elementMap.keys();

                            var valueMap = elementMap.get(value);
                            if (!valueMap) {
                                valueMap = new ALMap();
                                elementMap.set(value, valueMap);
                                added = true;
                            }

                            valueMap.set(replicaID, operationID);

                            if (!this.state.adds.contains(replicaID)) {
                                this.state.adds.set(replicaID, new ALMap());
                            }
                            this.state.adds.get(replicaID).set(operationID, [key, value, removes]);
                            this.state.added.set(replicaID, operationID);

                            for (var i = 0; i < removes.length; i++) {
                                var rem_value = removes[i][0];
                                var removeList = removes[i][1];
                                for (var j = 0; j < removeList.length; j++) {
                                    if (elementMap.get(rem_value) && elementMap.get(rem_value).get(removeList[j][0]) && elementMap.get(rem_value).get(removeList[j][0]) <= removeList[j][1]) {
                                        elementMap.get(rem_value).delete(removeList[j][0]);
                                    }
                                }
                                if (elementMap.get(rem_value) && elementMap.get(rem_value).size() == 0) {
                                    elementMap.delete(rem_value);
                                    added = true;
                                }
                            }
                            if (added)
                                change.added.push({set: {key: key, value: elementMap.keys()}, was: oldValues});
                        }
                    }
                    if (!did) {
                       //console.error("NOT DID!!", this, delta, vv, meta, doAfter);
                    }

                    doAfter = doNext;
                }

                for (var r = 0; r < delta.removes.length; r++) {
                    var rReplicaID = delta.removes[r][0];
                    var rOperationID = delta.removes[r][1];
                    var rKey = delta.removes[r][2][0];
                    var rPairs = delta.removes[r][2][1];

                    if (this.state.removes.get(rReplicaID) && this.state.removes.get(rReplicaID).get(rOperationID)) {
                        delta.removes = delta.removes.slice(0, r).concat(delta.removes.slice(r + 1, delta.removes.length));
                        //console.info("Already had op.");
                    } else {
                        //console.info("New op.");
                        hadEffect = true;
                        var valuePairs = this.state.elements.get(rKey);
                        var removedValues = [];
                        if (valuePairs) {
                            for (var i = 0; i < rPairs.length; i++) {
                                var removedValue = rPairs[i][0];
                                var removedValuePairs = rPairs[i][1];
                                if (valuePairs.get(removedValue)) {
                                    for (var j = 0; j < removedValuePairs.length; j++) {
                                        var r_replica = removedValuePairs[j][0];
                                        var r_opcount = removedValuePairs[j][1];

                                        if (valuePairs.get(removedValue).get(r_replica) && valuePairs.get(removedValue).get(r_replica) <= r_opcount) {
                                            valuePairs.get(removedValue).delete(r_replica);
                                        }
                                    }
                                    if (valuePairs.get(removedValue).size() == 0) {
                                        removedValues.push(removedValue);
                                        valuePairs.delete(removedValue);
                                    }
                                }

                            }
                            if (valuePairs.size() == 0) {
                                this.state.elements.delete(rKey);
                            }
                            if (removedValues.length > 0)
                                change.removed.push({removed: rKey, was: removedValues});
                        }
                        //console.info(removedValues);
                        if (!this.state.removes.contains(rReplicaID)) {
                            this.state.removes.set(rReplicaID, new ALMap());
                        }
                        this.state.removes.get(rReplicaID).set(rOperationID, [rKey, rPairs]);
                        this.state.removed.set(rReplicaID, rOperationID);
                    }
                }
                if (change.removed.length == 0) {
                    delete change.removed;
                }
                if (change.added.length == 0) {
                    delete change.added;
                }

            } catch (e) {
               //console.error(e);
               //console.error(delta);
               //console.error(vv);
               //console.error(meta);
            }
            //console.info(JSON.stringify(hadEffect));
            //console.info(JSON.stringify(change));
            //console.info(JSON.stringify(delta));
           //console.info("SYNC END: applyDelta Map");

            if (change.removed || change.added)
                return {change: change, flattened: {delta: delta, vv: vv, meta: meta}};
            else if (hadEffect)
                return {change: null, flattened: {delta: delta, vv: vv, meta: meta}};
            else
                return {change: null, flattened: null};

        },
        getMeta: function () {
            return {added: this.state.added.toArray(), removed: this.state.removed.toArray()}
        }
    }
};

if (typeof exports != "undefined") {
    exports.DELTA_Map = delta_orMap;
} else {
    CRDT_LIB.DELTA_Map = delta_orMap;
}