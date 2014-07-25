var Net = require("net");
//var Mysql = require("mysql");
var UniversalMessengerTransmitter = require("./classes/UniversalMessengerTransmitter.js");
var HOST = "0.0.0.0";
var PORT = 1337;
//var universalMessengerServer = new UniversalMessengerServer();
var UUID = require("node-uuid");

//console.log("Connecting to DB...");

/*
var dbConnection = Mysql.createConnection({
	host:"localhost",
	user:"root",
	password:""
});
*/

	

var Server = Net.createServer(function(socket){
	socket.UniversalMessengerTransmitter = {
		is_authenticated:false,
		connection_id: UUID.v1(),
	};

	var universalMessengerTransmitter = new UniversalMessengerTransmitter();

	//socket.write("Connected to " + socket.localAddress + ":" + socket.localPort + "\r\n");
	//socket.write("From " + socket.remoteAddress + ":" + socket.remotePort + "\r\n");
	var request_data = "";

	socket.on("data", function(data){
		if(data != "\r\n" && data != ""){
			data = data.toString();
			request_data += data;
			if(request_data.indexOf("\u2404") > -1){

					var dataAsJsonString = request_data;
					try{
						data = JSON.parse(request_data);
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
							return 0;
							break;
						case UniversalMessengerTransmitter.ACTIONS.SEND_MAIL:
							/*
							if(!socket.UniversalMessengerTransmitter.is_authenticated){
								socket.end();
								return 0;
							}
							*/
							universalMessengerTransmitter.sendMail(data, socket); 
							break;
						case UniversalMessengerTransmitter.ACTIONS.AUTHENTICATE:
							if(!socket.UniversalMessengerTransmitter.is_authenticated){
								universalMessengerTransmitter.authenticate(data, socket);
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
							//universalMessengerTransmitter.processHTMLtoImage(data, dbConnection, socket); 
							break;
						default:
							break;
					}
			}

		}

	});

	socket.on("end", function(){
		console.log("Client disconnected!");
		//universalMessengerTransmitter.removeConnection(socket.UniversalMessengerTransmitter.connection_id);
	});

}).listen(PORT, HOST);



console.log("Server started.");