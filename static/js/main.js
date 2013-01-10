(function ($) {
	
	var localStream ;
	var pc ;
	var ws ;
	var ws_open = 0;
	var mediaConstraints ;
	var mediaStreams;
	var iceStuff = $.parseJSON('{"iceServers": [{"url": "stun:stun.l.google.com:19302"}]}');

	var failedGUM = function(e) {
		// Failed to getUserMedia
		console.log('Failed to get user media.', e);
	};

	var wsSend = function (command, destination, extras) {
		var data = { command: command, destination: destination } ;

		if ( typeof extras !== 'undefined' ) {
			data = $.extend(data, extras);
		}
		if (ws_open === 1) {
			ws.send(JSON.stringify(data));
		} else {
			console.log("ERROR: Websocket not open.");
		}
	};

	var sendOffer = function (sessDesc) {
		pc.setLocalDescription(sessDesc);
		wsSend(
            "SEND", 
            "/pair/"+token,
            {content: { action: "offer", offer: sessDesc }}
        );
	};

	var sendAnswer = function (sessDesc) {
		pc.setLocalDescription(sessDesc);
		wsSend(
            "SEND", 
            "/pair/"+token,
            {content: { action: "answer", answer: sessDesc }}
        );
	};

    var sinsSubscribe = function (destination) {
        wsSend('SUBSCRIBE', destination);
    };  

    var sinsUnsubscribe = function (destination) {
        
        wsSend('UNSUBSCRIBE', destination);
    };  

	var doPlayer2Init = function () {
		createPeerConnection();
		pc.createOffer(sendOffer, null, mediaConstraints);
	};

	var createPeerConnection = function () {

		pc = new RTCPeerConnection(iceStuff);
		pc.onconnecting = function (m) { console.log("SessionConnecting", m); }; //onSessionConnecting;
		pc.onopen = function (m) { console.log("SessionOpen", m); }; //onSessionOpened;
		pc.onaddstream = function (m) { 
			console.log("SessionAddStream", m); 
			attachMediaStream($('#remote-stream')[0], m.stream);
		}; //onRemoteStreamAdded;

		pc.onremovestream = function (m) { 
			console.log("SessionRemoveStream", m); 
		}; //onRemoteStreamRemoved;

		pc.onicecandidate = function (event) { 
            console.log("SessionIceCandidate", event); 
            var ice_dest = "/pair/"+token;

			if (event.candidate) {
				wsSend(
                    "SEND",
                    ice_dest,
                    { content: {
                        action: "candidate",
						label: event.candidate.sdpMLineIndex,
						id: event.candidate.sdpMid,
						candidate: event.candidate.candidate
					  }
                    }
				);
			} else { console.log("End of candidates.");
			}
		}; //onIceCandidate;


		pc.addStream(localStream);
	};

	var wsOnMessage = function (msg) {
		
		var message_data = JSON.parse(msg.data);
		if ( message_data.action === "offer" ) {
			createPeerConnection();
			pc.setRemoteDescription(new RTCSessionDescription(message_data.offer));
			pc.createAnswer(sendAnswer, null, mediaConstraints);
		} else if ( message_data.action === "answer" ) {
			pc.setRemoteDescription(new RTCSessionDescription(message_data.answer));
		} else if ( message_data.action === "candidate" ) {
			var cand_data = {sdpMLineIndex:message_data.label, candidate:message_data.candidate};
			var candidate = new RTCIceCandidate(cand_data);
			pc.addIceCandidate(candidate);
		} else if ( message_data.command === "DISCONNECT" ) {
			window.location.href = '/disconnected/'+token
		}
	};

    $(window.document).ready(function () {

		if (mediaType === "voice") {
			mediaConstraints = {
				'mandatory': {
					'OfferToReceiveAudio':true, 
					'OfferToReceiveVideo':false}};
			mediaStreams = {video: false, audio: true}

		} else if(mediaType === "video") {
			mediaConstraints = {
				'mandatory': {
					'OfferToReceiveAudio':true, 
					'OfferToReceiveVideo':true }};
			mediaStreams = {video: true, audio: true}

		} else {
			console.log("Unknown media type ", mediaType);
		}

        ws = new WebSocket("ws://" + document.domain + ":5000/sins");
        ws.onmessage = wsOnMessage;
		ws.onopen = function(evt) { ws_open = 1; }; 
		ws.onclose = function(evt) { ws_open = 0; }; 
		ws.onerror = function(evt) { ws_open = 0; }; 

		getUserMedia(mediaStreams, function(lStream) {
			localStream = lStream
			attachMediaStream($('#local-stream')[0], localStream);
            sinsSubscribe('/pair/'+token);
			
			if ( role === "player2" ) {
				doPlayer2Init();
			}
		}, failedGUM);
   });

}(jQuery));
