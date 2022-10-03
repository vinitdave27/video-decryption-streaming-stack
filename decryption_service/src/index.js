const amqp = require('amqplib/callback_api');
const fs = require('fs');
const { initializeTwilioClient, fetchMedia, fetchMediaUrl, decryptMedia } = require('./utility');

let amqpConnection = null;

function start() {
	amqp.connect(process.env.AMQP_URL + '?heartbeat=60', (err, conn) => {
		if (err) {
			console.error('[AMQP]', err.message);
			return setTimeout(start, 1000);
		}
		conn.on('error', (err) => {
			if (err.message !== 'Connection closing') {
				console.error('[AMQP] connection error', err.message);
			}
		});
		conn.on('close', () => {
			console.error('[AMQP] reconnecting');
			return setTimeout(start, 1000);
		});
		console.log('[AMQP] connected');
		amqpConnection = conn;
		whenConnected();
	});
}

function whenConnected() {
	startWorker();
}

async function publish(msg) {
	let channel;
	try {
		channel = await amqpConnection.createChannel();

		await channel.assertQueue('transcodingQueue');

		channel.sendToQueue('transcodingQueue', msg.content);
	} catch (e) {
		console.error('[AMQP] publish', e.message);
	}
}

function startWorker() {
	amqpConnection.createChannel((err, channel) => {
		if (closeOnErr(err)) return;
		channel.on('error', (err) => {
			console.error('[AMQP] channel error', err.message);
		});
		channel.on('close', () => {
			console.log('[AMQP] channel closed');
		});
		channel.assertQueue('decryptionQueue', { durable: true }, (err, _ok) => {
			if (closeOnErr(err)) return;

			channel.consume('decryptionQueue', processMsg, { noAck: false });
			console.log('Worker is started');
		});
		function processMsg(msg) {
			work(msg, (ok) => {
				try {
					if (ok) channel.ack(msg);
					else channel.reject(msg, true);
				} catch (error) {
					closeOnErr(error);
				}
			});
		}
	});
}

async function work(msg, cb) {
	const { compositionSid } = JSON.parse(msg.content.toString());
	console.log(`Downloading and Decrypting ${compositionSid}`);
	const client = initializeTwilioClient();
	console.log(`Initialized Twilio Client`);
	const mediaUrlResponse = await fetchMediaUrl(client, compositionSid);
	console.log(`Fetched Media Url from Composition API`);
	const { headers, data } = await fetchMedia(mediaUrlResponse.body.redirect_to);
	console.log(`Fetched Encrypted Media and Headers from AWS S3 Presigned Url`);
	let encryptedCek = headers['x-amz-meta-x-amz-key'];
	let iv = headers['x-amz-meta-x-amz-iv'];

	const privateKey = fs.readFileSync(`./keys/id_rsa_priv.pem`, 'utf-8');
	const decipher = decryptMedia(privateKey, encryptedCek, iv);
	console.log(`Decrypted Content Encryption Key`);
	const output = fs.createWriteStream(`./decrypted/${compositionSid}.mp4`);
	console.log(`Decrypting Content for HLS transcoding`);
	data.pipe(decipher).pipe(output);

	output.on('finish', () => {
		console.log('Output WriteStream has finished.');
	});

	output.on('close', () => {
		console.log('Output WriteStream has closed.');
		publish(msg);
		cb(true);
	});
}

function closeOnErr(err) {
	if (!err) return false;
	console.error('[AMQP] error', err);
	amqpConnection.close();
	return true;
}

start();
