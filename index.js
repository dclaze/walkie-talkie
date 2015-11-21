var express = require('express'),
    app = express(),
    http = require('http').Server(app),
    io = require('socket.io')(http);

app.use(express.static('public'));

io.on('connection', function(socket) {
    socket.join('walkie-talkie');

    socket.on('talk', function(msg) {
        socket.broadcast.to('walkie-talkie').emit('talk', msg);
    });
});

http.listen(3011, function() {
    console.log('listening on *:3011');
});