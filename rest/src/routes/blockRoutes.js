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

const dbFacade = require('./dbFacade');
const routeResultTypes = require('./routeResultTypes');
const routeUtils = require('./routeUtils');
const errors = require('../server/errors');
const stateTreesCodec = require('../sockets/stateTreesCodec');
const catapult = require('catapult-sdk');

const packetHeader = catapult.packet.header;
const { StatePathPacketTypes } = catapult.packet;
const { BinaryParser } = catapult.parser;

const parseHeight = params => routeUtils.parseArgument(params, 'height', 'uint');

const getLimit = (validLimits, params) => {
	const limit = routeUtils.parseArgument(params, 'limit', 'uint');
	return -1 === validLimits.indexOf(limit) ? undefined : limit;
};

const alignDown = (height, alignment) => (Math.floor((height - 1) / alignment) * alignment) + 1;

module.exports = {
	register: (server, db, services) => {
		server.get('/block/:height', (req, res, next) => {
			const height = parseHeight(req.params);

			return dbFacade.runHeightDependentOperation(db, height, () => db.blockAtHeight(height))
				.then(result => result.payload)
				.then(routeUtils.createSender(routeResultTypes.block).sendOne(height, res, next));
		});

		server.get(
			'/block/:height/transaction/:hash/merkle',
			routeUtils.blockRouteMerkleProcessor(db, 'numTransactions', 'transactionMerkleTree')
		);

		server.get('/block/:height/transactions', (req, res, next) => {
			const height = parseHeight(req.params);
			const pagingOptions = routeUtils.parsePagingArguments(req.params);

			const operation = () => db.transactionsAtHeight(height, pagingOptions.id, pagingOptions.pageSize);
			return dbFacade.runHeightDependentOperation(db, height, operation)
				.then(result => {
					if (!result.isRequestValid) {
						res.send(errors.createNotFoundError(height));
						return next();
					}

					return routeUtils.createSender(routeResultTypes.transaction).sendArray('height', res, next)(result.payload);
				});
		});

		server.get('/blocks/:height/limit/:limit', (req, res, next) => {
			const validPageSizes = routeUtils.generateValidPageSizes(services.config.pageSize);

			const height = parseHeight(req.params);
			const limit = getLimit(validPageSizes, req.params);

			const sanitizedLimit = limit || validPageSizes[0];
			const sanitizedHeight = alignDown(height || 1, sanitizedLimit);
			if (sanitizedHeight !== height || !limit)
				return res.redirect(`/blocks/${sanitizedHeight}/limit/${sanitizedLimit}`, next); // redirect calls next

			return db.blocksFrom(height, limit).then(blocks => {
				res.send({ payload: blocks, type: routeResultTypes.block });
				next();
			});
		});

		const buildResponse = (packet, codec, resultType) => {
			const binaryParser = new BinaryParser();
			binaryParser.push(packet.payload);
			return { payload: codec.deserialize(binaryParser), type: resultType, formatter: 'ws' };
		};

		// this endpoint is here because it is expected to support requests by block other than <current block>
		server.get('/state/:state/hash/:hash/merkle', (req, res, next) => {
			const { state } = req.params;
			const hash = routeUtils.parseArgument(req.params, 'hash', 'hash256');

			if (!StatePathPacketTypes.includes(state))
				throw errors.createInvalidArgumentError('invalid `state` provided');

			const { connections } = services;
			const { timeout } = services.config.apiNode;


			const packetBuffer = packetHeader.createBuffer(state, packetHeader.size);
			return connections.singleUse()
				.then(connection => connection.pushPull(packetBuffer, timeout))
				.then(packet => {
					res.send(buildResponse(packet, stateTreesCodec, routeResultTypes.stateTree));
					next();
				});
		});
	}
};
