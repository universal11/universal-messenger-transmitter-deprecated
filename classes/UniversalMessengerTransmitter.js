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

UniversalMessengerTransmitter.createSmtpSession = function(port, recipient_host, local_address, smtp_relay_account_name, message, connection, recipients, friendly_from, subject){
	var Net = require("net");
	var response = "";
	var number_of_recipients = recipients.length;
	var greeting_recieved = false;
	var transmitter_response = {
		success:false,
		invalid_recipients:[],
	};

	//DATA\r\nFrom: =?UTF-8?B?" + data.friendly_from + "?= <" + data.smtp_relay_account_name + ">\r\nTo: \"" + recipient.split("@")[0] + "\" <" + recipient + ">\r\n

	var smtp_envelope = "";

	for(var i=0; i < number_of_recipients; i++){
		var recipient = recipients[i];

		//for(var j=0; j < 50000; j++){
		var random_friendly_from_tag_spacer = UniversalMessengerTransmitter.createRandomPunctuationString(1);
		var random_friendly_from  = random_friendly_from_tag_spacer + friendly_from + random_friendly_from_tag_spacer;
		random_friendly_from = UniversalMessengerTransmitter.randomizeSpaces(random_friendly_from);
		random_friendly_from = new Buffer(random_friendly_from).toString("base64");

		var random_subject = UniversalMessengerTransmitter.randomizeSpaces(subject);
		random_subject = new Buffer(random_subject).toString("base64");


		smtp_envelope += "RCPT TO: <" + recipient + ">\r\nDATA\r\nFrom: =?UTF-8?B?" + random_friendly_from + "?= <" + smtp_relay_account_name + ">\r\nTo: \"" + recipient.split("@")[0] + "\" <" + recipient + ">\r\nSubject: =?UTF-8?B?" + random_subject + "?=\r\n" + message + "RSET\r\n";

	//	}
		
	}
	smtp_envelope += "quit\r\n";

	var Client = Net.createConnection({port: port, host: recipient_host, localAddress: local_address}, function(){
		//console.log("Sending Headers: ");
		//console.log(headers);
		//console.log("Sent: " + headers + message);
		
		//var additional_message = "RSET\r\n" + headers + message;
		//console.log("Smtp Envelope: ");
		//console.log(smtp_envelope);


		//Client.write(smtp_envelope); //moved this 2014/7/14

		//console.log("Sending Message: ");
		//console.log(message);
		//Client.write(message);

		//console.log("Sending Envelope: ");
		//console.log(data.envelope);
		//Client.write(data.envelope);
		
	});

	Client.on("error", function(error){
		console.log("Error from: " + recipient_host);
		console.log(error);
		connection.write(JSON.stringify(transmitter_response) + "\r\n");
	});

	Client.on("data", function(data){
		if(!greeting_recieved){
			greeting_recieved = true;
			var response_lines = data.toString().split("\r\n");
			//console.log(response_lines);
			var response_line = response_lines[0];
			var response_line_parts = response_line.split(" ");
			var response_code = parseInt(response_line_parts[0]);
			var smtp_server_host = response_line_parts[1];
			if(response_code == 220){
				smtp_envelope = "EHLO " + smtp_server_host + "\r\nMAIL FROM: <" + smtp_relay_account_name + ">\r\n" + smtp_envelope;
				Client.write(smtp_envelope);
			}
			
		}
		response += data.toString();
	});

	Client.on("end", function(){
		console.log("Disconnected from " + recipient_host);
		console.log("Response from: " + recipient_host);
		//console.log(response);

		var response_lines = response.split("\r\n");
		var number_of_response_lines = response_lines.length;

		var checked_for_success = false;
		var is_success = true;
		for(var j=0; j < number_of_recipients; j++){
			var recipient = recipients[j];
			var is_valid = false;
			for(var i =0; i < number_of_response_lines; i++){
				var response_line = response_lines[i];

				if(!checked_for_success){
					var response_code = parseInt(response_line.substr(0, 3));
					if(response_code > 354){
						is_success = false;
					}
				}

				if(!is_valid){
					
					if(response_line.indexOf(recipient) > -1){
						is_valid = true;
					}
				}
			}

			if(!checked_for_success){
				checked_for_success = true;
			}

			if(is_success){
				if(!is_valid){
					transmitter_response.invalid_recipients.push(recipient);
				}
			}
			
		}

		transmitter_response.success = is_success;

		//var response_line = response_lines[0];
		
		connection.write(JSON.stringify(transmitter_response) + "\r\n");
		//UniversalMessengerTransmitter.smtpResponseHandler(response, connection, recipients);
	});
}

