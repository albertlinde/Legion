if (typeof generateUniqueIdentifier == "undefined") {
    generateUniqueIdentifier = function () {
        return ("" + Math.random()).substr(2, 8);
    }
}
/**
 *
 * @param list {DS_TableList}
 * @param pos {number}
 * @param amount {number}
 */
generateIds = function (list, pos, amount) {
    var disam = generateUniqueIdentifier();
    var pre = list.get(pos - 1);
    var next = list.get(pos);
    var head;
    if (pre && next)  head = newID(pre.id, list.get(pos).id, disam);
    else if (pre)head = newID(pre.id, null, disam);
    else if (next)head = newID(null, next.id, disam);
    else head = newID(null, null, disam);
    if (amount == 1)
        return head;
    else {
        console.error("Not yet implemented.");
    }
    //TODO: tree if amount > 1
};
/**
 * Returns true IF b is AFTER a.
 * @param a
 * @param b
 */
isAfter = function (a, b) {
    for (var pi = 0; pi < a.path.length && pi < b.path.length; pi++) {
        if (a.path[pi] < b.path[pi]) {
            return true;
        }
    }

    if (a.path.length > b.path.length) {
        return a.path[b.path.length] == "0";
    } else if (a.path.length < b.path.length) {
        return b.path[a.path.length] == "1";
    } else {
        return b.dis > a.dis;
    }
};

newID = function (prev, next, d) {
    var id = {};
    if (prev == null && next == null) {
        id.path = "";
    } else if (prev == null) {
        id.path = next.path + "0";
    } else if (next == null) {
        id.path = prev.path + "1";
    } else {
        if (prev.path.length > next.path.length) {
            id.path = prev.path + "1";
        } else {
            id.path = next.path + "0";
        }
    }
    id.dis = d;
    return id;
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
    type: "Delta_Treedoc",
    crdt: {
        base_value: {
            state: {list: DS_TableList, tombstones: ALMap}
        },
        getValue: function () {
            var ret = [];
            for (var i = 0; i < this.state.list.size(); i++) {
                ret.push(this.state.list.get(i).value);
            }
            return ret;
        },
        operations: {
            asArray: {
                local: function () {
                    return null;
                },
                remote: function (data) {
                    var ret = [];

                    for (var i = 0; i < this.state.list.size(); i++) {
                        ret.push(this.state.list.get(i).value);
                    }

                    return ret;
                }
            }, addAll: {
                local: function (pos, values) {
                    return ({ids: generateIds(this.state.list, pos, values.length), values: values});
                },
                remote: function (data) {
                    //TODO: check if removed.
                    for (var i = 0; i < this.state.list.size(); i++) {
                        if (isAfter(this.state.list.get(i).id, data.ids[0].id)) {
                            for (var j = 0; j < data.ids.length; j++) {
                                this.state.list.put(i, data.ids[data.ids.length - 1 - j]);
                            }
                            return {added: data.values, pos: i, amount: data.ids.length};
                        }
                    }
                }
            },
            set: {
                local: function (pos, value) {
                    var current = this.state.list.get(pos);
                    var newId = generateIds(this.state.list, pos, 1);
                    return {id: newId, value: value, deleted: current.id.dis};

                },
                remote: function (data) {
                    //TODO: check if removed.
                    for (var i = 0; i < this.state.list.size(); i++) {
                        if (this.state.list.get(i).id.dis == data.deleted) {
                            var ret = this.state.list.get(i);
                            this.state.list.remove(i);
                            this.state.list.put(i, {id: data.id, value: data.value});
                            return {pos: i, removed: ret.value, added: data.value}
                        }
                    }
                }
            },
            get: {
                local: function (pos) {
                    return null;
                },
                remote: function (data) {
                    return this.state.list.get(data).value;
                }
            },
            add: {
                local: function (pos, value) {
                    console.info(pos, value);
                    var newId = generateIds(this.state.list, pos, 1);
                    return {id: newId, value: value};
                },
                remote: function (data) {
                    //TODO: check if removed.


                    if (this.state.list.size() == 0) {
                        console.info(0)
                        this.state.list.put(0, data);
                        return {pos: 0, value: data.value};
                    }
                    var i;
                    for (i = 0; i < this.state.list.size(); i++) {
                        if (!isAfter(this.state.list.get(i).id, data.id)) {
                            break;
                        }
                    }
                    this.state.list.put(i, data);
                    return {pos: i, value: data.value};
                }
            },
            delete: {
                local: function (pos) {
                    var current = this.state.list.get(pos);
                    return current.id.dis;
                },
                remote: function (data) {
                    //TODO: check if removed.
                    // TODO: add to removes
                    for (var i = 0; i < this.state.list.size(); i++) {
                        if (this.state.list.get(i).id.dis == data) {
                            var ret = this.state.list.get(i);
                            this.state.list.remove(i);
                            return {pos: i, removed: ret.value}
                        }
                    }
                }
            }
        }
    }
};

if (typeof exports != "undefined") {
    exports.DELTA_List = Delta_Treedoc;
} else {
    CRDT_LIB.DELTA_List = Delta_Treedoc;
}


