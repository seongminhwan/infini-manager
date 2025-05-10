/**
 * ImapFlow类型声明文件
 */
declare module 'imapflow' {
  export interface ImapFlowOptions {
    host: string;
    port: number;
    secure: boolean | number;
    auth: {
      user: string;
      pass: string;
    };
    logger?: boolean;
    tls?: {
      rejectUnauthorized?: boolean;
    };
  }

  export interface FetchOptions {
    envelope?: boolean;
    source?: boolean;
    bodyStructure?: boolean;
    flags?: boolean;
    uid?: boolean | string;
    headers?: string[] | boolean;
    size?: boolean;
    body?: boolean | string[];
  }

  export interface SearchOptions {
    since?: Date;
    before?: Date;
    flagged?: boolean;
    unflagged?: boolean;
    seen?: boolean;
    unseen?: boolean;
    answered?: boolean;
    unanswered?: boolean;
    deleted?: boolean;
    undeleted?: boolean;
    draft?: boolean;
    undraft?: boolean;
    subject?: string;
    body?: string;
    text?: string;
    from?: string;
    to?: string;
    cc?: string;
    bcc?: string;
    header?: string[];
    uid?: string | number | number[];
    size?: number | { min?: number; max?: number };
    younger?: number;
    older?: number;
  }

  export interface MessageObject {
    seq: number;
    uid: number;
    source: Buffer;
    envelope?: any;
    bodyStructure?: any;
    flags?: string[];
  }

  export class ImapFlow {
    constructor(options: ImapFlowOptions);
    
    authenticated: boolean;
    connect(): Promise<void>;
    logout(): Promise<void>;
    mailboxOpen(mailbox: string): Promise<any>;
    fetch(search: SearchOptions, options: FetchOptions): AsyncIterable<MessageObject>;
    search(search: SearchOptions): Promise<number[]>;
  }
}