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

const MongoDb = require('mongodb');

const { Long } = MongoDb;

class MetadataDb {
	/**
	 * Creates MetadataDb around CatapultDb.
	 * @param {module:db/CatapultDb} db Catapult db instance.
	 */
	constructor(db) {
		this.catapultDb = db;
	}

	/**
	 * Retrieves paginated metadata entries based on metadata type and id.
	 * @param {int} metadataType Type of metadata.
	 * @param {object} targetFilter Target filter
	 * @param {string} pagingId Paging id.
	 * @param {int} pageSize Page size.
	 * @param {object} ordering Page ordering.
	 * @returns {Promise.<array>} Metadata entries.
	 */
	getMetadataWithPagination(metadataType, targetFilter, pagingId, pageSize, ordering) {
		const conditions = { $and: [targetFilter, { 'metadataEntry.metadataType': metadataType }] };
		const options = {
			projection: { 'metadataEntry.metadataType': 0, 'metadataEntry.valueSize': 0 },
			sortOrder: ordering
		};

		return this.catapultDb.queryPagedDocuments('metadata', conditions, pagingId, pageSize, options)
			.then(this.catapultDb.sanitizer.deleteIds);
	}

	/**
	 * Retrieves metadata key values based on metadata type, id and scopedMetadataKey.
	 * @param {int} metadataType Type of metadata.
	 * @param {Uint8Array} targetFilter Target filter
	 * @param {Uint8Array} scopedMetadataKey scoped metadata key.
	 * @returns {Promise.<array>} Tuple of metadata signers and values.
	 */
	getMetadataByKey(metadataType, targetFilter, scopedMetadataKey) {
		const conditions = {
			$and: [
				targetFilter,
				{ 'metadataEntry.scopedMetadataKey': new Long(scopedMetadataKey[0], scopedMetadataKey[1]) },
				{ 'metadataEntry.metadataType': metadataType }
			]
		};

		return this.catapultDb.queryDocuments('metadata', conditions);
	}

	/**
	 * Retrieves metadata key value based on metadata type, id, scopedMetadataKey and signer.
	 * @param {int} metadataType Type of metadata.
	 * @param {Uint8Array} targetFilter Target filter
	 * @param {Uint8Array} scopedMetadataKey scoped metadata key.
	 * @param {Uint8Array} signerPublicKey signer public key.
	 * @returns {Promise.<string>} Metadata value.
	 */
	getMetadataByKeyAndSigner(metadataType, targetFilter, scopedMetadataKey, signerPublicKey) {
		const conditions = {
			$and: [
				targetFilter,
				{ 'metadataEntry.scopedMetadataKey': new Long(scopedMetadataKey[0], scopedMetadataKey[1]) },
				{ 'metadataEntry.senderPublicKey': Buffer.from(signerPublicKey) },
				{ 'metadataEntry.metadataType': metadataType }
			]
		};
		const projection = { 'metadataEntry.value': 1 };

		return this.catapultDb.queryDocument('metadata', conditions, projection)
			.then(this.catapultDb.sanitizer.deleteId);
	}
}

module.exports = MetadataDb;
