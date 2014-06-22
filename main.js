var Net = require("net");
var Mysql = require("mysql");
var UniversalMessengerTransmitter = require("./classes/UniversalMessengerTransmitter.js");
var HOST = "0.0.0.0";
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
	socket.UniversalMessengerTransmitter = {
		is_authenticated:false,
		connection_id: UUID.v1(),
	};

	var universalMessengerTransmitter = new UniversalMessengerTransmitter();

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
			console.log("Request: " + UniversalMessengerTransmitter.getActionNameById(data.action) + dataAsJsonString);
			switch(data.action){
				case UniversalMessengerTransmitter.ACTIONS.QUIT:
					socket.end(); 
					break;
				case UniversalMessengerTransmitter.ACTIONS.SEND_MAIL:
					if(!socket.UniversalMessengerTransmitter.is_authenticated){
						socket.end();
						return 0;
					}
					universalMessengerTransmitter.sendMail(data, dbConnection); 
					break;
				case UniversalMessengerTransmitter.ACTIONS.AUTHENTICATE:
					if(!socket.UniversalMessengerTransmitter.is_authenticated){
						universalMessengerTransmitter.authenticate(data, dbConnection, socket);
					}
					break;
				case UniversalMessengerTransmitter.ACTIONS.GET_IP_ADDRESS_DATA:
					if(!socket.UniversalMessengerTransmitter.is_authenticated){
						socket.end();
						return 0;
					}
					universalMessengerTransmitter.getIpAddressData(socket);
					break;
				case UniversalMessengerTransmitter.ACTIONS.PROCESS_HTML_TO_IMAGE:
					if(!socket.UniversalMessengerTransmitter.is_authenticated){
						socket.end();
						return 0;
					}
					universalMessengerTransmitter.processHTMLtoImage(data, dbConnection, socket); 
					break;
				default:
					break;
			}
		}

	});

	socket.on("end", function(){
		console.log("Client disconnected!");
		universalMessengerTransmitter.removeConnection(socket.UniversalMessengerTransmitter.connection_id);
	});

}).listen(PORT, HOST);



console.log("Server started.");