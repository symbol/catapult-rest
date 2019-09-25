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

const routeUtils = require('../../routes/routeUtils');
const errors = require('../../server/errors');
const AccountType = require('../AccountType');
const catapult = require('catapult-sdk');

const { address, networkInfo, mosaicRestriction } = catapult.model;
const { uint64 } = catapult.utils;

module.exports = {
	register: (server, db, services) => {
		const accountIdToAddress = (type, accountId) => ((AccountType.publicKey === type)
			? address.publicKeyToAddress(accountId, networkInfo.networks[services.config.network.name].id)
			: accountId);

		server.get('/mosaic/:mosaicId/restrictions', (req, res, next) => {
			const mosaicId = routeUtils.parseArgument(req.params, 'mosaicId', uint64.fromHex);
			const mosaicRestrictionsSender = routeUtils.createSender('');

			return db.mosaicRestrictionsByMosaicIds(
				[mosaicId],
				mosaicRestriction.restrictionType.global
			).then(mosaicRestrictionsSender.sendOne(req.params.mosaicId, res, next));
		});

		server.get('/mosaic/:mosaicId/restrictions/account/:accountId', (req, res, next) => {
			const mosaicId = routeUtils.parseArgument(req.params, 'mosaicId', uint64.fromHex);
			const [type, accountId] = routeUtils.parseArgument(req.params, 'accountId', 'accountId');
			const mosaicRestrictionsSender = routeUtils.createSender('');

			return db.mosaicRestrictionsByMosaicAndAddresses(
				mosaicId,
				[accountIdToAddress(type, accountId)],
				mosaicRestriction.restrictionType.address
			).then(mosaicRestrictionsSender.sendOne(req.params.accountId, res, next));
		});

		server.post('/mosaic/restrictions', (req, res, next) => {
			const mosaicIds = routeUtils.parseArgumentAsArray(req.params, 'mosaicIds', uint64.fromHex);
			const mosaicRestrictionsSender = routeUtils.createSender('');

			return db.mosaicRestrictionsByMosaicIds(
				mosaicIds,
				mosaicRestriction.restrictionType.global
			).then(mosaicRestrictionsSender.sendArray('mosaicIds', res, next));
		});

		server.post('/mosaic/:mosaicId/restrictions', (req, res, next) => {
			const mosaicId = routeUtils.parseArgument(req.params, 'mosaicId', uint64.fromHex);
			if (req.params.publicKeys && req.params.addresses)
				throw errors.createInvalidArgumentError('publicKeys and addresses cannot both be provided');

			const idOptions = Array.isArray(req.params.publicKeys)
				? { keyName: 'publicKeys', parserName: 'publicKey', type: AccountType.publicKey }
				: { keyName: 'addresses', parserName: 'address', type: AccountType.address };

			const accountIds = routeUtils.parseArgumentAsArray(req.params, idOptions.keyName, idOptions.parserName);
			const mosaicRestrictionsSender = routeUtils.createSender('');

			return db.mosaicRestrictionsByMosaicAndAddresses(
				mosaicId,
				accountIds.map(accountId => accountIdToAddress(idOptions.type, accountId)),
				mosaicRestriction.restrictionType.address
			).then(mosaicRestrictionsSender.sendArray(idOptions.keyName, res, next));
		});
	}
};
