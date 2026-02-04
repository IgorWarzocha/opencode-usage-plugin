/**
 * Type definitions for the Z.ai GLM Coding Plan provider.
 */

export interface ZaiQuotaLimit {
  type: string
  unit: number
  number: number
  usage: number
  currentValue: number
  remaining: number
  percentage: number
  usageDetails?: Array<{ modelCode: string; usage: number }>
  nextResetTime?: number
}

export interface ZaiQuotaResponse {
  code: number
  msg: string
  data: {
    limits: ZaiQuotaLimit[]
  }
  success: boolean
}

export interface ZaiModelUsageResponse {
  code: number
  msg: string
  data: {
    x_time: string[]
    modelCallCount: (number | null)[]
    tokensUsage: (number | null)[]
    totalUsage: {
      totalModelCallCount: number
      totalTokensUsage: number
    }
  }
  success: boolean
}

export interface ZaiToolUsageResponse {
  code: number
  msg: string
  data: {
    x_time: string[]
    networkSearchCount: (number | null)[]
    webReadMcpCount: (number | null)[]
    zreadMcpCount: (number | null)[]
    totalUsage: {
      totalNetworkSearchCount: number
      totalWebReadMcpCount: number
      totalZreadMcpCount: number
      totalSearchMcpCount: number
      toolDetails: any[]
    }
  }
  success: boolean
}

export interface ZaiAuth {
  key: string
}
