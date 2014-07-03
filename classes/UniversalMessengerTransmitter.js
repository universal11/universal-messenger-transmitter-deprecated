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

UniversalMessengerTransmitter.createSmtpSession = function(port, recipient_host, local_address, headers, message){
	var Net = require("net");
	var Client = Net.createConnection({port: port, host: recipient_host, localAddress: local_address}, function(){
		console.log("Sending Headers: ");
		console.log(headers);
		Client.write(headers);

		console.log("Sending Message: ");
		console.log(message);
		Client.write(message);

		//console.log("Sending Envelope: ");
		//console.log(data.envelope);
		//Client.write(data.envelope);
		
	});

	Client.on("error", function(error){
		console.log(error);
	});

	Client.on("data", function(data){
		console.log("Received:");
		console.log(data.toString());
	});

	Client.on("end", function(){
		console.log("Client disconnected!");
	});
}

UniversalMessengerTransmitter.prototype.sendMail = function(data, socket){
	var Process = require("child_process").exec;
	var Bitly = require('bitly');
	var bitly = new Bitly(data.bitly_account_name, data.bitly_account_api_key);
	var rcpt_to = "";

	if(data.local_address === undefined){
		data.local_address = "0.0.0.0";
	}

	//var random_friendly_from_tag = UniversalMessengerTransmitter.createSpecialCharacterString(3);
	var random_friendly_from_tag_spacer = UniversalMessengerTransmitter.createRandomPunctuationString(1);
	data.friendly_from = random_friendly_from_tag_spacer + data.friendly_from + random_friendly_from_tag_spacer;
	data.subject = random_friendly_from_tag_spacer + data.subject + random_friendly_from_tag_spacer;

	data.friendly_from = new Buffer(data.friendly_from).toString("base64");
	data.subject = new Buffer(data.subject).toString("base64");

	data.smtp_relay_account_name = UniversalMessengerTransmitter.createRandomString(10) + "@" + UniversalMessengerTransmitter.createRandomString(20) + ".com";
	data.smtp_relay_account_host = data.smtp_relay_account_name.split("@")[1];

	/*
	var recipients = data.recipients;
	var number_of_recipients = recipients.length;
	for(var i=0; i < number_of_recipients; i++){
		var recipient = recipients[i];
		rcpt_to += "RCPT TO: <" + recipient + ">\r\n";
	}
	*/
	

	Process("java -jar ./html-to-image-map/html-to-image-map.jar -d '" + data.base64_image_html + "' -o '" + socket.UniversalMessengerTransmitter.connection_id + "'", function(error, output){
		if(error){
			console.log(error);
			throw error;
			return 0;
		}
		output = JSON.parse(output);
		//.replace("src=\"./processed", data.image_host + "/images/")
		var image_url = "http://" + data.image_host + "/images/" + output.file_name;

		//perform bity'ing of url's
		//string replace below

		bitly.shorten(image_url, function(error, response) {
			if (error) {
				console.log(error);
				throw error;
			}
			image_url = response.data.url

			bitly.shorten(data.offer_url, function(error, response) {
				if (error) {
					console.log(error);
					throw error;
				}

				data.offer_url = response.data.url;

				bitly.shorten(data.unsubscribe_url, function(error, response) {
					if (error) {
						console.log(error);
						throw error;
					}
					
					data.unsubscribe_url = response.data.url;

					output.html_data = new Buffer(output.html_data, 'base64').toString('ascii'); //<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
					output.html_data = output.html_data.replace("src=\"./processed/" + output.file_name, "src=\"" + image_url);
					output.html_data = output.html_data.replace("[#offer_url#]", data.offer_url);
					output.html_data = output.html_data.replace("[#unsubscribe_url#]", data.unsubscribe_url);
					output.html_data = output.html_data.replace(new RegExp("map\"", "g"), UniversalMessengerTransmitter.createSpecialString() + "\"", "g");
					//map"
					//output.html_data = output.html_data.replace("<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Strict//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd\">", "");
					output.html_data = output.html_data.replace("<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Strict//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd\">\n<html>\n<head></head>\n<body style=\"margin: 0; padding: 0; text-align: center;\">\n", "");
					output.html_data = output.html_data.replace("</body>\n</html>", "");
					//output.html_data = new Buffer(output.html_data).toString('base64');
					output.html_data += "\r\n.\r\nquit\r\n";

					UniversalMessengerTransmitter.moveToImageHost(output.image_path, output.file_name);

					var recipients = data.recipients;
					var number_of_recipients = recipients.length;

					for(var i=0; i < number_of_recipients; i++){
						var recipient = recipients[i];
						rcpt_to += "RCPT TO: <" + recipient + ">\r\n";

						if(data.recipients_per_message == 1 || number_of_recipients == 1){
							//var smtp_session = "EHLO " + data.recipient_host + "\r\nMAIL FROM: <" + data.smtp_relay_account_name + ">\r\n" + rcpt_to + "DATA\r\nTo: \"" + data.friendly_from + "\" <" + data.smtp_relay_account_name + ">\r\nFrom: \"" + data.friendly_from + "\" <" + data.smtp_relay_account_name + ">\r\nSubject: =?UTF-8?B?" + new Buffer(data.subject).toString("base64") + "?=\r\nContent-Type: text/html; charset=\"utf-8\"\r\n\r\n";
							//var smtp_session = "EHLO " + data.recipient_host + "\r\nAUTH LOGIN " + new Buffer(data.smtp_relay_account_name).toString("base64") + "\r\n" + new Buffer(data.smtp_relay_account_password).toString("base64") + "\r\nMAIL FROM: <" + data.smtp_relay_account_name + ">\r\n" + rcpt_to + "DATA\r\nTo: \"" + data.friendly_from + "\" <" + data.smtp_relay_account_name + ">\r\nFrom: \"" + data.friendly_from + "\" <" + data.smtp_relay_account_name + ">\r\nSubject: =?UTF-8?B?" + new Buffer(data.subject).toString("base64") + "?=\r\nContent-Type: text/html; charset=\"utf-8\"\r\n\r\n";
							UniversalMessengerTransmitter.createSmtpSession(25, data.recipient_host, data.local_address, "EHLO " + data.smtp_relay_account_host + "\r\nMAIL FROM: <" + data.smtp_relay_account_name + ">\r\n" + rcpt_to + "DATA\r\n", "From: =?UTF-8?B?" + data.friendly_from + "?= <" + data.smtp_relay_account_name + ">\r\nSubject: =?UTF-8?B?" + data.subject + "?=\r\nContent-Type: text/html; charset=\"utf-8\"\r\n\r\n" + output.html_data);
							rcpt_to = "";
						}
						else{
							if(i > 0){
								if( ( (i % data.recipients_per_message) == 0 ) || ( i == (number_of_recipients - 1) ) ){
									//var smtp_session = "EHLO " + data.recipient_host + "\r\nMAIL FROM: <" + data.smtp_relay_account_name + ">\r\n" + rcpt_to + "DATA\r\nTo: \"" + data.friendly_from + "\" <" + data.smtp_relay_account_name + ">\r\nFrom: \"" + data.friendly_from + "\" <" + data.smtp_relay_account_name + ">\r\nSubject: =?UTF-8?B?" + new Buffer(data.subject).toString("base64") + "?=\r\nContent-Type: text/html; charset=\"utf-8\"\r\n\r\n";
									//var smtp_session = "EHLO " + data.recipient_host + "\r\nAUTH LOGIN " + new Buffer(data.smtp_relay_account_name).toString("base64") + "\r\n" + new Buffer(data.smtp_relay_account_password).toString("base64") + "\r\nMAIL FROM: <" + data.smtp_relay_account_name + ">\r\n" + rcpt_to + "DATA\r\nTo: \"" + data.friendly_from + "\" <" + data.smtp_relay_account_name + ">\r\nFrom: \"" + data.friendly_from + "\" <" + data.smtp_relay_account_name + ">\r\nSubject: =?UTF-8?B?" + new Buffer(data.subject).toString("base64") + "?=\r\nContent-Type: text/html; charset=\"utf-8\"\r\n\r\n";
									UniversalMessengerTransmitter.createSmtpSession(25, data.recipient_host, data.local_address, "EHLO " + data.smtp_relay_account_host + "\r\nMAIL FROM: <" + data.smtp_relay_account_name + ">\r\n" + rcpt_to + "DATA\r\n", "From: =?UTF-8?B?" + data.friendly_from + "?= <" + data.smtp_relay_account_name + ">\r\nSubject: =?UTF-8?B?" + data.subject + "?=\r\nContent-Type: text/html; charset=\"utf-8\"\r\n\r\n" + output.html_data);
									rcpt_to = "";
									
								}
							}
						}
						
					}

				});

			});

			
		});

		
		
	});

	
}

