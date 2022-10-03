const twilio = require('twilio');

function initializeTwilioClient() {
	return new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

module.exports = { initializeTwilioClient };
