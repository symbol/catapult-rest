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
	 * @param {Uint8Array} id Target Id or target owner publicKey
	 * @param {string} pagingOptionsId Paging id.
	 * @param {int} pageSize Page size.
	 * @param {object} ordering Page ordering.
	 * @returns {Promise.<array>} Metadata entries.
	 */
	getMetadataWithPagination(metadataType, id, pagingOptionsId, pageSize, ordering) {
		return '';
	}

	/**
	 * Retrieves metadata key values based on metadata type, id and scopedMetadataKey.
	 * @param {int} metadataType Type of metadata.
	 * @param {Uint8Array} id Target Id or target owner publicKey.
	 * @param {Uint8Array} scopedMetadataKey scoped metadata key.
	 * @returns {Promise.<array>} Tuple of metadata signers and values.
	 */
	getMetadataByKey(metadataType, id, scopedMetadataKey) {
		return '';
	}

	/**
	 * Retrieves metadata key value based on metadata type, id, scopedMetadataKey and signer.
	 * @param {int} metadataType Type of metadata.
	 * @param {Uint8Array} id Target Id or target owner publicKey.
	 * @param {Uint8Array} scopedMetadataKey scoped metadata key.
	 * @param {Uint8Array} signerPublicKey signer public key.
	 * @returns {Promise.<string>} Metadata value.
	 */
	getMetadataByKeyAndSigner(metadataType, id, scopedMetadataKey, signerPublicKey) {
		return '';
	}
}

module.exports = MetadataDb;
