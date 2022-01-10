/*
 * Copyright (c) 2016-2019, Jaguar0625, gimre, BloodyRookie, Tech Bureau, Corp.
 * Copyright (c) 2020-present, Jaguar0625, gimre, BloodyRookie.
 * All rights reserved.
 *
 * This file is part of Catapult.
 *
 * Catapult is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Catapult is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Catapult.  If not, see <http://www.gnu.org/licenses/>.
 */

const catapult = require('catapult-sdk');

const { address } = catapult.model;
const { uint64 } = catapult.utils;

const parserFromData = binaryData => {
	const parser = new catapult.parser.BinaryParser();
	parser.push(binaryData);
	return parser;
};

const block = (codec, emitter, binaryBlock, hash, generationHash) => {
	const blockObj = codec.deserialize(parserFromData(binaryBlock));
	emitter.emit('block', { type: 'blockHeaderWithMetadata', payload: { block: blockObj, meta: { hash, generationHash } } });
};

const finalizedBlock = (emitter, binaryBlock) => {
	const parser = parserFromData(binaryBlock);

	const finalizationEpoch = parser.uint32();
	const finalizationPoint = parser.uint32();
	const height = parser.uint64();
	const hash = parser.buffer(catapult.constants.sizes.hash256);
	emitter.emit('finalizedBlock', {
		type: 'finalizedBlock',
		payload: {
			finalizationEpoch, finalizationPoint, height, hash
		}
	});
};

const transaction = (codec, emitter, key, binaryTransaction, hash, merkleComponentHash, height) => {
	const transactionObj = codec.deserialize(parserFromData(binaryTransaction));
	const meta = { hash, merkleComponentHash, height: uint64.fromBytes(height) };
	emitter.emit(key, { type: 'transactionWithMetadata', payload: { transaction: transactionObj, meta } });
};

const transactionHash = (emitter, key, hash) => {
	emitter.emit(key, { type: 'transactionWithMetadata', payload: { meta: { hash } } });
};

const transactionStatus = (emitter, key, buffer) => {
	const parser = parserFromData(buffer);

	const hash = parser.buffer(catapult.constants.sizes.hash256);
	const deadline = parser.uint64();
	const code = parser.uint32();
	emitter.emit(key, { type: 'transactionStatus', payload: { hash, code, deadline } });
};

const cosignature = (emitter, key, buffer) => {
	const parser = parserFromData(buffer);
	const version = parser.uint64();
	const signerPublicKey = parser.buffer(catapult.constants.sizes.signerPublicKey);
	const signature = parser.buffer(catapult.constants.sizes.signature);
	const parentHash = parser.buffer(catapult.constants.sizes.hash256);
	emitter.emit(key, {
		type: 'aggregate.cosignature',
		payload: {
			version,
			signerPublicKey,
			signature,
			parentHash
		}
	});
};

const getKeyByTopic = (codec, emitter, message) => {
	const topic = message[0];
	if (topic.equals(Buffer.of(0x49, 0x6A, 0xCA, 0x80, 0xE4, 0xD8, 0xF2, 0x9F))) {
		block(codec, emitter, message[1], message[2], message[3]);
	} else if (topic.equals(Buffer.of(0x54, 0x79, 0xCE, 0x31, 0xA0, 0x32, 0x48, 0x4D))) {
		finalizedBlock(emitter, message[1]);
	} else {
		const maker = topic[0];
		const paramByte = topic.subarray(1, topic.length);
		const topicParam = 8 > paramByte ? undefined : address.addressToString(paramByte);
		switch (maker) {
		case 'a'.charCodeAt(0):
			transaction(codec, emitter, `confirmedAdded/${topicParam}`, message[1], message[2], message[3], message[4]);
			break;
		case 'u'.charCodeAt(0):
			transaction(codec, emitter, `unconfirmedAdded/${topicParam}`, message[1], message[2], message[3], message[4]);
			break;
		case 'r'.charCodeAt(0):
			transactionHash(emitter, `unconfirmedRemoved/${topicParam}`, message[1]);
			break;
		case 's'.charCodeAt(0):
			transactionStatus(emitter, `status/${topicParam}`, message[1]);
			break;
		case 'p'.charCodeAt(0):
			transaction(codec, emitter, `partialAdded/${topicParam}`, message[1], message[2], message[3], message[4]);
			break;
		case 'q'.charCodeAt(0):
			transactionHash(emitter, `partialRemoved/${topicParam}`, message[1]);
			break;
		case 'c'.charCodeAt(0):
			cosignature(emitter, `cosignature/${topicParam}`, message[1]);
			break;
		default:
			break;
		}
	}
};

const ServerMessageHandler = Object.freeze({
	zmqMessageHandler: (codec, emitter) => (...args) => {
		if (args && args.length)
			getKeyByTopic(codec, emitter, args);
	}
});

module.exports = {
	ServerMessageHandler
};
