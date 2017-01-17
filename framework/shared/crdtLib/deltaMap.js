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
    type: "M",
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
                            k: key,
                            v: value,
                            id: metadata.rID,
                            op: ++this.state.newElements,
                            r: removes
                        }
                    }
                }, remote: function (data) {
                    var added = false;
                    var elementMap = this.state.elements.get(data.k);
                    if (!elementMap) {
                        elementMap = new ALMap();
                        this.state.elements.set(data.k, elementMap);
                        added = true;
                    }
                    var oldValues = elementMap.keys();

                    var valueMap = elementMap.get(data.v);
                    if (!valueMap) {
                        valueMap = new ALMap();
                        elementMap.set(data.v, valueMap);
                        added = true;
                    }

                    valueMap.set(data.id, data.op);

                    if (!this.state.adds.contains(data.id)) {
                        this.state.adds.set(data.id, new ALMap());
                    }
                    this.state.adds.get(data.id).set(data.op, [data.k, data.v, data.r]);

                    this.state.added.set(data.id, data.op);

                    for (var i = 0; i < data.r.length; i++) {
                        var value = data.r[i][0];
                        var removeList = data.r[i][1];
                        for (var j = 0; j < removeList.length; j++) {
                            if (elementMap.get(value) && elementMap.get(value).get(removeList[j][0]) <= removeList[j][1]) {
                                elementMap.get(value).delete(removeList[j][0]);
                            }
                        }
                        if (elementMap.get(value) && elementMap.get(value).size() == 0) {
                            elementMap.delete(value);
                            added = true;
                        }
                    }
                    if (added)
                        return {set: {key: data.k, value: elementMap.keys()}, was: oldValues};
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
                                k: key,
                                id: metadata.rID,
                                op: ++this.state.oldElements,
                                r: removes
                            }
                        };
                    }
                }, remote: function (data) {
                    var removed = false;
                    var values = [];
                    var elementMap = this.state.elements.get(data.k);
                    if (elementMap) {
                        var receivedRemoves = data.r;
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
                            this.state.elements.delete(data.k);
                            removed = true;
                        }
                    }

                    if (!this.state.removes.contains(data.id)) {
                        this.state.removes.set(data.id, new ALMap());
                    }
                    this.state.removes.get(data.id).set(data.op, [data.k, data.r]);
                    this.state.removed.set(data.id, data.op);

                    if (removed)
                        return {deleted: {key: data.k, values: values}};
                    else
                        return null;
                }
            }
        },
        getDelta: function (vv, meta) {
            var ret = {a: [], r: []};

            var hisAdds = meta.a;
            var hisRemoves = meta.r;

            for (var i = 0; hisAdds && i < hisAdds.length; i++) {
                var k = hisAdds[i][0];
                var v = hisAdds[i][1];
                if (this.state.added.get(k) > v) {
                    for (var ai = v + 1; ai <= this.state.added.get(k); ai++) {
                        ret.a.push([k, ai, this.state.adds.get(k).get(ai)]);
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
                        ret.a.push([myAdds[j], ai, this.state.adds.get(myAdds[j]).get(ai)]);
                    }
                }
            }

            for (var j = 0; hisRemoves && j < hisRemoves.length; j++) {
                var k = hisRemoves[j][0];
                var v = hisRemoves[j][1];
                if (this.state.removed.get(k) > v) {
                    for (var ri = v + 1; ri <= this.state.removed.get(k); ri++) {
                        ret.r.push([k, ri, this.state.removes.get(k).get(ri)]);
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
                        ret.r.push([myRemoves[j], ri, this.state.removes.get(myRemoves[j]).get(ri)]);
                    }
                }
            }

            if (ret.r.length > 0 || ret.a.length > 0) {
                return ret;
            } else {
                return null;
            }
        },
        applyDelta: function (delta, vv, meta) {
            var hadEffect = false;
            var change = {added: [], removed: []};

            var doAfter = [];

            for (var a = 0; a < delta.a.length; a++) {
                var rID = delta.a[a][0];
                var opID = delta.a[a][1];
                var key = delta.a[a][2][0];
                var value = delta.a[a][2][1];
                var removes = delta.a[a][2][2];

                if (this.state.adds.get(rID) && this.state.adds.get(rID).get(opID)) {
                    //console.info("Already had op.");
                    delta.a = delta.a.slice(0, a).concat(delta.a.slice(a + 1, delta.a.length));
                } else {
                    hadEffect = true;
                    //console.info("New op.");

                    if (!haveRemovesOf(delta.a[a], this.state)) {
                        doAfter.push(delta.a[a]);
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

                    valueMap.set(rID, opID);

                    if (!this.state.adds.contains(rID)) {
                        this.state.adds.set(rID, new ALMap());
                    }
                    this.state.adds.get(rID).set(opID, [key, value, removes]);
                    this.state.added.set(rID, opID);

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


                        var rID = doAfter[dai][0];
                        var opID = doAfter[dai][1];
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

                        valueMap.set(rID, opID);

                        if (!this.state.adds.contains(rID)) {
                            this.state.adds.set(rID, new ALMap());
                        }
                        this.state.adds.get(rID).set(opID, [key, value, removes]);
                        this.state.added.set(rID, opID);

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

            for (var r = 0; r < delta.r.length; r++) {
                var rReplicaID = delta.r[r][0];
                var rOperationID = delta.r[r][1];
                var rKey = delta.r[r][2][0];
                var rPairs = delta.r[r][2][1];

                if (this.state.removes.get(rReplicaID) && this.state.removes.get(rReplicaID).get(rOperationID)) {
                    delta.r = delta.r.slice(0, r).concat(delta.r.slice(r + 1, delta.r.length));
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

            if (change.removed || change.added)
                return {change: change, flattened: {d: delta, vv: vv, m: meta}};
            else if (hadEffect)
                return {change: null, flattened: {d: delta, vv: vv, m: meta}};
            else
                return {change: null, flattened: null};

        },
        getMeta: function () {
            return {a: this.state.added.toArray(), r: this.state.removed.toArray()}
        }
    }
};

if (typeof exports != "undefined") {
    exports.DELTA_Map = delta_orMap;
} else {
    CRDT_LIB.DELTA_Map = delta_orMap;
}