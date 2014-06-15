function UniversalMessengerServer(){
	this.connections = new Array();
}

UniversalMessengerServer.ACTIONS = {
	SEND_MAIL:1,
	QUIT:0
}


UniversalMessengerServer.getActionNameById = function(actionId){
	switch(actionId){
		case UniversalMessengerServer.ACTIONS.QUIT:
			return "Quit";
		case UniversalMessengerServer.ACTIONS.AUTHENTICATE:
			return "Authenticate";
		case UniversalMessengerServer.ACTIONS.SEND_MAIL:
			return "Send Mail";
		default:
			return "Unknown";
	}
}


UniversalMessengerServer.sendMail = function(data){
	var Net = require("net");

	var Client = Net.connect(25, data.recipient_host, function(error){

		console.log("Sending Envelope: ");
		console.log(data.envelope);
		Client.write(data.envelope);

		//console.log("Sending Envelope: ");
		//console.log(data.envelope);
		//Client.write(data.envelope);
		
	});

	Client.on("data", function(data){
		console.log("Received:");
		console.log(data.toString());
	});

	Client.on("end", function(){
		console.log("Client disconnected!");
	});
}

module.exports = UniversalMessengerServer;