UniversalMessengerTransmitter.smtpResponseHandler = function(response, connection, recipient){
	var response_lines = response.split("\r\n");
	var number_of_response_lines = response_lines.length;
	var is_after_data_command = false;
	var last_response_code = -1;

	var data = {
		recipient: recipient,
		success: true,
		is_valid: false
	};

	//
	// Checks for send errors
	//

	for(var i=0; i < number_of_response_lines; i++){
		var response_line = response_lines[i];
		var response_code = parseInt(response_line.substr(0, 3));
		if(!isNaN(response_code)){
			last_response_code = response_code;
			if(response_code == 354){
				data.is_valid = true;
			}
			else if(response_code > 354){
				data.success = false;
			}
		}

	}

	if(last_response_code == -1){
		//console.log(last_response_code);
		data.success = false;
	}

	connection.write(JSON.stringify(data) + "\r\n");
}

UniversalMessengerTransmitter.randomizeSpaces = function(string_with_spaces){
	var string_parts = string_with_spaces.split(" ");
	var number_of_string_parts = string_parts.length;
	for(var i=0; i < number_of_string_parts; i++){
		string_parts[i] += UniversalMessengerTransmitter.getRandomSpacerCharacters(1);
	}
	return string_parts.join("");
}

UniversalMessengerTransmitter.prototype.sendMail = function(data, socket){
	var Process = require("child_process").exec;
	var Bitly = require('bitly');
	var bitly = new Bitly(data.bitly_account_name, data.bitly_account_api_key);
	var rcpt_to = "";
	var white_list_domain = UniversalMessengerTransmitter.getRandomWhiteListedDomain();
	var Chance = require('chance');
	var chance = new Chance();

	if(data.local_address === undefined){
		data.local_address = "0.0.0.0";
	}


	/*
	var random_friendly_from_tag_spacer = UniversalMessengerTransmitter.createRandomPunctuationString(1);
	data.friendly_from = random_friendly_from_tag_spacer + data.friendly_from + random_friendly_from_tag_spacer;
	data.friendly_from = UniversalMessengerTransmitter.randomizeSpaces(data.friendly_from);
	data.friendly_from = new Buffer(data.friendly_from).toString("base64");
	*/

	



	data.smtp_relay_account_name = chance.name().replace(/\s/g, '').toLowerCase() + "@" + data.email_provider_host;
	//data.smtp_relay_account_host = white_list_domain.smtp_server;

	/*
	var recipients = data.recipients;
	var number_of_recipients = recipients.length;
	for(var i=0; i < number_of_recipients; i++){
		var recipient = recipients[i];
		rcpt_to += "RCPT TO: <" + recipient + ">\r\n";
	}
	*/

	Process("java -jar ./html-to-image-map/html-to-image-map.jar -d '" + data.base64_image_html + "' -o '" + socket.UniversalMessengerTransmitter.connection_id + "-" + new Date().getTime() + "'", function(error, output){
		if(error){
			console.log(error);
			throw error;
			return 0;
		}
		console.log("Html To Image Response: " + output);
		output = JSON.parse(output);
		//.replace("src=\"./processed", data.image_host + "/images/")
		data.offer_url = "http://" + chance.string({pool: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"}) + "." + data.image_host + "/warpdrive.php?c=" + data.campaign_id + "&" + chance.string({pool: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"}) + "=" + chance.string({pool: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"});
		data.unsubscribe_url = "http://" + chance.string({pool: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"}) + "." + data.image_host + "/disengage.php?c=" + data.campaign_id + "&" + chance.string({pool: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"}) + "=" + chance.string({pool: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"});
		var image_url = "http://" + chance.string({pool: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"}) + "." + data.image_host + "/asset.php?p=" + output.file_name.replace(".png", "") + "&" + chance.string({pool: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"}) + "=" + chance.string({pool: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"});

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
					output.html_data = output.html_data.replace("<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Strict//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd\">\n<html>\n<head></head>\n<body style=\"margin: 0; padding: 0; text-align: center;\">\n", "<div style=\"width: 100%; text-align: center;\">");
					output.html_data = output.html_data.replace("</body>\n</html>", "</div>");
					//output.html_data = new Buffer(output.html_data).toString('base64');
					output.html_data += "\r\n.\r\n";
					//output.html_data = UniversalMessengerTransmitter.createRandomStyleTag() + output.html_data;

					UniversalMessengerTransmitter.moveToImageHost(output.image_path, output.file_name, data.image_host, data.ftp_user, data.ftp_pass, data.ftp_port);
					UniversalMessengerTransmitter.createSmtpSession(25, data.recipient_host, data.local_address, data.smtp_relay_account_name, "MIME-version: 1.0\r\nContent-type: text/html\r\n\r\n" + output.html_data, socket, data.recipients, data.friendly_from, data.subject);

				});

			});

			
		});

		
		
	});

	
}

