function UniversalMessengerTransmitter(){
	this.connections = new Array();
}

UniversalMessengerTransmitter.ACTIONS = {
	PROCESS_HTML_TO_IMAGE: 4,
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
		case UniversalMessengerTransmitter.ACTIONS.PROCESS_HTML_TO_IMAGE:
			return "Process HTML To Image";
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


UniversalMessengerTransmitter.prototype.sendMail = function(data, socket){
	var Net = require("net");
	var Process = require("child_process").exec;
	var rcpt_to = "";

	if(data.local_address === undefined){
		data.local_address = "0.0.0.0";
	}

	var recipients = data.recipients;
	var number_of_recipients = recipients.length;
	for(var i=0; i < number_of_recipients; i++){
		var recipient = recipients[i];
		rcpt_to += "RCPT TO: <" + recipient + ">\r\n";
	}

	var smtp_session = "EHLO batman.com\r\nAUTH LOGIN " + new Buffer(data.smtp_relay_account_name).toString("base64") + "\r\n" + new Buffer(data.smtp_relay_account_password).toString("base64") + "\r\nMAIL FROM: <" + data.smtp_relay_account_name + ">\r\n" + rcpt_to + "DATA\r\nfrom: \"" + data.friendly_from + "\" <" + data.smtp_relay_account_name + ">\r\nsubject: =?UTF-8?B?" + new Buffer(data.subject).toString("base64") + "?=\r\nContent-Type: text/plain; charset=\"utf-8\"\r\nContent-Transfer-Encoding: base64\r\n\r\n";


	Process("java -jar ./html-to-image-map/html-to-image-map.jar -d '" + data.base64_image_html + "' -o '" + socket.UniversalMessengerTransmitter.connection_id + "'", function(error, output){
		if(error){
			console.log(error);
			throw error;
			return 0;
		}
		output = JSON.parse(output);

		smtp_session += output.html_data + "\r\n.\r\n";

		UniversalMessengerTransmitter.moveToImageHost(output.image_path, output.file_name);

		var Client = Net.createConnection({port: 25, host: data.recipient_host, localAddress: data.local_address}, function(){
			console.log(Client);
			console.log("Sending Message: ");
			console.log(smtp_session);
			Client.write(smtp_session);

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
	});

	
}

UniversalMessengerTransmitter.prototype.processHTMLtoImage = function(data){

	
}

UniversalMessengerTransmitter.moveToImageHost = function(filepath, filename){
	var JSFTP = require("jsftp");
	var Process = require("child_process").exec;
	var FTP = new JSFTP({
	  host: "theuniversalframework.com",
	  port: 21, // defaults to 21
	  user: "creativeimages", // defaults to "anonymous"
	  pass: "batman11!" // defaults to "@anonymous"
	});

	FTP.put(filepath, 'generated/' + filename, function(error) {
		if (error){
	  		console.log(error);
	  		throw error;
	  		return 0;
	  	} 

	  	Process("rm -rf " + filepath, function(error, output){
			if(error){
				console.log(error);
				throw error;
				return 0;
			}
			console.log("Local image removed!");
		});

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