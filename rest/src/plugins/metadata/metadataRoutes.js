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
const AccountType = require('../../plugins/AccountType');
const catapult = require('catapult-sdk');

const { uint64 } = catapult.utils;

module.exports = {
	register: (server, db) => {
		const accountIdToPublicKey = (type, accountId) => {
			if (AccountType.publicKey === type)
				return Promise.resolve(accountId);

			return routeUtils.addressToPublicKey(db, accountId);
		};

		const metadataType = {
			account: 0,
			mosaic: 1,
			namespace: 2
		};

		// region account metadata

		server.get('/account/:accountId/metadata', (req, res, next) => {
			const [type, accountId] = routeUtils.parseArgument(req.params, 'accountId', 'accountId');
			const pagingOptions = routeUtils.parsePagingArguments(req.params);
			const ordering = routeUtils.parseArgument(req.params, 'ordering', input => ('id' === input ? 1 : -1));

			return accountIdToPublicKey(type, accountId).then(publicKey =>
				db.getMetadataWithPagination(metadataType.account, publicKey, pagingOptions.id, pagingOptions.pageSize, ordering)
					.then(routeUtils.createSender('metadata').sendArray('metadataEntries', res, next)));
		});

		server.get('/account/:accountId/metadata/:key', (req, res, next) => {
			const [type, accountId] = routeUtils.parseArgument(req.params, 'accountId', 'accountId');
			const scopedMetadataKey = routeUtils.parseArgument(req.params, 'key', uint64.fromHex);

			return accountIdToPublicKey(type, accountId).then(publicKey =>
				db.getMetadataByKey(metadataType.account, publicKey, scopedMetadataKey)
					.then(routeUtils.createSender('metadata.key').sendArray('keys', res, next)));
		});

		server.get('/account/:accountId/metadata/:key/signer/:publicKey', (req, res, next) => {
			const [type, accountId] = routeUtils.parseArgument(req.params, 'accountId', 'accountId');
			const scopedMetadataKey = routeUtils.parseArgument(req.params, 'key', uint64.fromHex);
			const signerPublicKey = routeUtils.parseArgument(req.params, 'publicKey', 'publicKey');

			return accountIdToPublicKey(type, accountId).then(publicKey =>
				db.getMetadataByKeyAndSigner(metadataType.account, publicKey, scopedMetadataKey, signerPublicKey)
					.then(routeUtils.createSender('metadata.key.signer').sendOne('value', res, next)));
		});

		// endregion

		// region mosaic metadata

		server.get('/mosaic/:mosaicId/metadata', (req, res, next) => {
			const mosaicId = routeUtils.parseArgument(req.params, 'mosaicId', uint64.fromHex);
			const pagingOptions = routeUtils.parsePagingArguments(req.params);
			const ordering = routeUtils.parseArgument(req.params, 'ordering', input => ('id' === input ? 1 : -1));

			db.getMetadataWithPagination(metadataType.mosaic, mosaicId, pagingOptions.id, pagingOptions.pageSize, ordering)
				.then(routeUtils.createSender('metadata').sendArray('metadataEntries', res, next));
		});

		server.get('/mosaic/:mosaicId/metadata/:key', (req, res, next) => {
			const mosaicId = routeUtils.parseArgument(req.params, 'mosaicId', uint64.fromHex);
			const scopedMetadataKey = routeUtils.parseArgument(req.params, 'key', uint64.fromHex);

			db.getMetadataByKey(metadataType.mosaic, mosaicId, scopedMetadataKey)
				.then(routeUtils.createSender('metadata.key').sendArray('keys', res, next));
		});

		server.get('/mosaic/:mosaicId/metadata/:key/signer/:publicKey', (req, res, next) => {
			const mosaicId = routeUtils.parseArgument(req.params, 'mosaicId', uint64.fromHex);
			const scopedMetadataKey = routeUtils.parseArgument(req.params, 'key', uint64.fromHex);
			const signerPublicKey = routeUtils.parseArgument(req.params, 'publicKey', 'publicKey');

			db.getMetadataByKeyAndSigner(metadataType.mosaic, mosaicId, scopedMetadataKey, signerPublicKey)
				.then(routeUtils.createSender('metadata.key.signer').sendOne('value', res, next));
		});

		// endregion

		// region namespace metadata

		server.get('/namespace/:namespaceId/metadata', (req, res, next) => {
			const namespaceId = routeUtils.parseArgument(req.params, 'namespaceId', uint64.fromHex);
			const pagingOptions = routeUtils.parsePagingArguments(req.params);
			const ordering = routeUtils.parseArgument(req.params, 'ordering', input => ('id' === input ? 1 : -1));

			db.getMetadataWithPagination(metadataType.namespace, namespaceId, pagingOptions.id, pagingOptions.pageSize, ordering)
				.then(routeUtils.createSender('metadata').sendArray('metadataEntries', res, next));
		});

		server.get('/namespace/:namespaceId/metadata/:key', (req, res, next) => {
			const namespaceId = routeUtils.parseArgument(req.params, 'namespaceId', uint64.fromHex);
			const scopedMetadataKey = routeUtils.parseArgument(req.params, 'key', uint64.fromHex);

			db.getMetadataByKey(metadataType.namespace, namespaceId, scopedMetadataKey)
				.then(routeUtils.createSender('metadata.key').sendArray('keys', res, next));
		});

		server.get('/namespace/:namespaceId/metadata/:key/signer/:publicKey', (req, res, next) => {
			const namespaceId = routeUtils.parseArgument(req.params, 'namespaceId', uint64.fromHex);
			const scopedMetadataKey = routeUtils.parseArgument(req.params, 'key', uint64.fromHex);
			const signerPublicKey = routeUtils.parseArgument(req.params, 'publicKey', 'publicKey');

			db.getMetadataByKeyAndSigner(metadataType.namespace, namespaceId, scopedMetadataKey, signerPublicKey)
				.then(routeUtils.createSender('metadata.key.signer').sendOne('value', res, next));
		});

		// endregion
	}
};
