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

const { ServerMessageHandler } = require('../../src/connection/serverMessageHandlers');
const test = require('../testUtils');
const catapult = require('catapult-sdk');
const { expect } = require('chai');
const { EventEmitter } = require('ws');

const { address } = catapult.model;

describe('server message handlers', () => {
	const createMockCodec = value => {
		const mock = {
			// only some message handlers require codec, objects passed to codec.deserialize() are collected in following array
			collected: [],
			deserialize: (parser, options) => {
				mock.collected.push({ parser, options });
				return value;
			}
		};
		return mock;
	};
	const addressBuffer = Buffer.from(address.stringToAddress('TAHNZXQBC57AA7KJTMGS3PJPZBXN7DV5JHJU42A'));

	it('block handler', () => {
		// Arrange:
		const emitted = [];
		const codec = createMockCodec(34);
		const blockBuffer = Buffer.of(0xAB, 0xCD, 0xEF);
		const emitter = new EventEmitter();
		emitter.on('block', data => emitted.push(data));

		// Act:
		ServerMessageHandler.zmqMessageHandler(codec, emitter)(
			Buffer.of(0x49, 0x6A, 0xCA, 0x80, 0xE4, 0xD8, 0xF2, 0x9F), blockBuffer, 56, 78, 99, 88
		);

		// Assert:
		// - 12 is a "topic" so it's not forwarded
		// - trailing params (99, 88) should be ignored
		expect(codec.collected.length).to.equal(1);
		expect(codec.collected[0].parser.buffers.current()).to.equal(blockBuffer);

		expect(emitted.length).to.equal(1);
		expect(emitted[0]).to.deep.equal({
			type: 'blockHeaderWithMetadata',
			payload: { block: 34, meta: { hash: 56, generationHash: 78 } }
		});
		emitter.removeAllListeners('block');
	});

	it('finalized block handler', () => {
		// Arrange:
		const emitted = [];
		const codec = createMockCodec(35);
		const finalizedBlockBuffer = Buffer.concat([
			Buffer.of(44, 0, 0, 0), // finalization epoch
			Buffer.of(55, 0, 0, 0), // finalization point
			Buffer.of(66, 0, 0, 0, 0, 0, 0, 0), // height
			Buffer.alloc(test.constants.sizes.hash256, 41) // hash
		]);
		const emitter = new EventEmitter();
		emitter.on('finalizedBlock', data => emitted.push(data));
		// Act:
		ServerMessageHandler.zmqMessageHandler(codec, emitter)(
			Buffer.of(0x54, 0x79, 0xCE, 0x31, 0xA0, 0x32, 0x48, 0x4D), finalizedBlockBuffer, 99, 88
		);

		// Assert:
		// - 12 is a "topic" so it's not forwarded
		// - trailing params (99, 88) should be ignored
		expect(codec.collected.length).to.equal(0);

		expect(emitted.length).to.equal(1);
		expect(emitted[0]).to.deep.equal({
			type: 'finalizedBlock',
			payload: {
				finalizationEpoch: 44,
				finalizationPoint: 55,
				height: [66, 0],
				hash: Buffer.alloc(test.constants.sizes.hash256, 41)
			}
		});
		emitter.removeAllListeners('finalizedBlock');
	});

	it('transaction handler', () => {
		// Arrange:
		const emitted = [];
		const codec = createMockCodec(33);
		const transactionBuffer = Buffer.of(0xEF, 0xCD, 0xAB);
		const emitter = new EventEmitter();
		emitter.on('confirmedAdded/TAHNZXQBC57AA7KJTMGS3PJPZBXN7DV5JHJU42A', data => emitted.push(data));
		// Act:
		const height = Buffer.of(66, 0, 0, 0, 0, 0, 0, 0);
		ServerMessageHandler.zmqMessageHandler(codec, emitter)(
			Buffer.concat([Buffer.of('a'.charCodeAt(0)), addressBuffer]), transactionBuffer, 44, 55, height, 77, 88, 99
		);

		// Assert:
		// - 22 is a "topic" so it's not forwarded
		// - trailing params (77, 88, 99) should be ignored
		expect(codec.collected.length).to.equal(1);
		expect(codec.collected[0].parser.buffers.current()).to.equal(transactionBuffer);
		expect(codec.collected[0].options).to.equal(undefined);

		expect(emitted.length).to.equal(1);
		expect(emitted[0]).to.deep.equal({
			type: 'transactionWithMetadata',
			payload: {
				transaction: 33,
				meta: {
					hash: 44,
					merkleComponentHash: 55,
					height: [66, 0]
				}
			}
		});
		emitter.removeAllListeners('confirmedAdded');
	});

	it('transaction hash handler', () => {
		// Arrange:
		const emitted = [];
		const codec = createMockCodec(35);
		const emitter = new EventEmitter();
		emitter.on('unconfirmedRemoved/TAHNZXQBC57AA7KJTMGS3PJPZBXN7DV5JHJU42A', data => emitted.push(data));

		// Act:
		ServerMessageHandler.zmqMessageHandler(codec, emitter)(
			Buffer.concat([Buffer.of('r'.charCodeAt(0)), addressBuffer]), 44, 77, 88, 99
		);

		// Assert:
		// - 22 is a "topic" so it's not forwarded
		// - trailing params (77, 88, 99) should be ignored
		expect(codec.collected.length).to.equal(0);

		expect(emitted.length).to.equal(1);
		expect(emitted[0]).to.deep.equal({ type: 'transactionWithMetadata', payload: { meta: { hash: 44 } } });
		emitter.removeAllListeners('unconfirmedRemoved');
	});

	it('transaction status handler', () => {
		// Arrange:
		const emitted = [];
		const codec = createMockCodec(35);
		const buffer = Buffer.concat([
			Buffer.alloc(test.constants.sizes.hash256, 41), // hash
			Buffer.of(66, 0, 0, 0, 0, 0, 0, 0), // deadline
			Buffer.of(55, 0, 0, 0) // status
		]);
		const emitter = new EventEmitter();
		emitter.on('status/TAHNZXQBC57AA7KJTMGS3PJPZBXN7DV5JHJU42A', data => emitted.push(data));

		// Act:
		ServerMessageHandler.zmqMessageHandler(codec, emitter)(
			Buffer.concat([Buffer.of('s'.charCodeAt(0)), addressBuffer]), buffer, 99
		);

		// Assert:
		// - 22 is a "topic" so it's not forwarded
		// - trailing param 99 should be ignored
		expect(codec.collected.length).to.equal(0);

		expect(emitted.length).to.equal(1);
		expect(emitted[0]).to.deep.equal({
			type: 'transactionStatus',
			payload: {
				hash: Buffer.alloc(test.constants.sizes.hash256, 41),
				code: 55,
				deadline: [66, 0]
			}
		});
		emitter.removeAllListeners('status');
	});
});
