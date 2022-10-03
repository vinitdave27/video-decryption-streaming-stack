const amqp = require('amqplib/callback_api');
const fs = require('fs/promises');
const { existsSync } = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

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

		await channel.assertQueue('deleteDecryptedQueue');

		channel.sendToQueue('deleteDecryptedQueue', msg.content);
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
		channel.assertQueue('transcodingQueue', { durable: true }, (err, _ok) => {
			if (closeOnErr(err)) return;

			channel.consume('transcodingQueue', processMsg, { noAck: false });
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
	const { compositionSid } = JSON.parse(msg.content);
	console.log(`\nTranscoding started for ${compositionSid}`);

	if (!existsSync(`./decrypted/${compositionSid}`)) await fs.mkdir(`./decrypted/${compositionSid}`);

	let totalTime;

	ffmpeg(`./decrypted/${compositionSid}.mp4`, { timeout: 432000 })
		.outputOptions(['-f hls', '-hls_time 60', '-hls_playlist_type vod'])
		.output(`./decrypted/${compositionSid}/output.m3u8`)
		.on('start', (commandLine) => {
			console.log(`Spawned Ffmpeg with command: ${commandLine}`);
		})
		.on('codecData', (data) => {
			totalTime = parseInt(data.duration.replace(/:/g, ''));
		})
		.on('progress', (progress) => {
			let time = parseInt(progress.timemark.replace(/:/g, ''));
			//console.log('time: ' + time + ' of totalTime: ' + totalTime);
			let percent = (time / totalTime) * 100;
			console.log('Processing: ' + Math.round(percent) + '% done');
		})
		.on('error', (error) => {
			console.error(error.message);
		})
		.on('end', () => {
			console.log(`\nTranscoding complete for composition ${compositionSid}`);
			publish(msg);
			cb(true);
		})
		.run();
}

function closeOnErr(err) {
	if (!err) return false;
	console.error('[AMQP] error', err);
	amqpConnection.close();
	return true;
}

start();