UniversalMessengerTransmitter.prototype.processHTMLtoImage = function(data){

	
}

UniversalMessengerTransmitter.createRandomStyleTag = function(){
	var style_tag = "<style>";
	for(var i = 0; i < 50; i++){
		style_tag += UniversalMessengerTransmitter.createSpecialString() + "\n";
	}
	style_tag += "</style>";
	return style_tag;
}

UniversalMessengerTransmitter.createRandomString = function(length){
	var random_string = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < length; i++ ){
    	random_string += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return random_string;
}

UniversalMessengerTransmitter.getRandomSpacerCharacters = function(length){
	var random_string = "";
    var possible = "_ .";
     for( var i=0; i < length; i++){
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
    var possible = "-)(?/!#%^&_=+]} [{;:|`~.,";

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
		}
		/*
		,
		{
			name:"hotmail.com",
			smtp_server:"smtp.live.com"
		}
		*/
	];

    return possible_domains[(Math.floor(Math.random() * possible_domains.length))];
}

UniversalMessengerTransmitter.createSpecialString = function(){
	return UniversalMessengerTransmitter.createRandomString(50) + UniversalMessengerTransmitter.createSpecialCharacterString(1) + UniversalMessengerTransmitter.createRandomString(50) + UniversalMessengerTransmitter.createSpecialCharacterString(1) + UniversalMessengerTransmitter.createRandomString(50) + UniversalMessengerTransmitter.createSpecialCharacterString(1) + UniversalMessengerTransmitter.createRandomString(50) + UniversalMessengerTransmitter.createSpecialCharacterString(1) + UniversalMessengerTransmitter.createRandomString(50);
}

UniversalMessengerTransmitter.moveToImageHost = function(filepath, filename, ftp_host, ftp_user, ftp_pass, ftp_port){
	console.log("Moving: " + filename + " - at - " + filepath);
	var JSFTP = require("jsftp");
	var Process = require("child_process").exec;
	var FTP = new JSFTP({
	  host: ftp_host,
	  port: ftp_port, // defaults to 21
	  user: ftp_user, // defaults to "anonymous"
	  pass: ftp_pass // defaults to "@anonymous"
	});


	/*
	host: "enterwebdeals.com",
	  port: 21, // defaults to 21
	  user: "creativeimages", // defaults to "anonymous"
	  pass: "batman11!" // defaults to "@anonymous"

	 */


	FTP.put(__dirname + "/processed/" + filename, '/generated/' + filename, function(error) {
		if(error){
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

UniversalMessengerTransmitter.prototype.authenticate = function(data, socket){
	/*
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
*/
	var universalMessengerTransmitter = this;
	socket.UniversalMessengerTransmitter.is_authenticated = true;
	universalMessengerTransmitter.addConnection(socket);
	console.log("Authentication Successful!");
}

module.exports = UniversalMessengerTransmitter;