export interface AnthropicProfileResponse {
  account: {
    has_claude_max: boolean
    has_claude_pro: boolean
    display_name: string
    email: string
  }
  organization: {
    organization_type: string
  }
}

export interface AnthropicUsageResponse {
  five_hour: {
    utilization: number
    resets_at: string | null
  } | null
  seven_day: {
    utilization: number
    resets_at: string | null
  } | null
  extra_usage?: {
    is_enabled: boolean
    used_credits: number | null
    monthly_limit: number | null
  }
}

export interface AnthropicAuthData {
  access: string
  refresh?: string
  expires?: number
}
