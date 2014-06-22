function UniversalMessengerTransmitter(){
	this.connections = new Array();
}

UniversalMessengerTransmitter.ACTIONS = {
	GET_IP_ADDRESS_DATA: 3,
	AUTHENTICATE:2,
	SEND_MAIL:1,
	QUIT:0
}


UniversalMessengerTransmitter.getActionNameById = function(actionId){
	switch(actionId){
		case UniversalMessengerTransmitter.ACTIONS.QUIT:
			return "Quit";
		case UniversalMessengerTransmitter.ACTIONS.AUTHENTICATE:
			return "Authenticate";
		case UniversalMessengerTransmitter.ACTIONS.SEND_MAIL:
			return "Send Mail";
		case UniversalMessengerTransmitter.ACTIONS.GET_IP_ADDRESS_DATA:
			return "Get IP Address Data";
		default:
			return "Unknown";
	}
}

UniversalMessengerTransmitter.prototype.addConnection = function(socket){
	this.connections[socket.UniversalMessengerTransmitter.connection_id] = socket;
}

UniversalMessengerTransmitter.prototype.getIpAddressData = function(socket){
	var Process = require("child_process").exec;
	Process('ifconfig | grep "inet " | grep -v 127.0.0.1', function(error, output){
		if(error){
			console.log(error);
			throw error;
			return 0;
		}
		var response = {
			output: output
		};
		socket.write(JSON.stringify(response) + "\r\n");
	});
}


UniversalMessengerTransmitter.prototype.sendMail = function(data){
	var Net = require("net");
	if(data.local_address === undefined){
		data.local_address = "0.0.0.0";
	}
	var Client = Net.createConnection({port: 25, host: data.recipient_host, localAddress: data.local_address}, function(){
		console.log(Client);
		console.log("Sending Message: ");
		console.log(data.message);
		Client.write(data.message);

		//console.log("Sending Envelope: ");
		//console.log(data.envelope);
		//Client.write(data.envelope);
		
	});

	Client.on("error", function(error){
		console.log(error);
		throw error;
		return 0;
	});

	Client.on("data", function(data){
		console.log("Received:");
		console.log(data.toString());
	});

	Client.on("end", function(){
		console.log("Client disconnected!");
	});
}

UniversalMessengerTransmitter.prototype.authenticate = function(data, db_connection, socket){
	var universalMessengerTransmitter = this;
	db_connection.query("SELECT * FROM universal_messenger.accounts WHERE name = '" + data.name + "' AND password = '" + data.password + "' LIMIT 1", function(error, rows){
		if(error){
			console.log(error);
			throw error;
			return 0;
		}
		if(rows.length > 0){
			socket.UniversalMessengerTransmitter.is_authenticated = true;
			db_connection.query("UPDATE universal_messenger.smtp_relay_accounts SET last_connection_id = '" + socket.UniversalMessengerTransmitter.connection_id + "'", function(error, rows){
				if(error){
					console.log(error);
					throw error;
					return 0;
				}
			});
			universalMessengerTransmitter.addConnection(socket);
			socket.write(JSON.stringify(rows[0]) + "\r\n");

		}
	});
}

module.exports = UniversalMessengerTransmitter;