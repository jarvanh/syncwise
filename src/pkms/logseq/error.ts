import { LogseqResponseType } from './client'

export type LogseqClientError = LogseqResponseType<null>

export const TokenNotCorrect: LogseqClientError = {
    msg: 'Token not correct, Please checking your Logseq Authorization Setting.',
    status: 401,
    response: null,
}

export const LogseqVersionIsLower: LogseqClientError = {
    msg: 'Logseq version is lower, Please upgrade your Logseq version.\nhttps://logseq.com/downloads',
    status: 500,
    response: null,
}

export const CannotConnectWithLogseq: LogseqClientError = {
    // port 错误 or Logseq not open
    msg: 'Cannot connect to Logseq, Please open your Logseq and config well.',
    status: 500,
    response: null,
}

export const NoSearchingResult: LogseqClientError = {
    msg: 'Not found.',
    status: 404,
    response: null,
}

export const UnknownIssues: LogseqClientError = {
    msg: 'Unknow issues, may you can connect with author.',
    status: 500,
    response: null,
}
