/*
 * Copyright (c) 2016-present,
 * Jaguar0625, gimre, BloodyRookie, Tech Bureau, Corp. All rights reserved.
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

const finalizationProofCodec = require('../../src/sockets/finalizationProofCodec');
const catapult = require('catapult-sdk');
const { expect } = require('chai');

const { BinaryParser } = catapult.parser;

describe('deserialize', () => {
	const version = Buffer.from([0x64, 0x00, 0x00, 0x00]); // 4b
	const finalizationEpoch = Buffer.from([0x02, 0x00, 0x00, 0x00]); // 4b
	const finalizationPoint = Buffer.from([0x01, 0x00, 0x00, 0x00]); // 4b
	const height = Buffer.from([0x0A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]); // 8b
	const hash = Buffer.from([ // 32b
		0xA3, 0x00, 0xEA, 0xFE, 0xDA, 0xBD, 0x5C, 0xFA, 0x0D, 0x4B, 0x94, 0x1D, 0x15, 0xBB, 0x51, 0xB1,
		0xB4, 0x64, 0x72, 0x42, 0xF1, 0xFF, 0x11, 0x00, 0x9F, 0xD0, 0x9A, 0x8F, 0x3D, 0x35, 0x87, 0xF8
	]);

	it('returns undefined if object is 0 bytes length', () => {
		// Arrange:
		const binaryParser = new BinaryParser();
		const packet = [];
		binaryParser.push(Buffer.from(packet));

		// Assert:
		expect(finalizationProofCodec.deserialize(binaryParser)).to.equal(undefined);
	});

	it('returns a deserialized finalization proof object', () => {
		// Arrange:
		const size = Buffer.from([0x38, 0x00, 0x00, 0x00]); // 4b -> value = 56 = 0x38
		const packetBuffer = Buffer.concat([size, version, finalizationEpoch, finalizationPoint, height, hash]);
		const binaryParser = new BinaryParser();
		binaryParser.push(Buffer.from(packetBuffer));

		// Assert:
		expect(finalizationProofCodec.deserialize(binaryParser)).to.deep.equal({
			version: 100,
			finalizationEpoch: 2,
			finalizationPoint: 1,
			height: [10, 0],
			hash,
			messageGroups: []
		});
	});

	it('returns a deserialized finalization proof object with message groups', () => {
		// Arrange:
		const size = Buffer.from([0x38, 0x00, 0x00, 0x00]); // 4b -> value = 56 = 0x38
		const packetBuffer = Buffer.concat([size, version, finalizationEpoch, finalizationPoint, height, hash]);
		const binaryParser = new BinaryParser();
		binaryParser.push(Buffer.from(packetBuffer));

		// TODO finalization stage

		// Assert:
		expect(finalizationProofCodec.deserialize(binaryParser)).to.deep.equal({
			version: 100,
			finalizationEpoch: 2,
			finalizationPoint: 1,
			height: [10, 0],
			hash,
			messageGroups: [{},{}]
		});
	});
});
