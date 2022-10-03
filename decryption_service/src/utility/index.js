const twilio = require('twilio');
const crypto = require('crypto');
const axios = require('axios');

function initializeTwilioClient() {
	return new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

function fetchMediaUrl(client, compositionSid) {
	let uri = `https://video.twilio.com/v1/Compositions/${compositionSid}/Media?Ttl=3600`;
	return client.request({ method: 'GET', uri });
}

function fetchMedia(mediaUrl) {
	return axios({ method: 'GET', url: mediaUrl, responseType: 'stream' });
}

function decryptMedia(privateKey, encryptedCek, iv) {
	let decryptedCek = crypto.privateDecrypt(
		{ key: privateKey, padding: crypto.constants.RSA_PKCS1_PADDING },
		Buffer.from(encryptedCek, 'base64')
	);

	// decryptedCek = Buffer.from(decryptedCek, 'hex');
	iv = Buffer.from(iv, 'base64');

	decryptedCek = Buffer.from(decryptedCek, 'hex');
	iv = Buffer.from(iv, 'hex');

	let decipher = crypto.createDecipheriv('aes-256-cbc', decryptedCek, iv);

	return decipher;
}

module.exports = { initializeTwilioClient, fetchMediaUrl, fetchMedia, decryptMedia };
