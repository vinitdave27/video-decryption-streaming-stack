const amqp = require('amqplib/callback_api');
const fs = require('fs/promises');
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

function startWorker() {
	amqpConnection.createChannel((err, channel) => {
		if (closeOnErr(err)) return;
		channel.on('error', (err) => {
			console.error('[AMQP] channel error', err.message);
		});
		channel.on('close', () => {
			console.log('[AMQP] channel closed');
		});
		channel.assertQueue('deleteDecryptedQueue', { durable: true }, (err, _ok) => {
			if (closeOnErr(err)) return;

			channel.consume('deleteDecryptedQueue', processMsg, { noAck: false });
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
	await fs.rm(`./decrypted/${compositionSid}.mp4`, { force: true, maxRetries: 3, retryDelay: 5000 });
	cb(true);
}

function closeOnErr(err) {
	if (!err) return false;
	console.error('[AMQP] error', err);
	amqpConnection.close();
	return true;
}

start();
