/*
 * Copyright (c) 2016-2019, Jaguar0625, gimre, BloodyRookie, Tech Bureau, Corp.
 * Copyright (c) 2020-present, Jaguar0625, gimre, BloodyRookie.
 * All rights reserved.
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

const catapult = require('catapult-sdk');

const { convert } = catapult.utils;

class MerkleTree {
	/**
	 * Creates merkle tree.
	 */
	constructor() {
		this.tree = [];
	}

	/**
	 * Decompose a bitmask to get number of bit's indices
	 * @param {number} mask bitmask
	 * @returns {string[]} array of the indices of bits
	 */
	getBitsFromMask(mask) {
		const intValue = parseInt(`0x${convert.uint8ToHex(mask.reverse())}`, 16);
		let index = 0;
		const bits = [];
		for (let i = 1; i <= intValue; i *= 2) {
			if (0 < (intValue & i)) {
				// bit value: i.toString(16)
				bits.push(index.toString(16).toUpperCase());
			}
			index++;
		}
		return bits;
	}

	/**
	 * Calculate path length from given nibbles count
	 * @param {number} nibbleCount Nibbles count
	 * @returns {number} the length of the path
	 */
	getPathLength(nibbleCount) {
		// 1 nibble = 0.5 bytes.
		// Round up to the whole bytes
		return Math.ceil(parseFloat(nibbleCount) / 2);
	}

	/**
	 * Is branch node
	 * @param {number} marker node marker
	 * @returns {boolean} if tree node is branch
	 */
	isBranch(marker) {
		return 0 === marker;
	}

	/**
	 * Is leaf node
	 * @param {number} marker node marker
	 * @returns {boolean} if tree node is leaf
	 */
	isLeaf(marker) {
		return 255 === marker;
	}

	/**
	 * Recursively parse raw tree
	 * @param {Uint8Array} raw raw tree buffer
	 * @returns {Array} merkle tree
	 */
	parseMerkleTreeFromRaw(raw) {
		if (!raw.length)
			return this.tree;

		const marker = raw[0];
		const nibbleCount = raw[1];
		const pathLength = this.getPathLength(nibbleCount);
		const path = raw.slice(2, 2 + pathLength);
		if (this.isBranch(marker)) {
			const lessBranch = this.parseBranch(raw.slice(2 + pathLength), path, nibbleCount);
			return this.parseMerkleTreeFromRaw(lessBranch);
		}
		if (this.isLeaf(marker)) {
			const lessLeaf = this.parseLeaf(raw.slice(2 + pathLength), path, nibbleCount);
			return this.parseMerkleTreeFromRaw(lessLeaf);
		}
	}

	/**
	 * Parse branch tree node
	 * @param {Uint8Array} offsetRaw partial raw buffer
	 * @param {Uint8Array} path merkle tree path
     * @param {number} nibbleCount number of nibbles
	 * @returns {Uint8Array} unprocess raw buffer
	 */
	parseBranch(offsetRaw, path, nibbleCount) {
		const linkMask = offsetRaw.slice(0, 2); // little endian
		const bits = this.getBitsFromMask(linkMask);
		const linksRaw = offsetRaw.slice(2, 2 + (32 * bits.length));
		const links = [];
		for (let i = 0; i < bits.length; i++) {
			links.push({
				bit: bits[i],
				link: convert.uint8ToHex(linksRaw.slice(i * 32, (i * 32) + 32))
			});
		}
		this.tree.push({
			type: 0, path: convert.uint8ToHex(path), nibbleCount, linkMask: convert.uint8ToHex(linkMask), links
		});
		return offsetRaw.slice(2 + (32 * bits.length));
	}

	/**
	 * Parse leaf tree node
	 * @param {Uint8Array} offsetRaw partial raw buffer
	 * @param {Uint8Array} path merkle tree path
     * @param {number} nibbleCount number of nibbles
	 * @returns {Uint8Array} unprocess raw buffer
	 */
	parseLeaf(offsetRaw, path, nibbleCount) {
		const hash = convert.uint8ToHex(offsetRaw.slice(0, 32));
		this.tree.push({
			type: 255, path: convert.uint8ToHex(path), nibbleCount, hash
		});
		return offsetRaw.slice(32);
	}
}

module.exports = MerkleTree;
