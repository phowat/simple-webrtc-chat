(function ($) {
	
	var localStream ;
	var pc1 = { pname: null, pc: null };
	var pc2 = { pname: null, pc: null };
	var ws ;
	var ws_open = 0;
	var mediaConstraints ;
	var mediaStreams;
	var iceStuff = $.parseJSON(
        '{"iceServers": [{"url": "stun:stun.l.google.com:19302"}]}');

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

	var sendOffer = function (sessDesc, destination, pc) {
		pc.setLocalDescription(sessDesc);
		wsSend(
            "SEND", 
            destination,
            {content: { action: "offer", offer: sessDesc }}
        );
	};

	var sendAnswer = function (sessDesc, destination, pc) {
		pc.setLocalDescription(sessDesc);
		wsSend(
            "SEND", 
            destination,
            {content: { action: "answer", answer: sessDesc }}
        );
	};

    var sinsSubscribe = function (destination) {
        wsSend('SUBSCRIBE', destination);
    };  

    var sinsUnsubscribe = function (destination) {
        
        wsSend('UNSUBSCRIBE', destination);
    };  

	var doPlayer2Init = function (pname) {
		createPeerConnection(pc1, pname);
		pc1.pc.createOffer(
            function (sd) { sendOffer(sd, "/pair/"+pname, pc1.pc); },
            null, 
            mediaConstraints
        );
	};

	var doPlayer3Init = function () {
		//TODO
//		createPeerConnection();
//		pc.createOffer(sendOffer, null, mediaConstraints);
	};

	var createPeerConnection = function (pc, pname) {

        console.log("Creating peer connection "+pname);
        pc.pname = pname;
        pc.pc = new RTCPeerConnection(iceStuff);
		pc.pc.onconnecting = function (m) { console.log("pcConnecting", m); };
		pc.pc.onopen = function (m) { console.log("SessionOpen", m); };
		pc.pc.onaddstream = function (m) { 
			console.log("SessionAddStream", m); 
			attachMediaStream($('#remote-stream-1')[0], m.stream);
		}; //onRemoteStreamAdded;

		pc.pc.onremovestream = function (m) { 
			console.log("SessionRemoveStream", m); 
		}; //onRemoteStreamRemoved;

		pc.pc.onicecandidate = function (event) { 
            console.log("SessionIceCandidate", event); 
            var ice_dest = "/pair/"+pname;

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
			} else { 
                console.log("End of candidates.");
			}
		}; //onIceCandidate;


		pc.pc.addStream(localStream);
	};

	var wsOnMessage = function (msg) {
		
		var message_data = JSON.parse(msg.data);
        var content = message_data.content;
        var destination = message_data.destination;
        var pname = destination.split("/")[2];
        var pc;

        console.log( "action", content.action, "pc1", pc1.pname, "pc2", pc2.name );
		if ( content.action === "offer" ) {
            if (pc1.pname === null) {
                pc = pc1;
            } else if (pc2.pname === null) {
                pc = pc2;
            } else {
                console.log("Unknown pair", pname);
                return;
            }
			createPeerConnection(pc, pname);
			pc.pc.setRemoteDescription(
                new RTCSessionDescription(content.offer)
            );
			pc.pc.createAnswer(
                function (sd) { sendAnswer(sd, destination, pc.pc); }, 
                null, 
                mediaConstraints
            );
		} else if ( content.action === "answer" ) {
            if (pc1.pname === pname) {
                pc = pc1;
            } else if (pc2.pname === pname) {
                pc = pc2;
            } else {
                console.log("Unknown pair", pname);
                return;
            }
			pc.pc.setRemoteDescription(
                new RTCSessionDescription(content.answer)
            );
		} else if ( content.action === "candidate" ) {
            if (pc1.pname === pname) {
                pc = pc1;
            } else if (pc2.pname === pname) {
                pc = pc2;
            } else {
                console.log("Unknown pair", pname);
                return;
            }
			var cand_data = {
                sdpMLineIndex: content.label, 
                candidate: content.candidate
            };
			var candidate = new RTCIceCandidate(cand_data);
			pc.pc.addIceCandidate(candidate);
		} else if ( content.command === "DISCONNECT" ) {
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
			
            if ( role === "player1" ) {
                sinsSubscribe('/pair/'+token+".1-2");
                sinsSubscribe('/pair/'+token+".1-3");
            } else if ( role === "player2" ) {
                sinsSubscribe('/pair/'+token+".1-2");
                sinsSubscribe('/pair/'+token+".2-3");
				doPlayer2Init(token+".1-2");
			} else if ( role === "player3" ) {
                sinsSubscribe('/pair/'+token+".1-3");
                sinsSubscribe('/pair/'+token+".2-3");
				doPlayer3Init();
			}

		}, failedGUM);
   });

}(jQuery));
