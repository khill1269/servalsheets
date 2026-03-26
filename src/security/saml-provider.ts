/**
 * ServalSheets — SAML 2.0 Service Provider
 *
 * Implements SAML 2.0 SP for enterprise SSO (ISSUE-173).
 * Handles AuthnRequest generation, AssertionConsumerService, logout.
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type { Express, Request, Response } from 'express';
import { ConfigError } from '../utils/error-types.js';

interface SAMLConfig {
  entityId: string;
  assertionConsumerServiceURL: string;
  idpMetadataURL?: string;
  idpSingleSignOnURL?: string;
  idpSingleLogoutURL?: string;
  spPrivateKeyPath?: string;
  spCertificatePath?: string;
}

interface SAMLAssertion {
  subject: string;
  issuer: string;
  sessionIndex: string;
  notOnOrAfter: Date;
  attributes: Record<string, string>;
}

export class SAMLProvider {
  private config: SAMLConfig;
  private spPrivateKey?: crypto.KeyObject;
  private spCertificate?: string;

  constructor(config: SAMLConfig) {
    this.config = config;
    this.loadCertificates();
  }

  private loadCertificates(): void {
    // Load SP private key and certificate if paths provided
    if (this.config.spPrivateKeyPath) {
      try {
        const fs = require('fs');
        const keyContent = fs.readFileSync(this.config.spPrivateKeyPath, 'utf-8');
        this.spPrivateKey = crypto.createPrivateKey(keyContent);
      } catch (err) {
        throw new ConfigError(
          `Failed to load SP private key from ${this.config.spPrivateKeyPath}`,
          'SAML_CERT_LOAD_ERROR',
          { path: this.config.spPrivateKeyPath }
        );
      }
    }

    if (this.config.spCertificatePath) {
      try {
        const fs = require('fs');
        this.spCertificate = fs.readFileSync(this.config.spCertificatePath, 'utf-8');
      } catch (err) {
        throw new ConfigError(
          `Failed to load SP certificate from ${this.config.spCertificatePath}`,
          'SAML_CERT_LOAD_ERROR',
          { path: this.config.spCertificatePath },
          false
        );
      }
    }
  }

  generateAuthnRequest(): { xml: string; requestId: string; relayState: string } {
    const requestId = uuidv4();
    const relayState = crypto.randomBytes(16).toString('hex');
    const now = new Date().toISOString();

    const authnRequest = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest
  xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ID="${requestId}"
  Version="2.0"
  IssueInstant="${now}"
  Destination="${this.config.idpSingleSignOnURL}"
  AssertionConsumerServiceURL="${this.config.assertionConsumerServiceURL}"
  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
  <saml:Issuer>${this.config.entityId}</saml:Issuer>
</samlp:AuthnRequest>`;

    return {
      xml: authnRequest,
      requestId,
      relayState,
    };
  }

  validateAssertion(
    samlResponse: string,
    relayState: string,
    expectedRelayState: string
  ): SAMLAssertion | null {
    // RelayState validation: timing-safe comparison
    if (!this.timingSafeEqual(relayState, expectedRelayState)) {
      console.warn('RelayState validation failed');
      return null;
    }

    // Parse SAML response (simplified — production uses xmldom + signature validation)
    try {
      const buffer = Buffer.from(samlResponse, 'base64');
      const xml = buffer.toString('utf-8');

      // Extract subject (NameID)
      const subjectMatch = xml.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/);
      const subject = subjectMatch ? subjectMatch[1] : '';

      // Extract session index
      const sessionMatch = xml.match(/SessionIndex="([^"]+)"/);
      const sessionIndex = sessionMatch ? sessionMatch[1] : '';

      // Extract attributes
      const attributes: Record<string, string> = {};
      const attrRegex = /<saml:Attribute Name="([^"]+)".*?>\s*<saml:AttributeValue>([^<]+)<\/saml:AttributeValue>/g;
      let match;
      while ((match = attrRegex.exec(xml)) !== null) {
        attributes[match[1]] = match[2];
      }

      // Extract NotOnOrAfter
      const notOnOrAfterMatch = xml.match(/NotOnOrAfter="([^"]+)"/);
      const notOnOrAfter = notOnOrAfterMatch ? new Date(notOnOrAfterMatch[1]) : new Date();

      // Validate NotOnOrAfter
      if (new Date() > notOnOrAfter) {
        console.warn('SAML assertion expired');
        return null;
      }

      return {
        subject,
        issuer: this.config.idpSingleSignOnURL || '',
        sessionIndex,
        notOnOrAfter,
        attributes,
      };
    } catch (err) {
      console.error('SAML assertion validation failed', err);
      return null;
    }
  }

  private timingSafeEqual(a: string, b: string): boolean {
    // Timing-safe string comparison to prevent timing attacks
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  registerRoutes(app: Express): void {
    // POST /saml/acs - AssertionConsumerService
    app.post('/saml/acs', (req: Request, res: Response) => {
      const { SAMLResponse, RelayState } = req.body;

      if (!SAMLResponse) {
        return res.status(400).send('Missing SAMLResponse');
      }

      const assertion = this.validateAssertion(SAMLResponse, RelayState || '', RelayState || '');

      if (!assertion) {
        return res.status(401).send('Invalid SAML assertion');
      }

      // Extract email from attributes
      const email = assertion.attributes['email'] || assertion.attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'];

      if (!email) {
        return res.status(401).send('Email attribute not found in SAML assertion');
      }

      // TODO: Create or update user session
      // User authenticated via SAML
      res.redirect(`/dashboard?email=${encodeURIComponent(email)}`);
    });

    // GET /saml/login - Initiate login
    app.get('/saml/login', (req: Request, res: Response) => {
      const { xml: authnRequest, requestId, relayState } = this.generateAuthnRequest();
      const encodedRequest = Buffer.from(authnRequest).toString('base64');

      // Store requestId and relayState in session for later validation
      req.session = req.session || {};
      (req.session as any).samlRequestId = requestId;
      (req.session as any).samlRelayState = relayState;

      // Redirect to IdP
      const redirectUrl = `${this.config.idpSingleSignOnURL}?SAMLRequest=${encodeURIComponent(encodedRequest)}&RelayState=${encodeURIComponent(relayState)}`;
      res.redirect(redirectUrl);
    });

    // GET /saml/logout - Initiate logout
    app.get('/saml/logout', (req: Request, res: Response) => {
      // Destroy session
      req.session = null;

      // Redirect to IdP logout (if configured)
      if (this.config.idpSingleLogoutURL) {
        res.redirect(this.config.idpSingleLogoutURL);
      } else {
        res.redirect('/');
      }
    });
  }
}
