(function ($) {
	
	var localStream ;
	var pc ;
	var ws ;
	var ws_open = 0;
	var mediaConstraints = {'mandatory': {
	                                'OfferToReceiveAudio':true, 
                          'OfferToReceiveVideo':true }};
	var iceStuff = $.parseJSON('{"iceServers": [{"url": "stun:stun.l.google.com:19302"}]}');

	var failedGUM = function(e) {
		// Failed to getUserMedia
		console.log('Failed to get user media.', e);
	};

	var wsSend = function (action, extras) {
		var data = { role: role, token: token, action: action } ;
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
		wsSend("offer", { session_description: sessDesc });
	};

	var sendAnswer = function (sessDesc) {
		pc.setLocalDescription(sessDesc);
		wsSend("answer", { session_description: sessDesc });
	}

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
//			attachMediaStream($('#remote-video'), m.stream);
			attachMediaStream($('video')[1], m.stream);
		}; //onRemoteStreamAdded;

		pc.onremovestream = function (m) { 
			console.log("SessionRemoveStream", m); 
		}; //onRemoteStreamRemoved;

		pc.onicecandidate = function (event) { 
			console.log("SessionIceCandidate", event); 
			if (event.candidate) {
				wsSend('candidate', 
						{
							label: event.candidate.sdpMLineIndex,
							id: event.candidate.sdpMid,
							candidate: event.candidate.candidate
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
		} else if ( message_data.action === "hangup" ) {
			window.location.href = '/disconnected'
		}
	};

    $(window.document).ready(function () {

        ws = new WebSocket("ws://" + document.domain + ":5000/ws");
        ws.onmessage = wsOnMessage;
		ws.onopen = function(evt) { ws_open = 1; }; 
		ws.onclose = function(evt) { ws_open = 0; }; 
		ws.onerror = function(evt) { ws_open = 0; }; 

		getUserMedia({video: true, audio: true}, function(lStream) {
			localStream = lStream
			attachMediaStream($('video')[0], localStream);
			wsSend('register');
			
			if ( role === "player2" ) {
				doPlayer2Init();
			}
		}, failedGUM);
   });

}(jQuery));
