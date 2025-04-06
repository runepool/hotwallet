import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 16;
  private readonly saltLength = 32;
  private readonly tagLength = 16;
  private readonly keyLength = 32;
  private readonly argon2Options = {
    type: argon2.argon2id,
    memoryCost: 65536, // 64MB in KiB
    timeCost: 3,      // Number of iterations
    parallelism: 4,   // Degree of parallelism
    hashLength: this.keyLength
  };

  /**
   * Encrypts a string using a password
   * @param text The text to encrypt
   * @param password The password to use for encryption
   * @returns The encrypted text as a hex string
   */
  async encrypt(text: string, password: string): Promise<string> {
    // Generate a random salt
    const salt = crypto.randomBytes(this.saltLength);
    
    // Derive a key from the password using Argon2
    const key = await argon2.hash(password, {
      ...this.argon2Options,
      salt,
      raw: true // Return the raw hash without the Argon2 parameters
    });
    
    // Generate a random initialization vector
    const iv = crypto.randomBytes(this.ivLength);
    
    // Create cipher
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    
    // Encrypt the text
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get the authentication tag
    const tag = cipher.getAuthTag();
    
    // Combine the salt, iv, tag, and encrypted text
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
      // Convert the encrypted text from hex to a buffer
      const encryptedBuffer = Buffer.from(encryptedText, 'hex');
      
      // Extract the salt, iv, tag, and encrypted text
      const salt = encryptedBuffer.subarray(0, this.saltLength);
      const iv = encryptedBuffer.subarray(this.saltLength, this.saltLength + this.ivLength);
      const tag = encryptedBuffer.subarray(this.saltLength + this.ivLength, this.saltLength + this.ivLength + this.tagLength);
      const encrypted = encryptedBuffer.subarray(this.saltLength + this.ivLength + this.tagLength).toString('hex');
      
      // Derive the key from the password using Argon2
      const key = await argon2.hash(password, {
        ...this.argon2Options,
        salt,
        raw: true // Return the raw hash without the Argon2 parameters
      });
      
      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(tag);
      
      // Decrypt the text
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
    // Check if the text is a hex string and has the minimum length for our encryption format
    const minLength = (this.saltLength + this.ivLength + this.tagLength) * 2; // *2 because hex encoding
    return /^[0-9a-f]+$/i.test(text) && text.length >= minLength;
  }
}
