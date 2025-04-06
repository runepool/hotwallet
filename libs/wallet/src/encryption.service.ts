import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 16;
  private readonly saltLength = 32;
  private readonly tagLength = 16;
  private readonly keyLength = 32;

  /**
   * Encrypts a string using a password
   * @param text The text to encrypt
   * @param password The password to use for encryption
   * @returns The encrypted text as a hex string
   */
  async encrypt(text: string, password: string): Promise<string> {
    const salt = crypto.randomBytes(this.saltLength);
    const iv = crypto.randomBytes(this.ivLength);

    // Derive key using scrypt
    const key = crypto.scryptSync(password, salt, this.keyLength);

    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();

    const result = Buffer.concat([
      salt,
      iv,
      tag,
      Buffer.from(encrypted, 'hex')
    ]);

    return result.toString('hex');
  }

  /**
   * Decrypts a string using a password
   * @param encryptedText The encrypted text as a hex string
   * @param password The password to use for decryption
   * @returns The decrypted text
   */
  async decrypt(encryptedText: string, password: string): Promise<string> {
    try {
      const encryptedBuffer = Buffer.from(encryptedText, 'hex');

      const salt = encryptedBuffer.subarray(0, this.saltLength);
      const iv = encryptedBuffer.subarray(this.saltLength, this.saltLength + this.ivLength);
      const tag = encryptedBuffer.subarray(this.saltLength + this.ivLength, this.saltLength + this.ivLength + this.tagLength);
      const encrypted = encryptedBuffer.subarray(this.saltLength + this.ivLength + this.tagLength).toString('hex');

      const key = crypto.scryptSync(password, salt, this.keyLength);

      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error('Invalid password or corrupted data');
    }
  }

  /**
   * Checks if a string is encrypted
   * @param text The text to check
   * @returns True if the text is encrypted, false otherwise
   */
  isEncrypted(text: string): boolean {
    const minLength = (this.saltLength + this.ivLength + this.tagLength) * 2;
    return /^[0-9a-f]+$/i.test(text) && text.length >= minLength;
  }
}
