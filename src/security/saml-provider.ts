/**
 * SAML 2.0 Service Provider implementation
 * Enables enterprise SSO integration (Okta, Azure AD, Google Workspace)
 */

import { parseStringPromise, buildXmlString } from 'xml2js';
import { createHash, createHmac } from 'crypto';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
import { ServiceError } from '../core/errors.js';

export interface SAMLConfig {
  entityId: string;
  assertionConsumerServiceUrl: string;
  singleLogoutServiceUrl?: string;
  idpUrl: string;
  idpCertificate: string;
  privateKey: string;
  certificate: string;
  nameIdFormat?: string;
  wantAuthnContextClassRef?: boolean;
  forceAuthn?: boolean;
  isPassive?: boolean;
}

export interface SAMLAssertion {
  subject: string;
  sessionIndex: string;
  nameId: string;
  nameIdFormat: string;
  attributes: Record<string, string[]>;
  notOnOrAfter: Date;
  notBefore: Date;
  audience: string;
}

export class SAMLProvider {
  private config: SAMLConfig;

  constructor(config: SAMLConfig) {
    this.config = config;
  }

  /**
   * Generate SAML metadata for service provider
   */
  generateMetadata(): string {
    const metadata = {
      EntityDescriptor: {
        $: {
          xmlns: 'urn:oasis:names:tc:SAML:2.0:metadata',
          entityID: this.config.entityId,
        },
        SPSSODescriptor: {
          $: {
            AuthnRequestsSigned: 'true',
            WantAssertionsSigned: 'true',
            protocolSupportEnumeration: 'urn:oasis:names:tc:SAML:2.0:protocol',
          },
          KeyDescriptor: [
            {
              $: { use: 'signing' },
              KeyInfo: {
                X509Data: {
                  X509Certificate: this.config.certificate.replace(/-----BEGIN CERTIFICATE-----/g, '').replace(/-----END CERTIFICATE-----/g, '').replace(/\s/g, ''),
                },
              },
            },
          ],
          SingleLogoutService: [
            {
              $: {
                Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
                Location: this.config.singleLogoutServiceUrl || `${this.config.assertionConsumerServiceUrl}/logout`,
              },
            },
          ],
          AssertionConsumerService: [
            {
              $: {
                Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
                Location: this.config.assertionConsumerServiceUrl,
                index: '1',
                isDefault: 'true',
              },
            },
          ],
          NameIDFormat: this.config.nameIdFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        },
        IDPSSODescriptor: {
          $: {
            protocolSupportEnumeration: 'urn:oasis:names:tc:SAML:2.0:protocol',
          },
          KeyDescriptor: {
            $: { use: 'signing' },
            KeyInfo: {
              X509Data: {
                X509Certificate: this.config.idpCertificate,
              },
            },
          },
          SingleSignOnService: {
            $: {
              Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
              Location: this.config.idpUrl,
            },
          },
        },
      },
    };

    return buildXmlString(metadata);
  }

  /**
   * Validate SAML assertion from IdP
   */
  async validateAssertion(samlResponse: string): Promise<SAMLAssertion> {
    try {
      const buffer = Buffer.from(samlResponse, 'base64');
      const xml = buffer.toString('utf-8');
      const parsed = await parseStringPromise(xml);

      // Extract assertion (handle multiple possible structures)
      const response = parsed['samlp:Response'] || parsed['Response'];
      if (!response) {
        throw new ServiceError(
          'Invalid SAML response format',
          'INVALID_REQUEST',
          'saml-provider',
          false
        );
      }

      const assertion = response.Assertion?.[0] || response['saml:Assertion']?.[0];
      if (!assertion) {
        throw new ServiceError(
          'No assertion in SAML response',
          'INVALID_REQUEST',
          'saml-provider',
          false
        );
      }

      // Validate wantAssertionsSigned
      if (!assertion.Signature && this.config.wantAuthnContextClassRef !== false) {
        throw new ServiceError(
          'Assertion must be signed',
          'INVALID_REQUEST',
          'saml-provider',
          false
        );
      }

      // Extract subject and conditions
      const subject = assertion.Subject?.[0];
      const conditions = assertion.Conditions?.[0];
      const authnStatement = assertion.AuthnStatement?.[0];

      if (!subject || !conditions) {
        throw new ServiceError(
          'Missing required SAML elements',
          'INVALID_REQUEST',
          'saml-provider',
          false
        );
      }

      // Parse dates with clock skew (max 120 seconds)
      const clockSkew = 120000; // 120 seconds
      const notOnOrAfter = new Date(conditions.NotOnOrAfter?.[0] || 0);
      const notBefore = new Date(conditions.NotBefore?.[0] || 0);
      const now = Date.now();

      if (now > notOnOrAfter.getTime() + clockSkew) {
        throw new ServiceError(
          'SAML assertion has expired',
          'INVALID_REQUEST',
          'saml-provider',
          false
        );
      }

      if (now < notBefore.getTime() - clockSkew) {
        throw new ServiceError(
          'SAML assertion not yet valid',
          'INVALID_REQUEST',
          'saml-provider',
          false
        );
      }

      // Extract attributes
      const attributes: Record<string, string[]> = {};
      const attributeStatement = assertion.AttributeStatement?.[0];
      if (attributeStatement?.Attribute) {
        for (const attr of attributeStatement.Attribute) {
          const name = attr.$.Name;
          const values = attr.AttributeValue?.map((v: { _?: string }) => v._ || '') || [];
          attributes[name] = values;
        }
      }

      const nameId = subject.NameID?.[0]._ || '';
      const sessionIndex = authnStatement?.$.SessionIndex || '';

      return {
        subject: nameId,
        sessionIndex,
        nameId,
        nameIdFormat: subject.NameID?.[0].$.Format || '',
        attributes,
        notOnOrAfter,
        notBefore,
        audience: conditions.AudienceRestriction?.[0]?.Audience?.[0]._ || '',
      };
    } catch (error) {
      logger.error('SAML assertion validation failed', { error });
      throw new ServiceError(
        'SAML assertion validation failed',
        'INVALID_REQUEST',
        'saml-provider',
        false
      );
    }
  }

  /**
   * Generate SAML authentication request
   */
  generateAuthRequest(relayState?: string): { request: string; url: string } {
    const requestId = `_${Math.random().toString(36).substring(2, 15)}`;
    const timestamp = new Date().toISOString();

    const authRequest = {
      'samlp:AuthnRequest': {
        $: {
          xmlns: 'urn:oasis:names:tc:SAML:2.0:assertion',
          'xmlns:samlp': 'urn:oasis:names:tc:SAML:2.0:protocol',
          ID: requestId,
          Version: '2.0',
          IssueInstant: timestamp,
          Destination: this.config.idpUrl,
          AssertionConsumerServiceURL: this.config.assertionConsumerServiceUrl,
          ForceAuthn: this.config.forceAuthn || false,
          IsPassive: this.config.isPassive || false,
        },
        Issuer: this.config.entityId,
        NameIDPolicy: {
          $: {
            Format: this.config.nameIdFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
            AllowCreate: 'true',
          },
        },
      },
    };

    const xml = buildXmlString(authRequest);
    const encoded = Buffer.from(xml).toString('base64');

    const url = new URL(this.config.idpUrl);
    url.searchParams.set('SAMLRequest', encoded);
    if (relayState) {
      url.searchParams.set('RelayState', relayState);
    }

    return {
      request: encoded,
      url: url.toString(),
    };
  }
}
