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
const AccountType = require('../plugins/AccountType');
const errors = require('../server/errors');
const catapult = require('catapult-sdk');

const { address, networkInfo } = catapult.model;
const { parsers } = routeUtils;

const endpoints = {
	account: {
		route: '/account',
		method: 'post',
		params: {},
		args: {},
		bodyParams: {
			publicKeys: parsers.array(parsers.publicKey),
			addresses: parsers.array(parsers.accountId)
		}
	},
	accountById: {
		route: '/account/:accountId',
		method: 'get',
		params: {
			accountId: parsers.accountId
		},
		args: {},
		bodyParams: {}
	},
	transctionsByAccountIdAndStatus: {
		route: '/account/:accountId/:status',
		method: 'get',
		params: {
			accountId: parsers.accountId,
			status: parsers.string, // does not exist
			ordering: input => ('id' === input ? 1 : -1)
		},
		args: {
			type: parsers.uint
		},
		bodyParams: {}
	},
	transactionsOutgoingByAccountId: {
		route: '/account/:accountId/transactions/outgoing',
		method: 'get',
		params: {
			accountId: parsers.accountId,
			ordering: input => ('id' === input ? 1 : -1)
		},
		args: {
			type: parsers.uint
		},
		bodyParams: {}
	}
};

const buildEndpoint = (server, endpoint, endpointLogic) =>
	server[endpoint.method](endpoint.route, (req, res, next) => {
		const params = routeUtils.parseParams(req.params, endpoint.params);
		return endpointLogic(req, res, next, params);
	});

module.exports = {
	register: (server, db, services) => {
		const transactionSender = routeUtils.createSender(routeResultTypes.transaction);

		buildEndpoint(server, endpoints.account, (req, res, next, params, args, bodyParams) => {
			if (req.params.publicKeys && req.params.addresses)
				throw errors.createInvalidArgumentError('publicKeys and addresses cannot both be provided');

			const idOptions = Array.isArray(req.params.publicKeys)
				? { keyName: 'publicKeys', parserName: 'publicKey', type: AccountType.publicKey }
				: { keyName: 'addresses', parserName: 'address', type: AccountType.address };

			const accountIds = routeUtils.parseParams(req.params, {
				[idOptions.keyName]: parsers.array(parsers[idOptions.parserName])
			})[idOptions.keyName];
			const sender = routeUtils.createSender(routeResultTypes.account);

			return db.accountsByIds(accountIds.map(accountId => ({ [idOptions.type]: accountId })))
				.then(sender.sendArray(idOptions.keyName, res, next));
		});

		buildEndpoint(server, endpoints.accountById, (req, res, next, params, args, bodyParams) => {
			const [type, accountId] = params.accountId;
			const sender = routeUtils.createSender(routeResultTypes.account);
			return db.accountsByIds([{ [type]: accountId }])
				.then(sender.sendOne(req.params.accountId, res, next));
		});

		buildEndpoint(server, endpoints.transctionsByAccountIdAndStatus, (req, res, next, params, args, bodyParams) => {
			const dbPostfixByStatus = {
				transactions: 'Confirmed',
				'transactions/incoming': 'Incoming',
				'transactions/unconfirmed': 'Unconfirmed'
			};

			const [type, accountId] = params.accountId;
			const transactionType = req.params.type ? routeUtils.parseArgument(req.params, 'type', 'uint') : undefined;
			const pagingOptions = routeUtils.parsePagingArguments(req.params);
			const accountAddress = (AccountType.publicKey === type)
				? address.publicKeyToAddress(accountId, networkInfo.networks[services.config.network.name].id)
				: accountId;

			return db[`accountTransactions${dbPostfixByStatus[params.status]}`](
				accountAddress,
				transactionType,
				pagingOptions.id,
				pagingOptions.pageSize,
				params.ordering
			).then(transactionSender.sendArray('accountId', res, next));
		});

		const accountIdToPublicKey = (type, accountId) => {
			if (AccountType.publicKey === type)
				return Promise.resolve(accountId);

			return routeUtils.addressToPublicKey(db, accountId);
		};

		buildEndpoint(server, endpoints.transactionsOutgoingByAccountId, (req, res, next, params, args, bodyParams) => {
			const [type, accountId] = params.accountId;
			const pagingOptions = routeUtils.parsePagingArguments(req.params);

			return accountIdToPublicKey(type, accountId).then(publicKey =>
				db.accountTransactionsOutgoing(publicKey, params.type, pagingOptions.id, pagingOptions.pageSize, params.ordering)
					.then(transactionSender.sendArray('accountId', res, next)))
				.catch(() => {
					transactionSender.sendArray('accountId', res, next)([]);
				});
		});
	}
};
