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
const MongoDb = require('mongodb');
const catapult = require('catapult-sdk');

const { Long } = MongoDb;
const { metadata } = catapult.model;
const { uint64 } = catapult.utils;

module.exports = {
	register: (server, db) => {
		const accountIdToPublicKey = (type, accountId) => {
			if (AccountType.publicKey === type)
				return Promise.resolve(accountId);

			return routeUtils.addressToPublicKey(db, accountId);
		};

		const accountFilter = publicKey => ({ 'metadataEntry.targetPublicKey': Buffer.from(publicKey) });

		const idFilter = id => ({ 'metadataEntry.targetId': new Long(id[0], id[1]) });

		const processAndSendMetadata = (metadataEntries, res, next) => {
			const metadatas = { metadataEntries: metadataEntries.map(metadataEntry => metadataEntry.metadataEntry) };
			return routeUtils.createSender('metadata').sendOne('metadataEntries', res, next)(metadatas);
		};

		const processAndSendMetadataByKey = (metadataEntries, res, next) => {
			const metadatas = {
				values: metadataEntries.map(metadataEntry => ({
					senderPublicKey: metadataEntry.metadataEntry.senderPublicKey,
					value: metadataEntry.metadataEntry.value
				}))
			};
			return routeUtils.createSender('metadata.key').sendOne('values', res, next)(metadatas);
		};

		const processAndSendMetadataByKeyAndSigner = (metadataEntry, res, next) => {
			const metadataValue = undefined !== metadataEntry ? metadataEntry.metadataEntry : {};
			return routeUtils.createSender('metadata.key.signer').sendOne('value', res, next)(metadataValue);
		};

		const addMetadataEndpointsFor = entity => {
			server.get(`/${entity}/:${entity}Id/metadata`, (req, res, next) => {
				const entityId = routeUtils.parseArgument(req.params, `${entity}Id`, uint64.fromHex);
				const pagingOptions = routeUtils.parsePagingArguments(req.params);
				const ordering = routeUtils.parseArgument(req.params, 'ordering', input => ('id' === input ? 1 : -1));

				return db.getMetadataWithPagination(
					metadata.metadataType[entity],
					idFilter(entityId),
					pagingOptions.id,
					pagingOptions.pageSize,
					ordering
				).then(metadataEntries => processAndSendMetadata(metadataEntries, res, next));
			});

			server.get(`/${entity}/:${entity}Id/metadata/:key`, (req, res, next) => {
				const entityId = routeUtils.parseArgument(req.params, `${entity}Id`, uint64.fromHex);
				const scopedMetadataKey = routeUtils.parseArgument(req.params, 'key', uint64.fromHex);

				return db.getMetadataByKey(metadata.metadataType[entity], idFilter(entityId), scopedMetadataKey)
					.then(metadataEntries => processAndSendMetadataByKey(metadataEntries, res, next));
			});

			server.get(`/${entity}/:${entity}Id/metadata/:key/signer/:publicKey`, (req, res, next) => {
				const entityId = routeUtils.parseArgument(req.params, `${entity}Id`, uint64.fromHex);
				const scopedMetadataKey = routeUtils.parseArgument(req.params, 'key', uint64.fromHex);
				const signerPublicKey = routeUtils.parseArgument(req.params, 'publicKey', 'publicKey');

				return db.getMetadataByKeyAndSigner(metadata.metadataType[entity], idFilter(entityId), scopedMetadataKey, signerPublicKey)
					.then(metadataEntry => processAndSendMetadataByKeyAndSigner(metadataEntry, res, next));
			});
		};

		// region account metadata

		server.get('/account/:accountId/metadata', (req, res, next) => {
			const [type, accountId] = routeUtils.parseArgument(req.params, 'accountId', 'accountId');
			const pagingOptions = routeUtils.parsePagingArguments(req.params);
			const ordering = routeUtils.parseArgument(req.params, 'ordering', input => ('id' === input ? 1 : -1));

			return accountIdToPublicKey(type, accountId).then(publicKey =>
				db.getMetadataWithPagination(
					metadata.metadataType.account,
					accountFilter(publicKey),
					pagingOptions.id,
					pagingOptions.pageSize,
					ordering
				).then(metadataEntries => processAndSendMetadata(metadataEntries, res, next)));
		});

		server.get('/account/:accountId/metadata/:key', (req, res, next) => {
			const [type, accountId] = routeUtils.parseArgument(req.params, 'accountId', 'accountId');
			const scopedMetadataKey = routeUtils.parseArgument(req.params, 'key', uint64.fromHex);

			return accountIdToPublicKey(type, accountId).then(publicKey =>
				db.getMetadataByKey(metadata.metadataType.account, accountFilter(publicKey), scopedMetadataKey)
					.then(metadataEntries => processAndSendMetadataByKey(metadataEntries, res, next)));
		});

		server.get('/account/:accountId/metadata/:key/signer/:publicKey', (req, res, next) => {
			const [type, accountId] = routeUtils.parseArgument(req.params, 'accountId', 'accountId');
			const scopedMetadataKey = routeUtils.parseArgument(req.params, 'key', uint64.fromHex);
			const signerPublicKey = routeUtils.parseArgument(req.params, 'publicKey', 'publicKey');

			return accountIdToPublicKey(type, accountId).then(publicKey =>
				db.getMetadataByKeyAndSigner(metadata.metadataType.account, accountFilter(publicKey), scopedMetadataKey, signerPublicKey)
					.then(metadataEntry => processAndSendMetadataByKeyAndSigner(metadataEntry, res, next)));
		});

		// endregion

		// mosaic metadata
		addMetadataEndpointsFor('mosaic');

		// namespace metadata
		addMetadataEndpointsFor('namespace');
	}
};
