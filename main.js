var Net = require("net");
var Mysql = require("mysql");
var UniversalMessengerServer = require("./classes/UniversalMessengerServer.js");
var HOST = "localhost";
var PORT = 1337;
//var universalMessengerServer = new UniversalMessengerServer();
var UUID = require("node-uuid");

console.log("Connecting to DB...");

var dbConnection = Mysql.createConnection({
	host:"localhost",
	user:"root",
	password:""
});

	

var Server = Net.createServer(function(socket){
	socket.UniversalMessengerServer = {
		is_authenticated:false,
		client_id: UUID.v1(),
	};

	socket.write("Connected to " + socket.localAddress + ":" + socket.localPort + "\r\n");
	socket.write("From " + socket.remoteAddress + ":" + socket.remotePort + "\r\n");

	socket.on("data", function(data){
		data = data.toString();
		if(data != "\r\n" && data != ""){
			var dataAsJsonString = data;
			try{
				data = JSON.parse(data);
			}
			catch(exception){
				console.log("Request: " + dataAsJsonString);
				console.log("Parse error: " + exception);
				return 0;
			}
			console.log("Request: " + UniversalMessengerServer.getActionNameById(data.action) + dataAsJsonString);
			switch(data.action){
				case UniversalMessengerServer.ACTIONS.QUIT:
					socket.end(); 
					break;
				case UniversalMessengerServer.ACTIONS.SEND_MAIL:
					UniversalMessengerServer.sendMail(data, dbConnection); 
					break;
				default:
					break;
			}
		}

	});

	socket.on("end", function(){
		console.log("Client disconnected!");
		mfServer.removeSocket(socket.UniversalMessengerServer.client_id);
	});

}).listen(PORT, HOST);



console.log("Server started.");