/***
 *
 * @param fileID {String}
 * @param propertyKey {String}
 * @param callback {Function}
 */
function getPropertyFromFile(fileID, propertyKey, callback) {
    var request = gapi.client.drive.properties.get({
        'fileId': fileID,
        'propertyKey': propertyKey,
        'visibility': 'PUBLIC'
    });
    request.execute(function (resp) {
        callback(resp.value);
    });
}

/**
 * Insert a new custom file property.
 *
 * @param {String} fileId ID of the file to insert property for.
 * @param {String} key ID of the property.
 * @param {String} value Property value.
 * @param callback {Function}
 */
function addPropertyToFile(fileId, key, value, callback) {
    var body = {
        'key': key,
        'value': value,
        'visibility': 'PUBLIC'
    };
    var request = gapi.client.drive.properties.insert({
        'fileId': fileId,
        'resource': body
    });
    /*
    var request = gapi.client.drive.properties.insert(

        {
            'fileId': fileId}, body
    );pacman
    */
    request.execute(function (resp) {
        callback(resp);
    });
}

/**
 *
 * @param FileID
 * @param callback
 */
function getCurrentRevision(FileID, callback) {
    var request = gapi.client.drive.realtime.get({
        'fileId': FileID
    });
    request.execute(function (resp) {
        callback(JSON.parse(JSON.stringify((resp))));
    });
}

/**
 *
 * @param file_id
 * @param body
 * @param baseRevision
 * @param callback
 */
function drive_realtime_file_put(file_id, body, baseRevision, callback) {
    var request = gapi.client.request({
        'path': '/upload/drive/v2/files/' + file_id + '/realtime',
        'method': 'PUT',
        'params': {
            'uploadType': 'media',
            'fileId': file_id,
            'baseRevision': baseRevision
        },
        'body': JSON.stringify(body)
    });

    request.execute(function () {
        callback();
    });
}