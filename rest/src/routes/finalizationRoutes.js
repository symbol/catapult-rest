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

const routeResultTypes = require('./routeResultTypes');
const routeUtils = require('./routeUtils');
const finalizationProofCodec = require('../sockets/finalizationProofCodec');
const catapult = require('catapult-sdk');

const packetHeader = catapult.packet.header;
const { PacketType } = catapult.packet;
const { BinaryParser } = catapult.parser;

module.exports = {
	register: (server, db, services) => {
		const { connections } = services;
		const { timeout } = services.config.apiNode;

		const sendRequestAndResponse = requestPacket =>
			connections.singleUse()
				.then(connection => connection.pushPull(packetBuffer, timeout))
				.then(packet => {
					const binaryParser = new BinaryParser();
					binaryParser.push(packet.payload);
					const payload = finalizationProofCodec.deserialize(binaryParser);
					if (!payload)
						console.log("NOT FOUND");	// FIXME
					res.send({ payload, type: routeResultTypes.finalizationProof, formatter: 'ws' });
					next();
				});

		server.get('/finalization/proof/epoch/:epoch', (req, res, next) => {
			const epoch = routeUtils.parseArgument(req.params, 'epoch', 'uint');

			// prepare request packet
			const uint32Size = 4;
			const headerBuffer = packetHeader.createBuffer(PacketType.finalizationProofAtEpoch, packetHeader.size + uint32Size);
			const epochBuffer = Buffer.alloc(uint32Size);
			epochBuffer.writeUInt32LE(epoch);
			const packetBuffer = Buffer.concat([headerBuffer, epochBuffer]);

			return sendRequestAndResponse(packetBuffer);
		});

		server.get('/finalization/proof/height/:height', (req, res, next) => {
			const height = routeUtils.parseArgument(req.params, 'height', 'uint64');

			// prepare request packet
			const uint64Size = 8;
			const headerBuffer = packetHeader.createBuffer(PacketType.finalizationProofAtHeight, packetHeader.size + uint64Size);
			const heightBuffer = Buffer.alloc(uint64Size);
			heightBuffer.writeUInt32LE(height);	// FIXME
			const packetBuffer = Buffer.concat([headerBuffer, heightBuffer]);

			return sendRequestAndResponse(packetBuffer);
		});
	}
};
