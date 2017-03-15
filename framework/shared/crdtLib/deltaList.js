//Ids are {p: number, d: {r: number, o: number}};
// p -> path
// d -> disambiguator
// r: rID
// o: oC

var delta_list_debug = false;

var newID = function (prev, next, d) {
    if (prev != null) prev = prev.id;
    if (next != null) next = next.id;

    var id = {};
    if (prev == null && next == null) {
        id.p = "";
    } else if (prev == null) {
        id.p = next.p + "0";
    } else if (next == null) {
        id.p = prev.p + "1";
    } else {
        if (prev.p.length > next.p.length) {
            id.p = prev.p + "1";
        } else {
            id.p = next.p + "0";
        }
    }
    id.d = d;
    if (delta_list_debug) console.info(prev, next, d, id);
    return id;
};

/**
 * Returns position (index) in the list.
 * @param list
 * @param d
 */
var findDInList = function (list, d) {
    for (var i = 0; i < list.size(); i++) {
        var DofPosi = list.get(i).id.d;
        if (DofPosi.r == d.r && DofPosi.o == d.o) {
            return i;
        }
    }
    return -1

};

/**
 * Returns position (index) in the list.
 * @param list
 * @param id
 */
var findPositionForID = function (list, id) {
    if (delta_list_debug) console.info("--")
    var a = findPositionForIDRec(list, id, 0, list.size());
    if (delta_list_debug) console.info("--");
    return a;
};

var findPositionForIDRec = function (list, id, min, max) {
    if (delta_list_debug) console.info(list, id, min, max);
    if (min == max) {
        return min;
    }
    var posToCheck = min + Math.floor((max - min) / 2);

    var elementAtPos = list.get(posToCheck);
    var comparison = 0;
    if (list.size() > 0)
        comparison = compareIDs(id, elementAtPos.id);
    if (delta_list_debug) console.info(posToCheck, comparison);
    if (comparison > 0) {
        return findPositionForIDRec(list, id, posToCheck + 1, max);
    } else if (comparison < 0) {
        return findPositionForIDRec(list, id, min, posToCheck);
    } else {
        return posToCheck;
    }
};

/**
 * Returns >0 if id1 > id2; <0 if id1 < id2; 0 if equal.
 * @param id1
 * @param id2
 * @return {Number}
 */
var compareIDs = function (id1, id2) {
    if (delta_list_debug) console.log(id1, id2)
    var pos = 0;
    for (; pos < id1.p.length && pos < id2.p.length; pos++) {
        if (id1.p[pos] != id2.p[pos])
            break;
    }
    if (id1.p.length > pos && id2.p.length > pos) {
        if (id1.p[pos] == "0")
            return -1;
        else
            return 1;
    } else if (id1.p.length > pos) {
        if (id1.p[pos] == "0")
            return -1;
        else
            return 1;
    } else if (id2.p.length > pos) {
        if (id2.p[pos] == "0")
            return 1;
        else
            return -1;
    } else if (id1.p[pos - 1] != id2.p[pos - 1]) {
        if (id1.p[pos - 1] == "0")
            return -1;
        else
            return 1;
    } else {
        if (delta_list_debug) console.info("checking d.")
        //path is equal. use d.
        if (id1.d.r == id2.d.r) {
            if (id1.d.o > id2.d.o) {
                return 1;
            } else {
                return -1;
            }
        } else {
            if (id1.d.r > id2.d.r) {
                return 1;
            } else {
                return -1;
            }
        }
    }
};

var addTombstone = function (state, d, delID) {
    var replicaDeletes = state.removes.get(delID.r);
    if (!replicaDeletes) {
        replicaDeletes = new ALMap();
        state.removes.set(delID.r, replicaDeletes);
    }
    replicaDeletes.set(delID.o, d);

    var newMax = delID.o;
    if (state.removed.get(delID.r)) {
        newMax = Math.max(newMax, state.removed.get(delID));
    }
    state.removed.set(delID.r, newMax);
};

var generateNewIDs = function (list, pos, amount, opID) {
    if (amount > 1) {
        console.error("No efficient implementation for multi list isnert yet.");
        return;
    }
    var prev = list.get(pos - 1);
    var next = list.get(pos);
    return newID(prev, next, {r: opID.rID, o: opID.oC});
};

if (typeof exports != "undefined") {
    CRDT = require('./../crdt.js');
    CRDT = CRDT.CRDT;
    ALMap = require('./../ALMap.js');
    ALMap = ALMap.ALMap;
    DS_TableList = require('./../dataStructures/DS_TableList.js');
    DS_TableList = DS_TableList.DS_TableList;
}

