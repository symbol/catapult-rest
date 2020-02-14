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

const { createKeyPairFromPrivateKeyString, sign, verify } = require('../../src/crypto/keyPair');
const convert = require('../../src/utils/convert');
const test = require('../testUtils');
const { expect } = require('chai');


describe('key pair', () => {
	describe('SANDBOX', () => {
		it('custom stuff', () => {
			const privateKey = 'e8bf9bc0f35c12d8c8bf94dd3a8b5b4034f1063948e3cc5304e55e31aa4b95a6';
			const keyPair = createKeyPairFromPrivateKeyString(privateKey);
			expect('0815926E003CDD5AF0113C0E067262307A42CD1E697F53B683F7E5F9F57D72C9').to.equal(convert.uint8ToHex(keyPair.publicKey));
			console.log('---- OK 1 ----');


			const signPrivateKey = 'abf4cf55a2b3f742d7543d9cc17f50447b969e6e06f5ea9195d428ab12b7318d';
			const signKeyPair = createKeyPairFromPrivateKeyString(signPrivateKey);
			const dataString = '8ce03cd60514233b86789729102ea09e867fc6d964dea8c2018ef7d0a2e0e24bf7e348e917116690b9';
			const data = convert.hexToUint8(dataString);
			const signature = sign(signKeyPair, data);
			expect('31D272F0662915CAC43AB7D721CAF65D8601F52B2E793EA1533E7BC20E04EA97B74859D9209A7B18DFECFD2C4A42D6957628F5357E3FB8B87CF6A888BAB4280E').to.equal(convert.uint8ToHex(signature));
			console.log('---- OK 2 ----');


			const verification = verify(signKeyPair.publicKey, data, signature);
			expect(verification).to.equal(true);
			console.log('---- OK 3 ----');
		});
	});

	const Private_Key_Size = 32;
	const Signature_Size = 64;

	const Private_Keys = [
		'8D31B712AB28D49591EAF5066E9E967B44507FC19C3D54D742F7B3A255CFF4AB',
		'15923F9D2FFFB11D771818E1F7D7DDCD363913933264D58533CB3A5DD2DAA66A',
		'A9323CEF24497AB770516EA572A0A2645EE2D5A75BC72E78DE534C0A03BC328E',
		'D7D816DA0566878EE739EDE2131CD64201BCCC27F88FA51BA5815BCB0FE33CC8',
		'27FC9998454848B987FAD89296558A34DEED4358D1517B953572F3E0AAA0A22D'
	];

	describe('construction', () => {
		it('can extract from private key test vectors', () => {
			// Arrange:
			const Expected_Public_Keys = [
				'53C659B47C176A70EB228DE5C0A0FF391282C96640C2A42CD5BBD0982176AB1B',
				'3FE4A1AA148F5E76891CE924F5DC05627A87047B2B4AD9242C09C0ECED9B2338',
				'F398C0A2BDACDBD7037D2F686727201641BBF87EF458F632AE2A04B4E8F57994',
				'6A283A241A8D8203B3A1E918B1E6F0A3E14E75E16D4CFFA45AE4EF89E38ED6B5',
				'4DC62B38215826438DE2369743C6BBE6D13428405025DFEFF2857B9A9BC9D821'
			];

			// Sanity:
			expect(Private_Keys.length).equal(Expected_Public_Keys.length);

			for (let i = 0; i < Private_Keys.length; ++i) {
				// Arrange:
				const privateKeyHex = Private_Keys[i];
				const expectedPublicKey = Expected_Public_Keys[i];

				// Act:
				const keyPair = createKeyPairFromPrivateKeyString(privateKeyHex);

				// Assert:
				const message = ` from ${privateKeyHex}`;
				expect(convert.uint8ToHex(keyPair.publicKey), `public ${message}`).equal(expectedPublicKey);
				expect(convert.uint8ToHex(keyPair.privateKey), `private ${message}`).equal(privateKeyHex);
			}
		});

		it('cannot extract from invalid private key', () => {
			// Arrange:
			const invalidPrivateKeys = [
				'', // empty
				'53C659B47C176A70EB228DE5C0A0FF391282C96640C2A42CD5BBD0982176AB', // short
				'53C659B47C176A70EB228DE5C0A0FF391282C96640C2A42CD5BBD0982176AB1BBB' // long
			];

			// Act:
			invalidPrivateKeys.forEach(privateKey => {
				// Assert:
				expect(() => { createKeyPairFromPrivateKeyString(privateKey); }, `from ${privateKey}`)
					.to.throw('private key has unexpected size');
			});
		});
	});

	describe('sign', () => {
		it('fills the signature', () => {
			// Arrange:
			const keyPair = test.random.keyPair();
			const payload = test.random.bytes(100);

			// Act:
			const signature = sign(keyPair, payload);

			// Assert:
			expect(signature).to.not.deep.equal(new Uint8Array(Signature_Size));
		});

		it('returns same signature for same data signed by same key pairs', () => {
			// Arrange:
			const privateKey = convert.uint8ToHex(test.random.bytes(Private_Key_Size));
			const keyPair1 = createKeyPairFromPrivateKeyString(privateKey);
			const keyPair2 = createKeyPairFromPrivateKeyString(privateKey);
			const payload = test.random.bytes(100);

			// Act:
			const signature1 = sign(keyPair1, payload);
			const signature2 = sign(keyPair2, payload);

			// Assert:
			expect(signature2).to.deep.equal(signature1);
		});

		it('returns different signature for same data signed by different key pairs', () => {
			// Arrange:
			const keyPair1 = test.random.keyPair();
			const keyPair2 = test.random.keyPair();
			const payload = test.random.bytes(100);

			// Act:
			const signature1 = sign(keyPair1, payload);
			const signature2 = sign(keyPair2, payload);

			// Assert:
			expect(signature2).to.not.deep.equal(signature1);
		});

		it('cannot sign unsupported data type', () => {
			// Arrange:
			const keyPair = createKeyPairFromPrivateKeyString(Private_Keys[0]);

			// Assert:
			expect(() => { sign(keyPair, {}); }).to.throw('unsupported data type');
		});
	});

	describe('verify', () => {
		it('returns true for data signed with same key pair', () => {
			// Arrange:
			const keyPair = test.random.keyPair();
			const payload = test.random.bytes(100);
			const signature = sign(keyPair, payload);

			// Act:
			const isVerified = verify(keyPair.publicKey, payload, signature);

			// Assert:
			expect(isVerified).to.equal(true);
		});

		it('returns false for data signed with different key pair', () => {
			// Arrange:
			const keyPair1 = test.random.keyPair();
			const keyPair2 = test.random.keyPair();
			const payload = test.random.bytes(100);
			const signature = sign(keyPair1, payload);

			// Act:
			const isVerified = verify(keyPair2.publicKey, payload, signature);

			// Assert:
			expect(isVerified).to.equal(false);
		});

		it('returns false if signature has been modified', () => {
			// Arrange:
			const keyPair = test.random.keyPair();
			const payload = test.random.bytes(100);

			for (let i = 0; i < Signature_Size; i += 4) {
				const signature = sign(keyPair, payload);
				signature[i] ^= 0xFF;

				// Act:
				const isVerified = verify(keyPair.publicKey, payload, signature);

				// Assert:
				expect(isVerified, `signature modified at ${i}`).to.equal(false);
			}
		});

		it('returns false if payload has been modified', () => {
			// Arrange:
			const keyPair = test.random.keyPair();
			const payload = test.random.bytes(44);

			for (let i = 0; i < payload.length; i += 4) {
				const signature = sign(keyPair, payload);
				payload[i] ^= 0xFF;

				// Act:
				const isVerified = verify(keyPair.publicKey, payload, signature);

				// Assert:
				expect(isVerified, `payload modified at ${i}`).to.equal(false);
			}
		});

		it('fails if public key is not on curve', () => {
			// Arrange:
			const keyPair = test.random.keyPair();
			keyPair.publicKey.fill(0);
			keyPair.publicKey[keyPair.publicKey.length - 1] = 1;

			const payload = test.random.bytes(100);
			const signature = sign(keyPair, payload);

			// Act:
			const isVerified = verify(keyPair.publicKey, payload, signature);

			// Assert:
			expect(isVerified).to.equal(false);
		});

		it('fails if public key does not correspond to private key', () => {
			// Arrange:
			const keyPair = test.random.keyPair();
			const payload = test.random.bytes(100);
			const signature = sign(keyPair, payload);

			for (let i = 0; i < keyPair.publicKey.length; ++i)
				keyPair.publicKey[i] ^= 0xFF;

			// Act:
			const isVerified = verify(keyPair.publicKey, payload, signature);

			// Assert:
			expect(isVerified).to.equal(false);
		});

		it('rejects zero public key', () => {
			// Arrange:
			const keyPair = test.random.keyPair();
			keyPair.publicKey.fill(0);

			const payload = test.random.bytes(100);
			const signature = sign(keyPair, payload);

			// Act:
			const isVerified = verify(keyPair.publicKey, payload, signature);

			// Assert:
			expect(isVerified).to.equal(false);
		});

		it('cannot verify non canonical signature', () => {
			const scalarAddGroupOrder = scalar => {
				// 2^252 + 27742317777372353535851937790883648493, little endian
				const Group_Order = [
					0xed, 0xd3, 0xf5, 0x5c, 0x1a, 0x63, 0x12, 0x58, 0xd6, 0x9c, 0xf7, 0xa2, 0xde, 0xf9, 0xde, 0x14,
					0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10
				];

				let r = 0;
				for (let i = 0; i < scalar.length; ++i) {
					const t = scalar[i] + Group_Order[i];
					scalar[i] += Group_Order[i] + r;
					r = (t >> 8) & 0xFF;
				}
			};

			// Arrange:
			const keyPair = test.random.keyPair();
			const payload = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 0]);
			const canonicalSignature = sign(keyPair, payload);

			// this is signature with group order added to 'encodedS' part of signature
			const nonCanonicalSignature = canonicalSignature.slice();
			scalarAddGroupOrder(nonCanonicalSignature.subarray(32));

			// Act:
			const isCanonicalVerified = verify(keyPair.publicKey, payload, canonicalSignature);
			const isNonCanonicalVerified = verify(keyPair.privateKey, payload, nonCanonicalSignature);

			// Assert:
			expect(isCanonicalVerified).to.equal(true);
			expect(isNonCanonicalVerified).to.equal(false);
		});
	});

	describe('test vectors', () => {
		const Input_Data = [
			'8ce03cd60514233b86789729102ea09e867fc6d964dea8c2018ef7d0a2e0e24bf7e348e917116690b9',
			'e4a92208a6fc52282b620699191ee6fb9cf04daf48b48fd542c5e43daa9897763a199aaa4b6f10546109f47ac3564fade0',
			'13ed795344c4448a3b256f23665336645a853c5c44dbff6db1b9224b5303b6447fbf8240a2249c55',
			'a2704638434e9f7340f22d08019c4c8e3dbee0df8dd4454a1d70844de11694f4c8ca67fdcb08fed0cec9abb2112b5e5f89',
			'd2488e854dbcdfdb2c9d16c8c0b2fdbc0abb6bac991bfe2b14d359a6bc99d66c00fd60d731ae06d0'
		];

		const Expected_Signatures = [
			/* eslint-disable max-len */
			'C9B1342EAB27E906567586803DA265CC15CCACA411E0AEF44508595ACBC47600D02527F2EED9AB3F28C856D27E30C3808AF7F22F5F243DE698182D373A9ADE03',
			'0755E437ED4C8DD66F1EC29F581F6906AB1E98704ECA94B428A25937DF00EC64796F08E5FEF30C6F6C57E4A5FB4C811D617FA661EB6958D55DAE66DDED205501',
			'15D6585A2A456E90E89E8774E9D12FE01A6ACFE09936EE41271AA1FBE0551264A9FF9329CB6FEE6AE034238C8A91522A6258361D48C5E70A41C1F1C51F55330D',
			'F6FB0D8448FEC0605CF74CFFCC7B7AE8D31D403BCA26F7BD21CB4AC87B00769E9CC7465A601ED28CDF08920C73C583E69D621BA2E45266B86B5FCF8165CBE309',
			'E88D8C32FE165D34B775F70657B96D8229FFA9C783E61198A6F3CCB92F487982D08F8B16AB9157E2EFC3B78F126088F585E26055741A9F25127AC13E883C9A05'
			/* eslint-enable max-len */
		];

		const assertCanSignTestVectors = dataTransform => {
			// Sanity:
			expect(Private_Keys.length).equal(Input_Data.length);
			expect(Private_Keys.length).equal(Expected_Signatures.length);

			for (let i = 0; i < Private_Keys.length; ++i) {
				// Arrange:
				const inputData = dataTransform(Input_Data[i]);
				const keyPair = createKeyPairFromPrivateKeyString(Private_Keys[i]);

				// Act:
				const signature = sign(keyPair, inputData);

				// Assert:
				const message = `signing with ${Private_Keys[i]}`;
				expect(convert.uint8ToHex(signature), message).equal(Expected_Signatures[i]);
			}
		};

		it('can sign test vectors as hex string', () => {
			// Assert:
			assertCanSignTestVectors(data => data);
		});

		it('can sign test vectors as binary', () => {
			// Assert:
			assertCanSignTestVectors(data => convert.hexToUint8(data));
		});

		const assertCanVerifyTestVectors = dataTransform => {
			// Sanity:
			expect(Private_Keys.length).equal(Input_Data.length);
			expect(Private_Keys.length).equal(Expected_Signatures.length);

			for (let i = 0; i < Private_Keys.length; ++i) {
				// Arrange:
				const inputData = dataTransform(Input_Data[i]);
				const keyPair = createKeyPairFromPrivateKeyString(Private_Keys[i]);
				const signature = sign(keyPair, inputData);

				// Act:
				const isVerified = verify(keyPair.publicKey, inputData, signature);

				// Assert:
				const message = `verifying with ${Private_Keys[i]}`;
				expect(isVerified, message).equal(true);
			}
		};

		it('can verify test vectors as hex string', () => {
			// Assert:
			assertCanVerifyTestVectors(data => data);
		});

		it('can verify test vectors as binary', () => {
			// Assert:
			assertCanVerifyTestVectors(data => convert.hexToUint8(data));
		});
	});
});
