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
const { version: sdkVersion } = require('../../../catapult-sdk/package.json');
const { version: restVersion } = require('../../package.json');
const nodeInfoCodec = require('../sockets/nodeInfoCodec');
const catapult = require('catapult-sdk');

const packetHeader = catapult.packet.header;
const { PacketType } = catapult.packet;
const { BinaryParser } = catapult.parser;

module.exports = {
	register: (server, db, services) => {
		server.get('/diagnostic/blocks/:height/limit/:limit', (req, res, next) => {
			const parseUint = paramName => routeUtils.parseArgument(req.params, paramName, 'uint');
			const height = parseUint('height');
			const count = parseUint('limit');

			return db.blocksFrom(height, count).then(blocks => {
				res.send({ payload: blocks, type: routeResultTypes.block });
				next();
			});
		});

		server.get('/diagnostic/server', (req, res, next) => {
			res.send({
				payload: {
					serverInfo: {
						restVersion,
						sdkVersion
					}
				},
				type: routeResultTypes.serverInfo
			});
			return next();
		});

		server.get('/diagnostic/storage', (req, res, next) =>
			db.storageInfo().then(storageInfo => {
				res.send({ payload: storageInfo, type: routeResultTypes.storageInfo });
				next();
			}));

		server.get('/diagnostic/status', (req, res, next) => {
			const tryParseNodeInfoPacket = packet => {
				try {
					const binaryParser = new BinaryParser();
					binaryParser.push(packet.payload);
					return nodeInfoCodec.deserialize(binaryParser);
				} catch (error) {
					return undefined;
				}
			};

			const okMessage = 'OK';
			const downMessage = 'down';

			// Check database status
			const dbStatus = true === db.database.serverConfig.isConnected() ? okMessage : downMessage;

			// Check apiNode status
			const packetBuffer = packetHeader.createBuffer(PacketType.nodeDiscoveryPullPing, packetHeader.size);
			const apiNodeStatus = services.connections.singleUse()
				.then(connection => connection.pushPull(packetBuffer, services.config.apiNode.timeout))
				.then(packet => (undefined !== tryParseNodeInfoPacket(packet) ? okMessage : downMessage))
				.catch(e => e.message);

			return apiNodeStatus.then(status => {
				res.send({
					payload: {
						statusInfo: {
							apiNode: status,
							db: dbStatus
						}
					},
					type: routeResultTypes.statusInfo
				});

				return next();
			});
		});
	}
};