var Delta_Treedoc = {
    type: "L",
    crdt: {
        base_value: {
            //list: Array.<{}>
            list: DS_TableList, removed: ALMap, removes: ALMap, oldElements: Number
        },
        getValue: function () {
            var ret = [];
            for (var i = 0; i < this.state.list.size(); i++) {
                ret.push(this.state.list.get(i).value);
            }
            return ret;
        },
        operations: {
            size: {
                local: function () {
                    return {
                        toInterface: this.state.list.size(),
                        toNetwork: null
                    };
                },
                remote: function (data) {
                    //Never called.
                }
            },
            asArray: {
                local: function () {
                    var toInterface = [];
                    for (var i = 0; i < this.state.list.size(); i++) {
                        toInterface.push(this.state.list.get(i).value);
                    }
                    return {
                        toInterface: toInterface,
                        toNetwork: null
                    };
                },
                remote: function (data) {
                    //Never called.
                }
            },
            set: {
                local: function (pos, value, opID) {
                    var current = this.state.list.get(pos);
                    var newId = generateNewIDs(this.state.list, pos, 1, opID);
                    return {
                        toInterface: null,
                        toNetwork: {
                            id: newId, v: value, d: current.id.d,
                            delID: {
                                r: opID.rID, o: ++this.state.oldElements
                            }
                        }
                    };
                },
                remote: function (data) {
                    var posToRemove = findDInList(this.state.list, data.d);
                    if (posToRemove >= 0) {
                        var ret = this.state.list.get(posToRemove);
                        this.state.list.remove(posToRemove);
                        addTombstone(this.state, data.d, data.delID);
                        this.state.list.put(posToRemove, {id: data.id, value: data.v});
                        return {pos: posToRemove, removed: ret.value, added: data.v}
                    } else {
                        var posToInsert = findPositionForID(this.state.list, data.id);
                        this.state.list.put(posToInsert, {id: data.id, value: data.v});
                        return {pos: posToInsert, added: data.v}
                    }
                }
            },
            get: {
                local: function (pos) {
                    return {
                        toInterface: this.state.list.get(pos).value,
                        toNetwork: null
                    };
                },
                remote: function (data) {
                    //Never called.
                }
            },
            /**
             * TODO: optimize this.
             * Pushes to the end of the list.
             */
            pushAll: {
                local: function (elements) {
                    var prev = this.size();
                    for (var i = 0; i < elements.length; i++) {
                        this.add(prev + i, elements[i]);
                    }
                    return {
                        toInterface: null,
                        toNetwork: null
                    };
                }, remote: function (data) {
                    console.error("In list, pushall.", data);
                }
            },
            add: {
                local: function (pos, value, opID) {
                    if (pos >= 0 && pos <= this.state.list.size()) {
                        var newId = generateNewIDs(this.state.list, pos, 1, opID);
                        return {
                            toInterface: null,
                            toNetwork: {id: newId, v: value}
                        };
                    } else {
                        console.error("Out of list bounds: " + pos + " in [0, " + this.state.list.size() + "].");
                        return {
                            toInterface: null,
                            toNetwork: null
                        };
                    }
                },
                remote: function (data) {
                    var posToInsert = findPositionForID(this.state.list, data.id);
                    this.state.list.put(posToInsert, {id: data.id, value: data.v});
                    return {pos: posToInsert, added: data.v}
                }
            },
            delete: {
                local: function (pos, opID) {
                    var item = this.state.list.get(pos);
                    if (item) {
                        return {
                            toInterface: null,
                            toNetwork: {
                                d: item.id.d, delID: {
                                    r: opID.rID, o: ++this.state.oldElements
                                }
                            }
                        };
                    } else {
                        return {
                            toInterface: null,
                            toNetwork: null
                        };
                    }
                },
                remote: function (data) {
                    var posToRemove = findDInList(this.state.list, data.d);
                    if (posToRemove >= 0) {
                        var ret = this.state.list.get(posToRemove);
                        addTombstone(this.state, data.d, data.delID);
                        this.state.list.remove(posToRemove);
                        return {pos: posToRemove, removed: ret.value}
                    }
                }
            }
        },
        getDelta: function (vv, meta) {
            if (delta_list_debug) console.info(vv, meta);
            var newInList = [];
            var list = this.state.list;
            for (var i = 0; i < list.size(); i++) {
                var itemID = list.get(i).id;
                if (!vv[itemID.r] || vv[itemID.r] < itemID.o) {
                    newInList.push([itemID, list.get(i).value]);
                }
            }
            var hisRemoves = meta.r;
            var newRemoves = [];
            var myRemoves = this.state.removed.keys();

            for (var j = 0; hisRemoves && j < hisRemoves.length; j++) {
                var k = hisRemoves[j][0];
                var v = hisRemoves[j][1];
                if (this.state.removed.get(k) > v) {
                    for (var ri = v + 1; ri <= this.state.removed.get(k); ri++) {
                        newRemoves.push([{r: k, o: ri}, this.state.removes.get(k).get(ri)]);
                    }
                }
            }

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
                        newRemoves.push([{r: myRemoves[j], o: ri}, this.state.removes.get(myRemoves[j]).get(ri)]);
                    }
                }
            }

            if (newInList.length > 0 || newRemoves.length > 0) {
                return {nl: newInList, nr: newRemoves};
            } else {
                return null;
            }

        },
        applyDelta: function (delta, vv, meta) {
            if (delta_list_debug) console.info(delta, vv, meta);
            try {
                var hadEffect = false;
                var change = {added: [], removed: []};

                var newInList = delta.nl;
                var newRemoves = delta.nr;

                for (var i = 0; i < newInList.length; i++) {
                    var itemID = newInList[i][0];

                    if (this.versionVector.contains(itemID.d.r) && this.versionVector.get(itemID.d.r) >= (itemID.d.o)) {
                        if (delta_list_debug) console.info("Already had op.");
                        delta.nl = delta.nl.slice(0, i).concat(delta.nl.slice(i + 1, delta.nl.length));
                    } else {
                        hadEffect = true;
                        var itemVal = newInList[i][1];
                        if (delta_list_debug) console.info("New op.");

                        var posToInsert = findPositionForID(this.state.list, itemID);
                        this.state.list.put(posToInsert, {id: itemID, value: itemVal});
                        for (var a = 0; a < change.added.length; a++) {
                            if (change.added[a].pos >= posToInsert) {
                                change.added[a].pos++;
                            }
                        }
                        change.added.push({pos: posToInsert, added: itemVal});
                    }
                }
                for (var j = 0; j < newRemoves.length; j++) {
                    var itemID = newRemoves[j][0];
                    if (this.state.removes.get(itemID.r) && this.state.removes.get(itemID.r).get(itemID.o)) {
                        delta.nr = delta.nr.slice(0, j).concat(delta.nr.slice(j + 1, delta.nr.length));
                        if (delta_list_debug) console.info("Already had op.");
                    } else {
                        hadEffect = true;
                        var removedD = newRemoves[j][1];
                        if (delta_list_debug) console.info("New op.");
                        var posToRemove = findDInList(this.state.list, removedD);
                        if (posToRemove >= 0) {
                            var ret = this.state.list.get(posToRemove);
                            addTombstone(this.state, removedD, itemID);
                            this.state.list.remove(posToRemove);

                            for (var a = 0; a < change.added.length; a++) {
                                if (change.added[a].pos > posToInsert) {
                                    change.added[a].pos--;
                                }
                            }
                            for (var b = 0; b < change.removed.length; b++) {
                                if (change.removed[b].pos > posToRemove) {
                                    change.removed[b].pos--;
                                }
                            }
                            change.removed.push({pos: posToRemove, removed: ret.value});
                        }
                    }
                }

                if (change.removed.length == 0) {
                    delete change.removed;
                }
                if (change.added.length == 0) {
                    delete change.added;
                }

            } catch (e) {
                if (delta_list_debug) console.error(delta);
                if (delta_list_debug) console.error(vv);
                if (delta_list_debug) console.error(meta);
                if (delta_list_debug) console.error(e);
                console.error("Fatal delta List error.");
            }
            if (change.removed || change.added)
                return {change: change, flattened: {d: delta, vv: vv, m: meta}};
            else if (hadEffect)
                return {change: null, flattened: {d: delta, vv: vv, m: meta}};
            else
                return {change: null, flattened: null};
        },
        getMeta: function () {
            return {r: this.state.removed.toArray()}
        }
    }
};

if (typeof exports != "undefined") {
    exports.DELTA_List = Delta_Treedoc;
} else {
    CRDT_LIB.DELTA_List = Delta_Treedoc;
}