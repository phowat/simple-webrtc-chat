(function ($) {
    $(window.document).ready(function () {
		$("#voice-btn").click(function() {
			window.location.href = '/voice';
		});
		$("#video-btn").click(function() {
			window.location.href = '/video';
		});
	});
}(jQuery));