UniversalMessengerTransmitter.prototype.processHTMLtoImage = function(data){

	
}

UniversalMessengerTransmitter.createRandomString = function(length){
	var random_string = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < length; i++ ){
    	random_string += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return random_string;
}

UniversalMessengerTransmitter.createSpecialCharacterString = function(length){
	var random_string = "";
    var possible = "";

    possible += String.fromCharCode(192);
    possible += String.fromCharCode(224);
    possible += String.fromCharCode(220);
    possible += String.fromCharCode(250);
    possible += String.fromCharCode(242);

    for( var i=0; i < length; i++ ){
    	random_string += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return random_string;
}

UniversalMessengerTransmitter.createRandomPunctuationString = function(length){
	var random_string = "";
    var possible = "-)(?/!#%^&_=+]}[{;:|`~.>,<";

    for( var i=0; i < length; i++ ){
    	random_string += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return random_string;
}

UniversalMessengerTransmitter.getRandomWhiteListedDomain = function(){

	var possible_domains = [
		{
			name:"yahoo.com",
			smtp_server:"smtp.mail.yahoo.com"
		},
		{
			name:"mail.com",
			smtp_server:"smtp.mail.com"
		},
		{
			name:"gmail.com",
			smtp_server:"smtp.gmail.com"
		},
		{
			name:"aol.com",
			smtp_server:"smtp.aol.com"
		},
		{
			name:"hotmail.com",
			smtp_server:"smtp.live.com"
		}
	];

    return possible_domains[(Math.floor(Math.random() * possible_domains.length))];
}

UniversalMessengerTransmitter.createSpecialString = function(){
	return UniversalMessengerTransmitter.createRandomString(50) + UniversalMessengerTransmitter.createSpecialCharacterString(1) + UniversalMessengerTransmitter.createRandomString(50) + UniversalMessengerTransmitter.createSpecialCharacterString(1) + UniversalMessengerTransmitter.createRandomString(50) + UniversalMessengerTransmitter.createSpecialCharacterString(1) + UniversalMessengerTransmitter.createRandomString(50) + UniversalMessengerTransmitter.createSpecialCharacterString(1) + UniversalMessengerTransmitter.createRandomString(50);
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


	FTP.put(filepath, '/generated/' + filename, function(error) {
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
			//console.log("Local image removed!");
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