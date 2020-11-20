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
/* eslint-disable */
const errors = require('../server/errors');
const catapult = require('catapult-sdk');

const packetHeader = catapult.packet.header;
const { StatePathPacketTypes } = catapult.packet;
const { convert } = catapult.utils;

const merleUtils = {
	/**
	 * It sends a merkle tree request to api server for the give state path and key.
	 *
	 * @param {service} services the service object used to call catapult api
	 * @param {PacketType} state the state path packet type from {StatePathPacketTypes}
	 * @param {Uint8Array} key the state identifier as byte array.
	 * @returns {Promise<{formatter: string, payload: *, type: *}>} the response payload ready to be sent as the http response.
	 */
	requestTree: (services, state, key) => {
		if (!StatePathPacketTypes.includes(state))
			throw errors.createInvalidArgumentError('invalid `state` provided');

		const buildResponse = packet => 
			{ 
				const raw = convert.uint8ToHex(packet.payload);
				return { raw, tree: this.parseMerkleTreeFromRaw(raw, [])}
			};
		const { connections } = services;
		const { timeout } = services.config.apiNode;
		const headerBuffer = packetHeader.createBuffer(
			state,
			packetHeader.size + key.length
		);
		const heightBuffer = Buffer.from(key);
		const packetBuffer = Buffer.concat([headerBuffer, heightBuffer]);
		return connections
			.singleUse()
			.then(connection => connection.pushPull(packetBuffer, timeout))
			.then(packet => buildResponse(packet));
	},

	/**
	 * Decompose a bitmask to get number of bit's indices
	 * @param {number} mask bitmask
	 * @returns {Array} array of the indices of bits
	 */
	getBitsFromMask: mask => {
		const value = parseInt(`0x${mask}`);
		let index = 0;
		const bits = [];
		for (let i = 1; i <= value; i *= 2) {
			if (0 < (value & i)) {
				// bit value: i.toString(16)
				bits.push(index.toString(16).toUpperCase());
			}
			index++;
		}
		return bits;
	},
	/**
	 * Calculate path length from given nibbles count
	 * @param {string} nibbleCount Nibbles count in hexadecimal
	 * @returns {number} the length of the path
	 */
	getPathLength: nibbleCount => {
		// 1 nibble = 0.5 bytes.
		// Round up to the whole bytes
		const nibbleNumber = parseInt(`0x${nibbleCount}`);
		return Math.ceil(parseFloat(nibbleNumber) / 2) * 2;
	},

	/**
	 * Is branch node
	 * @param {string} marker node marker
	 * @returns {boolean}
	 */
	isBranch: marker => '00' === marker,

	/**
	 * Is leaf node
	 * @param {string} marker node marker
	 * @returns {boolean}
	 */
	isLeaf: marker => 'FF' === marker,

	/**
	 * Recursively parse raw tree
	 * @param {string} raw raw tree buffer in hexadecimal format
	 * @param {Array} tree merkle tree
	 * @returns {Array} merkle tree
	 */
	parseMerkleTreeFromRaw: (raw, tree) => {
		if (!raw)
			return tree;

		const marker = raw.substring(0, 2);
		const nibbleCount = raw.substring(2, 4);
		const pathLength = this.getPathLength(nibbleCount);
		const path = raw.substring(4, 4 + pathLength);
		if (this.isBranch(marker)) {
			const lessBranch = this.parseBranch(
				raw.substring(4 + pathLength),
				path,
				tree
			);
			return this.parseMerkleTreeFromRaw(lessBranch, tree);
		}
		if (this.isLeaf(marker)) {
			const lessLeaf = this.parseLeaf(
				raw.substring(4 + pathLength),
				path,
				tree
			);
			return this.parseMerkleTreeFromRaw(lessLeaf, tree);
		}
	},

	/**
	 * Parse branch tree node
	 * @param {string} offsetRaw partial raw buffer in hexadecimal format
	 * @param {path} path merkle tree path
	 * @param {Array} tree merkle tree
	 * @returns {string} unprocess raw buffer in hexadecimal format
	 */
	parseBranch: (offsetRaw, path, tree) => {
		const linkMask = offsetRaw.substring(0, 4).match(/../g).reverse().join(''); // little endian
		const bits = this.getBitsFromMask(linkMask);
		const linksRaw = offsetRaw
			.substring(4, 4 + 64 * bits.length)
			.match(/(.{1,64})/g);
		const links = bits.map((bit, index) => ({ bit, link: linksRaw[index] }));
		tree.push({ type: '00', path, links });
		return offsetRaw.substring(4 + 64 * bits.length);
	},

	/**
	 * Parse leaf tree node
	 * @param {string} offsetRaw partial raw buffer in hexadecimal format
	 * @param {path} path merkle tree path
	 * @param {Array} tree merkle tree
	 * @returns {string} unprocess raw buffer in hexadecimal format
	 */
	parseLeaf: (offsetRaw, path, tree) => {
		const hash = offsetRaw.substring(0, 64);
		tree.push({ type: 'FF', path, hash });
		return offsetRaw.substring(64);
	}
};

module.exports = merleUtils;
