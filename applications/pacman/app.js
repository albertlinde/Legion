//NODE
var
    gameport        = 8000,
    express         = require('express'),
    http            = require('http'),
    app             = express(),
    server          = http.createServer(app);

//HTTP
server.listen(gameport)

if(process.argv.length < 3){
    console.log("Missing games list file id");
    //process.exit()
}
var fileId = process.argv[2];
console.log('Listening on port ' + gameport );

//EXPRESS
app.get( '/game', function( req, res ){
    //console.log('\t :: Express :: trying to load %s', __dirname + '/index.html');
    res.sendfile( '/game.html' , { root:__dirname });
});

app.get( '/', function( req, res ){
    //console.log('\t :: Express :: trying to load %s', __dirname + '/index.html');
    if(fileId){
      res.redirect('/gamelist.html?file='+fileId);
    } else {
      res.redirect('/creategamelist.html');
    }
});

app.get( '/gamelist', function( req, res ){
    //console.log('\t :: Express :: trying to load %s', __dirname + '/index.html');
    res.sendfile( '/gamelist.html' , { root:__dirname });
});

app.get( '/*' , function( req, res, next ) {
    var file = req.params[0];
    //console.log('\t :: Express :: file requested : ' + file);
    res.sendfile( __dirname + '/' + file );
    console.log("Asked for: " + file);
}); //app.get *
